import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_CLI } from '../cli-launch.js';
import { runProjectCommand } from '../cli/project-command.js';
import { requireBaseUrl, resolveProject } from '../project-resolver.js';
import { writeProjectEntry } from '../project-map.js';

vi.mock('../revisions/browser-prompts.js', () => ({
  requestRevisionsLicenseConsent: vi.fn(),
}));

import { gateRevisionsLicense } from '../revisions/license.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// The rule every message on this surface obeys, shared by every describe below
// because it binds them all, whichever record the message is about.
const runnable = (message: string) => {
  expect(message).toContain(`${PROJECT_CLI} set`);
  // The bin spelling, and only it. `@formio/mcp@0.10.0 project set` contains no
  // `formio-mcp project`, so this catches a reintroduced bare-bin command
  // without matching the package name inside the npx launch.
  expect(message).not.toMatch(/(^|\s)formio-mcp project/);
  expect(message).not.toContain('--cwd <cwd>');
};

// Every message on this surface names its remedy as a runnable command, and the
// command it named was `formio-mcp project set ...`. `formio-mcp` is this
// package's bin, and nothing on the documented install route puts it on PATH: the
// plugin launches the server through npx and every skill invokes it as
// `npx -y @formio/mcp@<version> project get`. An agent told to "run the command
// the error names" got `command not found`, with no fallback in the message.
//
// The second half of the same defect: two of those messages printed a literal
// `--cwd <cwd>`, because the resolved config carried no directory. A command with
// an unfilled placeholder is not a command either.
describe('the commands these messages print', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-remedy-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-remedy-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('names a runnable one when no project is configured', () => {
    const message = (() => {
      try {
        resolveProject(repo, {}, { cacheDir, onNote: () => {} });
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      throw new Error('expected resolution to fail');
    })();

    runnable(message);
    expect(message).toContain(`--cwd ${repo}`);
  });

  it('names a runnable one when the base URL cannot be determined', () => {
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      cacheDir: cacheDir,
    });
    const { config } = resolveProject(repo, {}, { cacheDir, onNote: () => {} });

    const message = (() => {
      try {
        requireBaseUrl(config);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      throw new Error('expected requireBaseUrl to reject');
    })();

    runnable(message);
    // The directory the answer belongs to, not a placeholder: resolution is the
    // only step that knows it, so it travels on the resolved config.
    expect(message).toContain(`--cwd ${repo}`);
  });

  it('names a runnable one from the revisions license gate', async () => {
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      cacheDir: cacheDir,
    });
    const { config } = resolveProject(repo, { apiKey: 'secret' }, { cacheDir, onNote: () => {} });

    const message = await (async () => {
      try {
        await gateRevisionsLicense({} as McpServer, config, {
          actionLabel: 'publish',
          requiresRevisions: true,
          form: { title: 'Contact' },
        });
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      throw new Error('expected the gate to reject');
    })();

    runnable(message);
    expect(message).toContain(`--cwd ${repo}`);
  });

  it('prints runnable usage', () => {
    const result = runProjectCommand(['project', 'nonsense'], { cacheDir, env: {}, cwd: repo });

    expect(result.stderr).toContain(`${PROJECT_CLI} set`);
    expect(result.stderr).toContain(`${PROJECT_CLI} get`);
    expect(result.stderr).not.toMatch(/(^|\s)formio-mcp project/);
  });

  it('prints runnable remedies from an unconfigured project get', () => {
    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    expect(result.exitCode).toBe(1);
    runnable(result.stderr);
  });

  it('prints a runnable remedy from a half-configured project get', () => {
    writeProjectEntry({
      cwd: repo,
      env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      cacheDir: cacheDir,
    });

    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    expect(result.exitCode).toBe(3);
    runnable(result.stderr);
  });
});

