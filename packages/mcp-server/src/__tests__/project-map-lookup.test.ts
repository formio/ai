import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  canonicalDir,
  findProjectEntry,
  readProjectEntry,
  readProjectEntryForWrite,
  removeProjectEntry,
  writeProjectEntry,
} from '../project-map.js';
import { resolveProject } from '../project-resolver.js';
import { runProjectCommand } from '../cli/project-command.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { projectRecordOf } from '../workspace-directory.js';
import { connectTools } from './test-helpers.js';

const entryFor = (projectUrl: string) => ({ env: { FORMIO_PROJECT_URL: projectUrl } });

// A mapping applies to its directory's descendants, and directories are compared by
// canonical path: symlinks resolved and a Git-Bash `/c/...` path read as `C:\...` on
// Windows. The canonical path keeps its true case — it is what is stored, shown, and
// compared — and case is folded only for a stored directory that no longer exists.
describe('canonicalDir', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-canonical-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('resolves a path that does not exist without touching its case on linux', () => {
    expect(canonicalDir('/work/Repo/./apps/', 'linux')).toBe('/work/Repo/apps');
  });

  it('keeps the case it is given on darwin and win32', () => {
    expect(canonicalDir('/work/Repo', 'darwin')).toBe('/work/Repo');
    expect(canonicalDir('C:\\Users\\Me\\App\\', 'win32')).toBe('C:\\Users\\Me\\App');
  });

  it('reads a Git-Bash /c/... path as C:\\... on win32 only', () => {
    expect(canonicalDir('/c/Users/Me/app', 'win32')).toBe('C:\\Users\\Me\\app');
    expect(canonicalDir('/c', 'win32')).toBe('C:\\');
    expect(canonicalDir('/c/Users/Me/app', 'linux')).toBe('/c/Users/Me/app');
  });

  it('resolves a symbolic link to its target', () => {
    const real = path.join(tmp, 'Real');
    const link = path.join(tmp, 'link');
    fs.mkdirSync(real);
    fs.symlinkSync(real, link);

    expect(canonicalDir(link, 'linux')).toBe(fs.realpathSync.native(real));
    expect(canonicalDir(link, 'darwin')).toBe(fs.realpathSync.native(real));
  });

  it('resolves the existing part of a path that does not exist yet', () => {
    const real = path.join(tmp, 'real');
    const link = path.join(tmp, 'link');
    fs.mkdirSync(real);
    fs.symlinkSync(real, link);

    expect(canonicalDir(path.join(link, 'not-yet'), 'linux')).toBe(
      path.join(fs.realpathSync.native(real), 'not-yet')
    );
  });
});

