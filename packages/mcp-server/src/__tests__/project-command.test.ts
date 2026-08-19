import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';
import { isProjectCommand, runProjectCommand } from '../cli/project-command.js';

// The bin gains a `project` command so a working directory can be mapped to a
// Form.io project before any MCP client has connected. Every case here drives
// an isolated cache dir — the command must never be hard-wired to ~/.formio.
describe('project command', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-project-cli-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  describe('dispatch', () => {
    it('claims a project invocation', () => {
      expect(isProjectCommand(['project', 'set', '--project-url', 'https://x.form.io'])).toBe(true);
      expect(isProjectCommand(['project', 'get'])).toBe(true);
    });

    it('does not claim an empty argument list', () => {
      expect(isProjectCommand([])).toBe(false);
    });
  });

  describe('project set', () => {
    it('writes the mapping the server reads', () => {
      const result = runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          'https://x.form.io',
          '--base-url',
          'https://api.form.io',
          '--cwd',
          '/abs/path',
        ],
        { cacheDir }
      );

      expect(result.exitCode).toBe(0);
      expect(readProjectEntry('/abs/path', cacheDir)).toEqual({
        env: {
          FORMIO_PROJECT_URL: 'https://x.form.io',
          FORMIO_BASE_URL: 'https://api.form.io',
        },
      });
    });

    it('writes the mapping file with owner-only permissions', () => {
      runProjectCommand(
        ['project', 'set', '--project-url', 'https://x.form.io', '--cwd', '/abs/path'],
        { cacheDir }
      );

      const mode = fs.statSync(path.join(cacheDir, 'projects.json')).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('preserves mappings for other working directories', () => {
      writeProjectEntry('/other/path', { FORMIO_PROJECT_URL: 'https://other.form.io' }, cacheDir);

      runProjectCommand(
        ['project', 'set', '--project-url', 'https://x.form.io', '--cwd', '/abs/path'],
        { cacheDir }
      );

      expect(readProjectEntry('/other/path', cacheDir)).toEqual({
        env: { FORMIO_PROJECT_URL: 'https://other.form.io' },
      });
    });

    it('keys the mapping on the absolute process cwd when --cwd is omitted', () => {
      const result = runProjectCommand(['project', 'set', '--project-url', 'https://x.form.io'], {
        cacheDir,
        cwd: '/default/cwd',
      });

      expect(result.exitCode).toBe(0);
      expect(readProjectEntry('/default/cwd', cacheDir)?.env.FORMIO_PROJECT_URL).toBe(
        'https://x.form.io'
      );
    });

    // The global applies to the one shape that derives nothing: a path-less
    // project URL on a customer domain, whose deployment is a sibling sub-domain.
    it('falls back to FORMIO_BASE_URL from the environment when the shape derives none', () => {
      runProjectCommand(
        ['project', 'set', '--project-url', 'https://myproject.mysite.com', '--cwd', '/abs/path'],
        { cacheDir, env: { FORMIO_BASE_URL: 'https://forms.mysite.com' } }
      );

      expect(readProjectEntry('/abs/path', cacheDir)?.env.FORMIO_BASE_URL).toBe(
        'https://forms.mysite.com'
      );
    });

    // One global answering a per-project question. Where the project URL derives
    // its own deployment, persisting the global replaces a correct per-project
    // answer with a stale one that then outranks derivation for this directory
    // forever.
    it('does not persist the env global over a base URL the project URL derives', () => {
      runProjectCommand(
        ['project', 'set', '--project-url', 'https://forms.mysite.com/app', '--cwd', '/abs/path'],
        { cacheDir, env: { FORMIO_BASE_URL: 'https://api.form.io' } }
      );

      expect(readProjectEntry('/abs/path', cacheDir)).toEqual({
        env: { FORMIO_PROJECT_URL: 'https://forms.mysite.com/app' },
      });
    });

    // The terminal running the CLI is not the process the MCP server was
    // launched in, so FORMIO_BASE_URL is usually absent there. Dropping the
    // mapped base URL on a re-set would silently point a self-hosted directory
    // back at api.form.io — the wrong-deployment login this whole mapping exists
    // to prevent.
    it('keeps the mapped base URL when --base-url and the environment supply none', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://old.forms.acme.com/old',
          FORMIO_BASE_URL: 'https://forms.acme.com',
        },
        cacheDir
      );

      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://forms.acme.com/new', '--cwd', '/abs/path'],
        { cacheDir, env: {} }
      );

      expect(result.exitCode).toBe(0);
      expect(readProjectEntry('/abs/path', cacheDir)).toEqual({
        env: {
          FORMIO_PROJECT_URL: 'https://forms.acme.com/new',
          FORMIO_BASE_URL: 'https://forms.acme.com',
        },
      });
      expect(result.stdout).toContain('https://forms.acme.com');
    });

    // An empty environment value is how a host passes a prompt the user cleared,
    // and it is falsy on the very next line — so a nullish fallback hands the
    // rewrite an empty string and the mapped base URL disappears anyway. Same
    // deployment-revert as above, reached by the empty-value route.
    it('keeps the mapped base URL when FORMIO_BASE_URL is set but empty', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://forms.acme.com/old',
          FORMIO_BASE_URL: 'https://forms.acme.com',
        },
        cacheDir
      );

      runProjectCommand(
        ['project', 'set', '--project-url', 'https://forms.acme.com/new', '--cwd', '/abs/path'],
        { cacheDir, env: { FORMIO_BASE_URL: '' } }
      );

      expect(readProjectEntry('/abs/path', cacheDir)?.env.FORMIO_BASE_URL).toBe(
        'https://forms.acme.com'
      );
    });

    // Same precedence as the project_set tool, deliberately: --base-url, then
    // the mapping, then the environment. A shell that does export FORMIO_BASE_URL
    // must not re-point a mapped self-hosted directory at the global value.
    it('prefers the mapped base URL over FORMIO_BASE_URL from the environment', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://forms.acme.com/old',
          FORMIO_BASE_URL: 'https://forms.acme.com',
        },
        cacheDir
      );

      runProjectCommand(
        ['project', 'set', '--project-url', 'https://forms.acme.com/new', '--cwd', '/abs/path'],
        { cacheDir, env: { FORMIO_BASE_URL: 'https://api.form.io' } }
      );

      expect(readProjectEntry('/abs/path', cacheDir)?.env.FORMIO_BASE_URL).toBe(
        'https://forms.acme.com'
      );
    });

    it('lets an explicit --base-url replace the mapped one', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://old.forms.acme.com/old',
          FORMIO_BASE_URL: 'https://forms.acme.com',
        },
        cacheDir
      );

      runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          'https://x.form.io',
          '--base-url',
          'https://api.form.io',
          '--cwd',
          '/abs/path',
        ],
        { cacheDir, env: {} }
      );

      expect(readProjectEntry('/abs/path', cacheDir)?.env.FORMIO_BASE_URL).toBe(
        'https://api.form.io'
      );
    });

    it('strips trailing slashes from both URLs', () => {
      runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          'https://x.form.io/',
          '--base-url',
          'https://api.form.io/',
          '--cwd',
          '/abs/path',
        ],
        { cacheDir }
      );

      expect(readProjectEntry('/abs/path', cacheDir)).toEqual({
        env: {
          FORMIO_PROJECT_URL: 'https://x.form.io',
          FORMIO_BASE_URL: 'https://api.form.io',
        },
      });
    });

    // The shell this runs in is whatever the agent inherited, and a client that
    // exports FORMIO_BASE_URL from an unexpanded manifest variable exports the
    // literal. Failing the command on it makes `project set --project-url …` —
    // the exact line formio-mcp-setup runs — unusable for a user who supplied no
    // base URL of their own.
    it('ignores an unusable FORMIO_BASE_URL from the environment instead of failing', () => {
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://x.form.io', '--cwd', '/abs/path'],
        { cacheDir, env: { FORMIO_BASE_URL: '${FORMIO_BASE_URL}' } }
      );

      expect(result.exitCode).toBe(0);
      expect(readProjectEntry('/abs/path', cacheDir)).toEqual({
        env: { FORMIO_PROJECT_URL: 'https://x.form.io' },
      });
    });

    // An explicit flag is the user's own typing, so it is still an error.
    it('still rejects an unusable --base-url', () => {
      const result = runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          'https://x.form.io',
          '--base-url',
          'not-a-url',
          '--cwd',
          '/abs/path',
        ],
        { cacheDir, env: {} }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('baseUrl');
    });

    it('trims surrounding whitespace from the URLs it persists', () => {
      runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          ' https://x.form.io ',
          '--base-url',
          ' https://api.form.io ',
          '--cwd',
          '/abs/path',
        ],
        { cacheDir, env: {} }
      );

      expect(readProjectEntry('/abs/path', cacheDir)).toEqual({
        env: {
          FORMIO_PROJECT_URL: 'https://x.form.io',
          FORMIO_BASE_URL: 'https://api.form.io',
        },
      });
    });

    it('rejects a malformed project URL, naming the argument and the value', () => {
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'not-a-url', '--cwd', '/abs/path'],
        { cacheDir }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('projectUrl');
      expect(result.stderr).toContain('not-a-url');
      expect(fs.existsSync(path.join(cacheDir, 'projects.json'))).toBe(false);
    });

    it('rejects a non-http protocol', () => {
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'ftp://x.form.io', '--cwd', '/abs/path'],
        { cacheDir }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('projectUrl');
    });

    it('rejects a relative --cwd', () => {
      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://x.form.io', '--cwd', 'relative/path'],
        { cacheDir }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('absolute');
    });

    it('requires --project-url', () => {
      const result = runProjectCommand(['project', 'set', '--cwd', '/abs/path'], { cacheDir });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--project-url');
    });

    // A stored value is not the user's typing, and this rewrite is the documented
    // repair for a directory whose mapping is unusable. Failing on it left the
    // repair reporting the very error it was run to clear, with nothing saying the
    // value came from the map rather than from the command line.
    it('repairs a directory whose mapped base URL is not a URL', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://old.form.io',
          FORMIO_BASE_URL: 'forms.mysite.com',
        },
        cacheDir
      );

      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://new.form.io', '--cwd', '/abs/path'],
        { cacheDir, env: {} }
      );

      expect(result.exitCode).toBe(0);
      expect(readProjectEntry('/abs/path', cacheDir)).toEqual({
        env: { FORMIO_PROJECT_URL: 'https://new.form.io' },
      });
      expect(result.stderr).toContain('FORMIO_BASE_URL');
    });

    it('lets --base-url replace an unusable mapped base URL', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://old.form.io',
          FORMIO_BASE_URL: 'forms.mysite.com',
        },
        cacheDir
      );

      const result = runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          'https://myproject.mysite.com',
          '--base-url',
          'https://forms.mysite.com',
          '--cwd',
          '/abs/path',
        ],
        { cacheDir, env: {} }
      );

      expect(result.exitCode).toBe(0);
      expect(readProjectEntry('/abs/path', cacheDir)?.env.FORMIO_BASE_URL).toBe(
        'https://forms.mysite.com'
      );
    });
  });

  describe('project get', () => {
    it('reports the mapping as the winning source', () => {
      writeProjectEntry(
        '/abs/path',
        { FORMIO_PROJECT_URL: 'https://mapped.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
        cacheDir
      );

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('https://mapped.form.io');
      expect(result.stdout).toContain('https://api.form.io');
      expect(result.stdout).toContain('mapping');
    });

    // The mapping now outranks the environment, and the losing environment value
    // is REPORTED rather than dropped — otherwise "my FORMIO_PROJECT_URL is being
    // ignored" has no answer in this output.
    it('reports the mapping as the winner and the environment as shadowed', () => {
      writeProjectEntry('/abs/path', { FORMIO_PROJECT_URL: 'https://mapped.form.io' }, cacheDir);

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {
          FORMIO_PROJECT_URL: 'https://pinned.form.io',
          FORMIO_BASE_URL: 'https://api.form.io',
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('https://mapped.form.io');
      expect(result.stdout).toMatch(/Shadowed:/);
      expect(result.stdout).toContain('https://pinned.form.io');
    });

    // Exit 0 printing an unusable value is the worst of the three outcomes: the
    // caller reports it as the answer, and every request that follows dies inside
    // fetch with no mention of the file the value came from. This is a failure to
    // answer, not an answer of "nothing here", so it must not land on the
    // interview path either.
    it('exits 2 rather than reporting a malformed mapped URL as the answer', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://mapped.form.io',
          FORMIO_BASE_URL: 'forms.mysite.com',
        },
        cacheDir
      );

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {},
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('FORMIO_BASE_URL');
      expect(result.stderr).toContain('/abs/path');
    });

    it('exits non-zero and names project set when nothing is configured', () => {
      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/unmapped'], {
        cacheDir,
        env: {},
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('project set');
    });

    // "Nothing is mapped here" is an answer; "this command could not run" is not.
    // Collapsing both into exit 1 is what makes a caller interview the user and
    // then call project_set, which fails again for the same unreported reason —
    // an interview-then-error loop that never names the cause. Exit 1 is the
    // answer, exit 2 is the failure, and the skills branch on the difference.
    it('exits 1 for an unmapped directory and 2 for a command failure', () => {
      const unmapped = runProjectCommand(['project', 'get', '--cwd', '/abs/unmapped'], {
        cacheDir,
        env: {},
      });

      expect(unmapped.exitCode).toBe(1);

      fs.writeFileSync(path.join(cacheDir, 'projects.json'), '{"/abs/path": {"env"');
      const unreadable = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {},
      });

      expect(unreadable.exitCode).toBe(2);
      expect(unreadable.stderr).toContain('projects.json');
    });

    // The offering variable is gone. A caller with nothing mapped is told what is
    // missing and which command supplies it — not handed a value to accept, which
    // is a value an agent may persist instead of asking.
    it('offers no suggested project when nothing is mapped', () => {
      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/unmapped'], {
        cacheDir,
        env: { FORMIO_DEFAULT_PROJECT_URL: 'https://suggested.form.io' },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).not.toContain('https://suggested.form.io');
      expect(result.stderr).toContain('project set');
    });

    it('says nothing about a default when none is configured', () => {
      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/unmapped'], {
        cacheDir,
        env: {},
      });

      expect(result.stderr).not.toContain('FORMIO_DEFAULT_PROJECT_URL');
    });

    // Both halves came from the environment, but from *different* variables, and
    // the collapsed one-line form named only FORMIO_PROJECT_URL — crediting the
    // base URL to the variable that did not supply it. the skills tell the
    // agent to branch on exactly that attribution.
    it('names both variables when the environment supplied the project and the base URL', () => {
      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {
          FORMIO_PROJECT_URL: 'https://pinned.form.io',
          FORMIO_BASE_URL: 'https://forms.acme.com',
        },
      });

      expect(result.stdout).toContain('FORMIO_PROJECT_URL');
      expect(result.stdout).toContain('FORMIO_BASE_URL');
    });

    it('still collapses to one clause when a single source supplied both', () => {
      writeProjectEntry(
        '/abs/path',
        { FORMIO_PROJECT_URL: 'https://mapped.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
        cacheDir
      );

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {},
      });

      expect(result.stdout).not.toMatch(/project URL from/);
      expect(result.stdout).toMatch(/Source: {6}the working-directory mapping/);
    });

    it('exits 2 rather than 1 for a relative --cwd, which maps nothing either way', () => {
      const result = runProjectCommand(['project', 'get', '--cwd', 'relative/path'], {
        cacheDir,
        env: {},
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('absolute');
    });

    // This command runs in the agent's shell, not in the MCP server's process.
    // A plugin-launched server carries its own env block, so reporting the
    // mapping as the resolved truth would be a claim this command cannot make.
    it('says the server environment is not visible when the mapping won', () => {
      writeProjectEntry('/abs/path', { FORMIO_PROJECT_URL: 'https://mapped.form.io' }, cacheDir);

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {},
      });

      expect(result.stdout).toMatch(/not visible|this shell/i);
      expect(result.stdout).toContain('FORMIO_PROJECT_URL');
    });

    // The caveat says the server's env block is INVISIBLE from this shell — true,
    // and the whole reason it exists. It used to add that a FORMIO_PROJECT_URL
    // set there "takes precedence over this mapping", which is the pre-reorder
    // model: the environment is the weakest source, so an invisible value there
    // cannot change this answer. Reading that line, an agent abandons the
    // project_set repair that would have worked.
    it('does not claim an invisible environment outranks the mapping', () => {
      writeProjectEntry('/abs/path', { FORMIO_PROJECT_URL: 'https://mapped.form.io' }, cacheDir);

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {},
      });

      expect(result.stdout).not.toMatch(/takes precedence over this mapping/i);
      expect(result.stdout).toMatch(/cannot override this mapping|weakest/i);
    });

    // Shadowing is reported for the project URL; the base URL needs it for the
    // same reason. A mapped deployment silently overriding a committed one is
    // otherwise invisible, and "my formio.json baseUrl did nothing" has no answer
    // in this output.
    it('reports a shadowed base URL, not only a shadowed project URL', () => {
      const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-shadow-base-'));
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(repo, 'formio.json'),
        JSON.stringify({
          projectUrl: 'https://myproject.mysite.com',
          baseUrl: 'https://committed.mysite.com',
        })
      );
      writeProjectEntry(repo, { FORMIO_BASE_URL: 'https://mapped.mysite.com' }, cacheDir);

      const result = runProjectCommand(['project', 'get', '--cwd', repo], {
        cacheDir,
        env: { FORMIO_BASE_URL: 'https://env.mysite.com' },
      });

      expect(result.stdout).toContain('Base URL:    https://committed.mysite.com');
      expect(result.stdout).toContain('https://mapped.mysite.com');
      expect(result.stdout).toContain('https://env.mysite.com');
      fs.rmSync(repo, { recursive: true, force: true });
    });

    // The unresolved-base-URL branch is the one place a dropped FORMIO_BASE_URL
    // explains the failure, so losing the note there hides the cause of the very
    // error being reported.
    it('keeps the ignored-variable note on the unresolved-base-URL branch', () => {
      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {
          FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
          FORMIO_BASE_URL: '${FORMIO_BASE_URL}',
        },
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toMatch(/could not be determined/);
      expect(result.stderr).toMatch(/Ignoring FORMIO_BASE_URL/);
    });

    it('omits the caveat when the environment this command can see already pins the project', () => {
      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: { FORMIO_PROJECT_URL: 'https://pinned.form.io' },
      });

      expect(result.stdout).not.toMatch(/not visible/i);
    });

    // This command's whole purpose is to print what resolves and which source
    // won, so it has to read the environment exactly as the server does. The
    // server drops an unusable value and falls through to the mapping; printing
    // the literal here and calling it the winning source describes a server that
    // does not exist.
    it('drops an unusable FORMIO_PROJECT_URL and reports the mapping, as the server does', () => {
      writeProjectEntry(
        '/abs/path',
        { FORMIO_PROJECT_URL: 'https://mapped.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
        cacheDir
      );

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: { FORMIO_PROJECT_URL: '${FORMIO_PROJECT_URL}' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('https://mapped.form.io');
      expect(result.stdout).not.toContain('${FORMIO_PROJECT_URL}');
      expect(result.stdout).toContain('mapping');
    });

    // Every outcome of this command travels in the result object — that is why
    // env, cwd and cacheDir are injected. A note written straight to
    // process.stderr would be the one part no caller can see.
    it('returns the dropped-value note in stderr rather than writing it out of band', () => {
      writeProjectEntry('/abs/path', { FORMIO_PROJECT_URL: 'https://mapped.form.io' }, cacheDir);

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: { FORMIO_PROJECT_URL: '${FORMIO_PROJECT_URL}' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('FORMIO_PROJECT_URL');
      expect(result.stdout).not.toContain('Ignoring');
    });

    // The base URL resolves on its own terms, so a pinned project paired with a
    // mapped base URL has two answers. One Source: line naming only the project's
    // origin attributes the other value to a place it did not come from.
    // Both halves now come from the mapping, so one clause says everything — the
    // split-clause case was an artifact of the two halves resolving in opposite
    // directions.
    it('collapses to one clause when both halves come from the mapping', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
          FORMIO_BASE_URL: 'https://forms.mysite.com',
        },
        cacheDir
      );

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      });

      expect(result.stdout).toContain('Base URL:    https://forms.mysite.com');
      expect(result.stdout).toMatch(/Source:.*working-directory mapping/);
      expect(result.stdout).toMatch(/not visible/);
    });

    // Provenance comes from the resolver, not from comparing the printed value
    // against the mapping. Here the resolver refused to lend the mapped base URL
    // to a different pinned project and applied the default — which happens to be
    // the string the mapping holds, so a value comparison credits the mapping for
    // a value it never supplied, and keeps a caveat about a mapping nothing read.
    it('does not credit the mapping for a default that merely matches it', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://proj-a.mysite.com',
          FORMIO_BASE_URL: 'https://api.form.io',
        },
        cacheDir
      );

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: { FORMIO_PROJECT_URL: 'https://examples.form.io' },
      });

      // The mapping supplies both halves now, so its own api.form.io IS the
      // answer rather than a default that happens to match.
      expect(result.stdout).toContain('Base URL:    https://api.form.io');
      expect(result.stdout).toMatch(/Source:.*working-directory mapping/);
      expect(result.stdout).toMatch(/not visible/);
    });

    it('names the project URL as the base URL’s source when nothing supplied one', () => {
      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: { FORMIO_PROJECT_URL: 'https://pinned.form.io' },
      });

      expect(result.stdout).toContain('Base URL:    https://api.form.io');
      // Derived, not defaulted: api.form.io is the one deployment whose base URL is
      // a constant, so naming it from a form.io host reads it off the project URL.
      expect(result.stdout).toMatch(/base URL from the project URL it was derived from/);
      expect(result.stdout).not.toMatch(/the default/);
      expect(result.stdout).not.toMatch(/not visible/);
    });

    it('drops an unusable FORMIO_BASE_URL and reports the mapped deployment', () => {
      writeProjectEntry(
        '/abs/path',
        {
          FORMIO_PROJECT_URL: 'https://forms.acme.com/app',
          FORMIO_BASE_URL: 'https://forms.acme.com',
        },
        cacheDir
      );

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: { FORMIO_BASE_URL: '${FORMIO_BASE_URL}' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('https://forms.acme.com');
      expect(result.stdout).not.toContain('${FORMIO_BASE_URL}');
    });

    // Reporting a corrupt map as "nothing configured" sends the caller to
    // project set, which used to rewrite the file and lose every other mapping.
    it('reports an unreadable map instead of nothing configured', () => {
      fs.writeFileSync(path.join(cacheDir, 'projects.json'), '{"/abs/path": {"env"');

      const result = runProjectCommand(['project', 'get', '--cwd', '/abs/path'], {
        cacheDir,
        env: {},
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('projects.json');
      expect(result.stderr).not.toContain('No Form.io project is configured');
    });
  });

  describe('unknown input', () => {
    it('exits non-zero on an unknown subcommand', () => {
      const result = runProjectCommand(['project', 'frobnicate'], { cacheDir });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('frobnicate');
    });

    it('exits 2 on a usage error, leaving 1 to mean "nothing is mapped"', () => {
      const unknown = runProjectCommand(['project', 'frobnicate'], { cacheDir });
      const missingFlag = runProjectCommand(['project', 'set', '--cwd', '/abs/path'], { cacheDir });

      expect(unknown.exitCode).toBe(2);
      expect(missingFlag.exitCode).toBe(2);
    });
  });
});