// An "Ignoring FORMIO_PROJECT_URL: ..." note is often the CAUSE of "nothing is
// configured" — a host that never expanded its manifest variable — and exit 1
// dropped it while exit 3 deliberately kept it. The user read that nothing was
// configured for a directory whose configuration had just been discarded unread.
describe('what an unconfigured project get reports', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-notes-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-notes-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('keeps the note about the variable it discarded', () => {
    const result = runProjectCommand(['project', 'get', '--cwd', repo], {
      cacheDir,
      env: { FORMIO_PROJECT_URL: '${FORMIO_PROJECT_URL}' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Ignoring FORMIO_PROJECT_URL');
    expect(result.stderr).toContain('No Form.io project is configured');
  });
});

// The two "a record exists and cannot be used" errors are the ones every skill
// answers by relaying and stopping, so what they name is the whole of the user's
// next move. The map's error already named a remedy; the committed file's named
// none — "fix that file" — even though one command repairs every one of its cases
// in place, keeping the keys the file can still be read for.
describe('the record-is-broken messages', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-broken-record-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const getMessage = (contents: string): string => {
    fs.writeFileSync(path.join(repo, 'formio.json'), contents);
    const result = runProjectCommand(['project', 'get', '--cwd', repo], {
      cacheDir: repo,
      env: {},
    });
    expect(result.exitCode).toBe(2);
    return result.stderr;
  };

  // The repair is an edit to the file itself — this server never writes a committed
  // file — so the message names the exact path and says what a usable file holds.
  // One vocabulary serves both readers: a human with an editor and an agent with file
  // tools both act on "put {"projectUrl": ...} in this file".
  it('names the file and the shape of a usable one, for a file holding no projectUrl', () => {
    const message = getMessage(JSON.stringify({ baseUrl: 'https://api.mysite.com' }));

    expect(message).toContain(path.join(repo, 'formio.json'));
    expect(message).toContain('"projectUrl"');
  });

  it('names the same repair for a committed file that will not parse', () => {
    const message = getMessage('{ not json');

    expect(message).toContain(path.join(repo, 'formio.json'));
    expect(message).toContain('"projectUrl"');
  });

  it('says the repair overwrites, so it is not run unasked', () => {
    const message = getMessage('{ not json');

    expect(message).toMatch(/ask the user/i);
  });
});

// The map's own error named `project_set` and nothing else. It is also the message
// a SHELL reader gets out of `project get` — and formio-mcp-setup, the one skill
// that runs that command, runs before any tool exists to call. Both vocabularies,
// and the directory each one takes, or half the readers cannot act on it.
describe('the unreadable-map message', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-badmap-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-badmap-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const write = (contents: string) =>
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), contents);

  it('names a runnable repair when the file itself cannot be read', () => {
    write('[]');

    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    expect(result.exitCode).toBe(2);
    runnable(result.stderr);
    expect(result.stderr).toContain(`--cwd ${repo}`);
    expect(result.stderr).toContain('project_set');
  });

  it('names the same repair when one entry cannot be read', () => {
    write(JSON.stringify({ [repo]: 'oops' }));

    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    expect(result.exitCode).toBe(2);
    runnable(result.stderr);
    expect(result.stderr).toContain(`--cwd ${repo}`);
  });

  it('names it when the entry holds a URL that is not one', () => {
    write(JSON.stringify({ [repo]: { env: { FORMIO_PROJECT_URL: 'notaurl' } } }));

    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    expect(result.exitCode).toBe(2);
    runnable(result.stderr);
    expect(result.stderr).toContain(`--cwd ${repo}`);
  });
});

// `fail()` takes notes for the same reason the other outcomes do — an "Ignoring
// FORMIO_PROJECT_URL: ..." note is often the CAUSE — but the could-not-answer path
// threw past the collected notes and reported the map error alone. The variable a
// host never expanded is exactly the launch most likely to ALSO have an unreadable
// map, and that reader was shown the second problem and not the first.
describe('what a could-not-answer project get reports', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-failnotes-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-failnotes-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), '[]');
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('keeps the note about the variable it discarded', () => {
    const result = runProjectCommand(['project', 'get', '--cwd', repo], {
      cacheDir,
      env: { FORMIO_PROJECT_URL: '${FORMIO_PROJECT_URL}' },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Cannot read the Form.io project map');
    expect(result.stderr).toContain('Ignoring FORMIO_PROJECT_URL');
  });
});

// Nothing can write a file that cannot be read, so the map's error names a repair
// FIRST and its command second. Printed the other way round it read as a remedy, and
// running it answered with the identical error — the failure this whole class of
// message exists to avoid.
describe('the unreadable-map message orders its two steps', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-order-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-order-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    // Damage to the FILE, which no writer can reach past — the case whose first step
    // really is manual. Entry-level damage is repaired by the write itself and says so.
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), 'not json at all');
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('says the file is repaired or deleted before anything else', () => {
    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/FIRST/);
    expect(result.stderr).toMatch(/nothing below will run until it is/i);
  });

  it('still names the command for the step that follows', () => {
    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    runnable(result.stderr);
    expect(result.stderr).toContain(`--cwd ${repo}`);
  });
});