describe('mapping lookup', () => {
  let cacheDir: string;
  let tmp: string;
  const mapFile = () => path.join(cacheDir, 'projects.json');
  const seed = (map: Record<string, unknown>) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(mapFile(), JSON.stringify(map));
  };

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-lookup-cache-'));
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-lookup-tree-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('gives a subdirectory its mapped ancestor', () => {
    seed({ '/work/repo': entryFor('https://repo.form.io') });

    expect(findProjectEntry({ cwd: '/work/repo/apps/web', cacheDir })).toEqual({
      dir: '/work/repo',
      entry: entryFor('https://repo.form.io'),
    });
    expect(readProjectEntry('/work/repo/apps/web', cacheDir)).toEqual(
      entryFor('https://repo.form.io')
    );
  });

  it('prefers the nearer mapping', () => {
    seed({
      '/work/repo': entryFor('https://repo.form.io'),
      '/work/repo/apps/web': entryFor('https://web.form.io'),
    });

    expect(findProjectEntry({ cwd: '/work/repo/apps/web/src', cacheDir })?.dir).toBe(
      '/work/repo/apps/web'
    );
    expect(findProjectEntry({ cwd: '/work/repo/apps/api', cacheDir })?.dir).toBe('/work/repo');
  });

  it('does not match a sibling that merely shares a prefix', () => {
    seed({ '/work/repo': entryFor('https://repo.form.io') });

    expect(findProjectEntry({ cwd: '/work/repository', cacheDir })).toBeNull();
  });

  it('matches a symlinked path to its target, in either direction', () => {
    const real = path.join(tmp, 'real');
    const link = path.join(tmp, 'link');
    fs.mkdirSync(path.join(real, 'sub'), { recursive: true });
    fs.symlinkSync(real, link);

    seed({ [real]: entryFor('https://real.form.io') });
    expect(readProjectEntry(path.join(link, 'sub'), cacheDir)).toEqual(
      entryFor('https://real.form.io')
    );

    seed({ [link]: entryFor('https://link.form.io') });
    expect(readProjectEntry(real, cacheDir)).toEqual(entryFor('https://link.form.io'));
  });

  it('compares case-insensitively on darwin and win32, and exactly elsewhere', () => {
    seed({
      '/Work/Repo': entryFor('https://posix.form.io'),
      'C:\\Users\\Me\\app': entryFor('https://windows.form.io'),
    });

    expect(findProjectEntry({ cwd: '/work/repo/x', cacheDir, platform: 'darwin' })?.dir).toBe(
      '/Work/Repo'
    );
    expect(findProjectEntry({ cwd: '/work/repo/x', cacheDir, platform: 'linux' })).toBeNull();
    expect(
      findProjectEntry({ cwd: 'c:\\users\\me\\app\\src', cacheDir, platform: 'win32' })?.dir
    ).toBe('C:\\Users\\Me\\app');
    expect(
      findProjectEntry({ cwd: '/c/users/me/app', cacheDir, platform: 'win32' })?.entry
    ).toEqual(entryFor('https://windows.form.io'));
  });

  it('matches entries already on disk without rewriting the file', () => {
    seed({ '/Work/Repo/': entryFor('https://repo.form.io') });
    const before = fs.readFileSync(mapFile(), 'utf-8');
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(mapFile(), old, old);
    const mtime = fs.statSync(mapFile()).mtimeMs;

    expect(findProjectEntry({ cwd: '/work/repo/x', cacheDir, platform: 'darwin' })?.entry).toEqual(
      entryFor('https://repo.form.io')
    );

    expect(fs.readFileSync(mapFile(), 'utf-8')).toBe(before);
    expect(fs.statSync(mapFile()).mtimeMs).toBe(mtime);
  });

  it('stores the canonical form of the directory a write is given', () => {
    const real = path.join(tmp, 'Real');
    const link = path.join(tmp, 'link');
    fs.mkdirSync(real);
    fs.symlinkSync(real, link);

    writeProjectEntry({
      cwd: link,
      ...entryFor('https://a.form.io'),
      cacheDir,
      platform: 'darwin',
    });
    writeProjectEntry({
      cwd: '/c/Users/Me/app',
      ...entryFor('https://b.form.io'),
      cacheDir,
      platform: 'win32',
    });

    // In its true case: the key is what a person reads in the file and in messages.
    expect(Object.keys(JSON.parse(fs.readFileSync(mapFile(), 'utf-8')))).toEqual([
      fs.realpathSync.native(real),
      'C:\\Users\\Me\\app',
    ]);
  });

  it('replaces an equivalent spelling already on disk rather than adding a twin', () => {
    seed({
      '/Work/Repo/': entryFor('https://old.form.io'),
      '/work/other': entryFor('https://other.form.io'),
    });

    writeProjectEntry({
      cwd: '/work/REPO',
      ...entryFor('https://new.form.io'),
      cacheDir,
      platform: 'darwin',
    });

    expect(JSON.parse(fs.readFileSync(mapFile(), 'utf-8'))).toEqual({
      '/work/other': entryFor('https://other.form.io'),
      '/work/REPO': entryFor('https://new.form.io'),
    });
  });

  it('removes the entry recorded under an equivalent spelling, and never an ancestor', () => {
    seed({
      '/Work/Repo': entryFor('https://repo.form.io'),
      '/Work/Repo/apps/web': entryFor('https://web.form.io'),
    });

    expect(
      removeProjectEntry({ cwd: '/work/repo/apps/web', cacheDir, platform: 'darwin' })
    ).toEqual(entryFor('https://web.form.io'));
    expect(removeProjectEntry({ cwd: '/work/repo/apps/api', cacheDir, platform: 'darwin' })).toBe(
      undefined
    );
    expect(JSON.parse(fs.readFileSync(mapFile(), 'utf-8'))).toEqual({
      '/Work/Repo': entryFor('https://repo.form.io'),
    });
  });
});

