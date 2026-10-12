import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  canonicalDir,
  dirMatchKey,
  findProjectEntry,
  readProjectEntry,
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
// Windows. The canonical path keeps its true case — it is what is stored and shown —
// and only the comparison key folds case, where the filesystem folds it.
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

  it('folds case in the comparison key on darwin and win32 only', () => {
    expect(dirMatchKey('/work/Repo/', 'darwin')).toBe('/work/repo');
    expect(dirMatchKey('/c/Users/Me/app', 'win32')).toBe('c:\\users\\me\\app');
    expect(dirMatchKey('C:\\Users\\Me\\app', 'win32')).toBe('c:\\users\\me\\app');
    expect(dirMatchKey('/work/Repo', 'linux')).toBe('/work/Repo');
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

  it('`project set` records the subdirectory itself, even for the project its ancestor maps', () => {
    run(['set', '--project-url', 'https://repo.form.io', '--cwd', repo]);

    const result = run(['set', '--project-url', 'https://repo.form.io', '--cwd', web]);

    expect(result.exitCode).toBe(0);
    expect(Object.keys(stored()).sort()).toEqual([canonicalDir(repo), canonicalDir(web)].sort());
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

  it('project_set records the subdirectory itself, even for the project its ancestor maps', async () => {
    // The tool writes the default map, which setup.ts places under a per-worker HOME.
    writeProjectEntry({ cwd: repo, ...entryFor('https://repo.form.io') });
    const client = await connectTools((server) => registerProjectSetTool(server));

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://repo.form.io', cwd: web },
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
