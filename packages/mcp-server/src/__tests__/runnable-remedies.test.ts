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
  const runnable = (message: string) => {
    expect(message).toContain(`${PROJECT_CLI} set`);
    // The bin spelling, and only it. `@formio/mcp@0.10.0 project set` contains no
    // `formio-mcp project`, so this catches a reintroduced bare-bin command
    // without matching the package name inside the npx launch.
    expect(message).not.toMatch(/(^|\s)formio-mcp project/);
    expect(message).not.toContain('--cwd <cwd>');
  };

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
    writeProjectEntry(repo, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' }, cacheDir);
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
    writeProjectEntry(repo, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' }, cacheDir);
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
    writeProjectEntry(repo, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' }, cacheDir);

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