// The walk from a directory toward the root stops at the first directory, the start
// included, that contains `.git` — the boundary the committed formio.json walk uses. A
// mapping above a repository does not reach into it; without any `.git` the walk runs
// to the filesystem root.
describe('the repository boundary on the mapping walk', () => {
  let cacheDir: string;
  let tree: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-boundary-cache-'));
    tree = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'formio-boundary-tree-')));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(tree, { recursive: true, force: true });
  });

  const map = (dir: string, projectUrl: string) =>
    writeProjectEntry({ cwd: dir, ...entryFor(projectUrl), cacheDir });

  it('does not carry a mapping above a repository into it', () => {
    const code = path.join(tree, 'code');
    const otherRepo = path.join(code, 'other-repo');
    fs.mkdirSync(path.join(otherRepo, '.git'), { recursive: true });
    fs.mkdirSync(path.join(otherRepo, 'src'));
    map(code, 'https://code.form.io');

    expect(findProjectEntry({ cwd: otherRepo, cacheDir })).toBeNull();
    expect(findProjectEntry({ cwd: path.join(otherRepo, 'src'), cacheDir })).toBeNull();
    expect(() => resolveProject(otherRepo, {}, { cacheDir, onNote: () => {} })).toThrow(
      'No Form.io project is configured'
    );
  });

  it('gives a subdirectory the mapping of its repository root', () => {
    const repo = path.join(tree, 'repo');
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'apps', 'web'), { recursive: true });
    map(repo, 'https://repo.form.io');

    expect(findProjectEntry({ cwd: path.join(repo, 'apps', 'web'), cacheDir })?.dir).toBe(repo);
  });

  it('still prefers a nearer mapping inside the repository', () => {
    const repo = path.join(tree, 'repo');
    const apps = path.join(repo, 'apps');
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.mkdirSync(path.join(apps, 'web'), { recursive: true });
    map(tree, 'https://above.form.io');
    map(repo, 'https://repo.form.io');
    map(apps, 'https://apps.form.io');

    expect(findProjectEntry({ cwd: path.join(apps, 'web'), cacheDir })?.dir).toBe(apps);
  });

  it('walks to the filesystem root when no directory holds .git', () => {
    const nested = path.join(tree, 'plain', 'deeper');
    fs.mkdirSync(nested, { recursive: true });
    map(tree, 'https://tree.form.io');

    expect(findProjectEntry({ cwd: nested, cacheDir })?.dir).toBe(tree);
  });

  it('applies the same boundary to what a writer reads', () => {
    const code = path.join(tree, 'code');
    const otherRepo = path.join(code, 'other-repo');
    fs.mkdirSync(path.join(otherRepo, '.git'), { recursive: true });
    map(code, 'https://code.form.io');

    expect(readProjectEntryForWrite(otherRepo, cacheDir)).toEqual({ status: 'absent' });
  });
});

// Directories compare by their real path, exactly: on a case-insensitive volume the real
// path already carries the stored case, and on a case-sensitive one two names differing
// only by case are two directories. Case is folded — on darwin and win32 only — just for
// a stored key whose directory no longer exists, where no real path can be asked for.
describe('case and the real path', () => {
  let cacheDir: string;
  const mapFile = () => path.join(cacheDir, 'projects.json');

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-case-cache-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  // A case-sensitive volume on darwin: these directories exist, under exactly these names.
  const caseSensitiveVolume = (existing: string[]) => {
    const present = new Set(existing);
    vi.spyOn(fs.realpathSync, 'native').mockImplementation(((target: fs.PathLike) => {
      const asked = String(target);
      if (present.has(asked)) {
        return asked;
      }
      throw Object.assign(new Error(`ENOENT: no such file or directory, realpath '${asked}'`), {
        code: 'ENOENT',
      });
    }) as typeof fs.realpathSync.native);
  };

  it('keeps two directories differing only by case apart on a case-sensitive volume', () => {
    caseSensitiveVolume(['/', '/vol', '/vol/Foo', '/vol/foo']);

    writeProjectEntry({
      cwd: '/vol/Foo',
      ...entryFor('https://upper.form.io'),
      cacheDir,
      platform: 'darwin',
    });
    writeProjectEntry({
      cwd: '/vol/foo',
      ...entryFor('https://lower.form.io'),
      cacheDir,
      platform: 'darwin',
    });

    expect(JSON.parse(fs.readFileSync(mapFile(), 'utf-8'))).toEqual({
      '/vol/Foo': entryFor('https://upper.form.io'),
      '/vol/foo': entryFor('https://lower.form.io'),
    });
    expect(findProjectEntry({ cwd: '/vol/Foo', cacheDir, platform: 'darwin' })?.dir).toBe(
      '/vol/Foo'
    );
    expect(findProjectEntry({ cwd: '/vol/foo', cacheDir, platform: 'darwin' })?.dir).toBe(
      '/vol/foo'
    );
  });

  it('does not give an existing directory the mapping of its case twin', () => {
    caseSensitiveVolume(['/', '/vol', '/vol/Foo', '/vol/foo']);
    fs.writeFileSync(mapFile(), JSON.stringify({ '/vol/Foo': entryFor('https://upper.form.io') }));

    expect(findProjectEntry({ cwd: '/vol/foo', cacheDir, platform: 'darwin' })).toBeNull();
  });

  it.each(['darwin', 'win32'] as const)(
    'matches a stored key whose directory no longer exists case-insensitively on %s',
    (platform) => {
      caseSensitiveVolume(['/', '/vol', '/vol/foo']);
      const stored = platform === 'win32' ? 'C:\\Gone\\Repo' : '/vol/FOO';
      const asked = platform === 'win32' ? 'c:\\gone\\repo\\src' : '/vol/foo/src';
      fs.writeFileSync(mapFile(), JSON.stringify({ [stored]: entryFor('https://gone.form.io') }));

      expect(findProjectEntry({ cwd: asked, cacheDir, platform })?.dir).toBe(stored);
    }
  );

  it('matches a stored key whose directory no longer exists exactly on linux', () => {
    caseSensitiveVolume(['/', '/vol', '/vol/foo']);
    fs.writeFileSync(mapFile(), JSON.stringify({ '/vol/FOO': entryFor('https://gone.form.io') }));

    expect(findProjectEntry({ cwd: '/vol/foo/src', cacheDir, platform: 'linux' })).toBeNull();
  });
});

// The parsed map and its comparison index are reused while the file is unchanged —
// the same modification time, size and inode — and rebuilt when any of them changes.
describe('the map read cache', () => {
  let cacheDir: string;
  const mapFile = () => path.join(cacheDir, 'projects.json');

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-map-cache-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  // Probes of a stored key no lookup below asks about, so each one is the index's own.
  const storedKeyProbes = (realpath: { mock: { calls: unknown[][] } }) =>
    realpath.mock.calls.filter(([target]) => target === '/stored/a').length;
  const mapReads = (read: { mock: { calls: unknown[][] } }) =>
    read.mock.calls.filter(([target]) => target === mapFile()).length;

  it('reuses the parsed map and index while the file is unchanged, and refreshes when it changes', () => {
    fs.writeFileSync(
      mapFile(),
      JSON.stringify({
        '/stored/a': entryFor('https://a.form.io'),
        '/stored/b': entryFor('https://b.form.io'),
      })
    );
    const read = vi.spyOn(fs, 'readFileSync');
    const realpath = vi.spyOn(fs.realpathSync, 'native');

    expect(findProjectEntry({ cwd: '/stored/a/x', cacheDir })?.dir).toBe('/stored/a');
    expect(mapReads(read)).toBe(1);
    const probesAfterFirst = storedKeyProbes(realpath);
    expect(probesAfterFirst).toBeGreaterThan(0);
    realpath.mockClear();

    expect(findProjectEntry({ cwd: '/elsewhere/y', cacheDir })).toBeNull();
    expect(findProjectEntry({ cwd: '/stored/b/z', cacheDir })?.dir).toBe('/stored/b');
    expect(mapReads(read)).toBe(1);
    expect(storedKeyProbes(realpath)).toBe(0);

    fs.writeFileSync(
      mapFile(),
      JSON.stringify({
        '/stored/a': entryFor('https://a.form.io'),
        '/stored/c-with-a-longer-name': entryFor('https://c.form.io'),
      })
    );

    expect(findProjectEntry({ cwd: '/stored/c-with-a-longer-name', cacheDir })?.dir).toBe(
      '/stored/c-with-a-longer-name'
    );
    expect(findProjectEntry({ cwd: '/elsewhere/z', cacheDir })).toBeNull();
    expect(mapReads(read)).toBe(2);
    expect(storedKeyProbes(realpath)).toBeGreaterThan(0);
  });

  it('sees a write made through the map module at once', () => {
    writeProjectEntry({ cwd: '/stored/a', ...entryFor('https://a.form.io'), cacheDir });
    expect(findProjectEntry({ cwd: '/stored/a', cacheDir })?.entry).toEqual(
      entryFor('https://a.form.io')
    );

    writeProjectEntry({ cwd: '/stored/a', ...entryFor('https://a2.form.io'), cacheDir });

    expect(findProjectEntry({ cwd: '/stored/a', cacheDir })?.entry).toEqual(
      entryFor('https://a2.form.io')
    );
  });
});

describe('resolution under a mapped ancestor', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-ancestor-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-ancestor-repo-'));
    fs.mkdirSync(path.join(repo, '.git'));
    fs.mkdirSync(path.join(repo, 'apps', 'web'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const resolve = (cwd: string) => resolveProject(cwd, {}, { cacheDir, onNote: () => {} });

  it('resolves the project mapped for the repository from a subdirectory', () => {
    writeProjectEntry({ cwd: repo, ...entryFor('https://repo.form.io'), cacheDir });

    const resolution = resolve(path.join(repo, 'apps', 'web'));

    expect(resolution.config.projectUrl).toBe('https://repo.form.io');
    expect(resolution.sources.projectUrl).toBe('mapping');
  });

  it('still lets a committed formio.json outrank a mapped ancestor', () => {
    writeProjectEntry({ cwd: repo, ...entryFor('https://mapped.form.io'), cacheDir });
    fs.writeFileSync(
      path.join(repo, 'apps', 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.form.io' })
    );

    const resolution = resolve(path.join(repo, 'apps', 'web'));

    expect(resolution.config.projectUrl).toBe('https://committed.form.io');
    expect(resolution.sources.projectUrl).toBe('committed');
    // The ancestor's mapping is the shadowed candidate, not an absent one.
    expect(resolution.candidates.mapping).toBe('https://mapped.form.io');
  });

  it('names the mapped ancestor, in its true case, when its entry cannot be honoured', () => {
    const mixed = path.join(repo, 'MixedCase');
    fs.mkdirSync(path.join(mixed, 'apps'), { recursive: true });
    writeProjectEntry({ cwd: mixed, env: { FORMIO_PROJECT_URL: 'ftp://repo.form.io' }, cacheDir });

    let message = '';
    try {
      resolve(path.join(mixed, 'apps'));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    const trueCase = fs.realpathSync.native(mixed);
    expect(message).toContain(`the entry for ${trueCase}`);
    expect(message).not.toContain(trueCase.toLowerCase());
  });

  // Only where the filesystem folds case can a directory be named in another case at all.
  it.runIf(process.platform === 'darwin' || process.platform === 'win32')(
    'stores and names a directory in its true case when the caller spells it in another',
    () => {
      const mixed = path.join(repo, 'MixedCase');
      fs.mkdirSync(path.join(mixed, 'apps'), { recursive: true });
      writeProjectEntry({
        cwd: mixed.toLowerCase(),
        env: { FORMIO_PROJECT_URL: 'ftp://repo.form.io' },
        cacheDir,
      });

      const trueCase = fs.realpathSync.native(mixed);
      expect(
        Object.keys(JSON.parse(fs.readFileSync(path.join(cacheDir, 'projects.json'), 'utf-8')))
      ).toEqual([trueCase]);
      expect(() => resolve(path.join(mixed, 'apps'))).toThrow(`the entry for ${trueCase}`);
    }
  );
});

// A write always records for the directory it was given, even beneath a mapped
// ancestor, and a deployment-only write there amends the project that governs it.
describe('writers beneath a mapped ancestor', () => {
  let cacheDir: string;
  let repo: string;
  let web: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-ancestor-writer-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-ancestor-writer-repo-'));
    web = path.join(repo, 'apps', 'web');
    fs.mkdirSync(path.join(repo, '.git'));
    fs.mkdirSync(web, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const run = (args: string[]) => runProjectCommand(['project', ...args], { cacheDir, env: {} });
  const stored = () =>
    JSON.parse(fs.readFileSync(path.join(cacheDir, 'projects.json'), 'utf-8')) as Record<
      string,
      unknown
    >;

  it('`project set` restating the pair its ancestor maps changes nothing and names the ancestor', () => {
    run(['set', '--project-url', 'https://repo.form.io', '--cwd', repo]);

    const result = run(['set', '--project-url', 'https://repo.form.io', '--cwd', web]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`No change for ${web}`);
    expect(result.stdout).toContain(`inherited from the mapping for ${canonicalDir(repo)}`);
    expect(Object.keys(stored())).toEqual([canonicalDir(repo)]);
  });

  it('`project set` records the subdirectory itself for a different project', () => {
    run(['set', '--project-url', 'https://repo.form.io', '--cwd', repo]);

    const result = run(['set', '--project-url', 'https://web.form.io', '--cwd', web]);

    expect(result.exitCode).toBe(0);
    expect(Object.keys(stored()).sort()).toEqual([canonicalDir(repo), canonicalDir(web)].sort());
  });

  it('`project set` beneath a forced ancestor never copies the override onto the child', () => {
    run([
      'set',
      '--force',
      '--project-url',
      'https://internal.form.io',
      '--base-url',
      'https://forms.internal.form.io',
      '--cwd',
      repo,
    ]);

    const restated = run([
      'set',
      '--project-url',
      'https://internal.form.io',
      '--base-url',
      'https://forms.internal.form.io',
      '--cwd',
      web,
    ]);

    expect(restated.exitCode).toBe(0);
    expect(Object.keys(stored())).toEqual([canonicalDir(repo)]);
  });

  it('`project set --base-url` beneath a mapped ancestor pairs it with the governing project', () => {
    run([
      'set',
      '--project-url',
      'https://myproject.mysite.com',
      '--base-url',
      'https://api.mysite.com',
      '--cwd',
      repo,
    ]);

    const result = run(['set', '--base-url', 'https://forms.mysite.com', '--cwd', web]);

    expect(result.exitCode).toBe(0);
    expect(stored()[canonicalDir(web)]).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      },
    });
    // The ancestor's own record is untouched.
    expect(readProjectEntry(repo, cacheDir)?.env.FORMIO_BASE_URL).toBe('https://api.mysite.com');
  });

  it('project_set restating the pair its ancestor maps changes nothing and names the ancestor', async () => {
    // The tool writes the default map, which setup.ts places under a per-worker HOME.
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: 'https://repo.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
    });
    const client = await connectTools((server) => registerProjectSetTool(server));

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://repo.form.io', cwd: web },
    });

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toMatchObject({ changed: false });
    expect(JSON.stringify(result.content)).toContain(
      `inherited from the mapping for ${canonicalDir(repo)}`
    );
    expect(findProjectEntry({ cwd: web })?.dir).toBe(canonicalDir(repo));
  });

  it('project_set records the subdirectory itself for a different project', async () => {
    writeProjectEntry({ cwd: repo, ...entryFor('https://repo.form.io') });
    const client = await connectTools((server) => registerProjectSetTool(server));

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://web.form.io', cwd: web },
    });

    expect(result.isError ?? false).toBe(false);
    expect(findProjectEntry({ cwd: web })?.dir).toBe(canonicalDir(web));
  });

  it('gives two workspace roots under one mapped ancestor the same record', () => {
    writeProjectEntry({ cwd: repo, ...entryFor('https://repo.form.io') });
    const api = path.join(repo, 'apps', 'api');
    fs.mkdirSync(api);

    const first = projectRecordOf(web);
    const second = projectRecordOf(api);

    expect(first).toBeDefined();
    expect(first?.key).toBe(second?.key);
  });
});
