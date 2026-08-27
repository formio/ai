import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROJECT_CLI } from '../cli-launch.js';
import { runProjectCommand } from '../cli/project-command.js';
import { requireBaseUrl, resolveProject } from '../project-resolver.js';

/**
 * One property, over every message on this surface that names a command: running that
 * command, from the state that produced the message, either SUCCEEDS — or the message
 * says a manual step comes first, and then it must genuinely fail.
 *
 * Both halves matter. A command that fails while the message implies it works is the
 * defect this surface produced five times; a message that says "repair this by hand
 * first" about a command that would have worked sends the reader to delete a file that
 * holds every other directory's mapping. The disjunction pins the pair together, so a
 * message cannot drift from the command it prints in either direction.
 *
 * `printed-remedies-run.test.ts` asserts this for the REPORT. This file asserts it for
 * the errors — the auth path, the writers, and the two broken-record failures — which
 * is where the report's own vocabulary was never propagated.
 */
const ANSWERS: Record<string, string> = {
  '<project_url>': 'https://myproject.mysite.com',
  '<base_url>': 'https://api.mysite.com',
  '<url>': 'https://examples.form.io',
};

// Matched as a run of `--flag value` pairs rather than "to the end of the line":
// several of these messages are one paragraph with the command inside it, and taking
// the rest of the sentence as arguments tests the extractor instead of the message.
// EVERY command a message names. Several print two — a user-scope write and a
// repo-scope one — and testing only the first leaves half of what the message tells
// the reader to do unverified.
const commandsIn = (message: string): string[][] => {
  const found: string[][] = [];
  let from = 0;
  for (;;) {
    const start = message.indexOf(`${PROJECT_CLI} set`, from);
    if (start === -1) {
      return found;
    }
    from = start + 1;
    const tokens = message
      .slice(start + PROJECT_CLI.length)
      .split(/\s+/)
      .filter(Boolean);
    const args: string[] = ['project', 'set'];
    let index = 1;
    while (index + 1 < tokens.length && tokens[index].startsWith('--')) {
      const value = tokens[index + 1].replace(/[.,]$/, '');
      args.push(tokens[index], ANSWERS[value] ?? value);
      index += 2;
    }
    if (args.length > 2) {
      found.push(args);
    }
  }
};

// The exact wording the file-scope failure uses, case-sensitively. An `i` flag here
// matched the ordinary phrase "ask the user first" in an unrelated message and
// EXEMPTED that case from the property instead of testing it — the one message whose
// command actually dead-ended was the one excused from proving it runs.
const saysRepairFirst = (message: string) => /Repair or delete that file FIRST/.test(message);

/** The property itself, asserted for every command the message names. */
const holdsFor = (message: string, cacheDir: string, env: NodeJS.ProcessEnv = {}) => {
  const commands = commandsIn(message);
  expect(commands.length, `no command named in:\n${message}`).toBeGreaterThan(0);

  for (const command of commands) {
    const applied = runProjectCommand(command, { cacheDir, env });

    if (saysRepairFirst(message)) {
      // The message claims a human has to act first, so the command must NOT have
      // worked — otherwise it sent the reader to repair something by hand for nothing.
      expect(
        applied.exitCode,
        `the message says a manual repair comes first, but "${command.join(' ')}" ran:\n${message}`
      ).not.toBe(0);
      continue;
    }

    if (applied.exitCode === 0) {
      continue;
    }

    // Chaining is allowed for ONE reason: the refusal asks for a value the first
    // message could not have known — the deployment of a project URL the user had not
    // typed yet. Any other refusal means the message named the wrong write, and
    // rescuing it because that wrong write happens to fail helpfully is how a remedy
    // that names one command for three records passed this property unnoticed.
    expect(
      /is required/.test(applied.stderr),
      `"${command.join(' ')}" was refused for a reason this message should have known:\n${message}\n\n${applied.stderr}`
    ).toBe(true);

    const [next] = commandsIn(applied.stderr);
    expect(
      next,
      `"${command.join(' ')}" does not run from the state that produced:\n${message}\n\n${applied.stderr}`
    ).toBeDefined();

    const chained = runProjectCommand(next as string[], { cacheDir, env });
    expect(
      chained.exitCode,
      `neither "${command.join(' ')}" nor the command its refusal names runs:\n${message}\n\n${chained.stderr}`
    ).toBe(0);
  }
};

describe('a message that names a command names one that runs', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-named-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-named-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const commit = (config: Record<string, string>) =>
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify(config));

  const map = (entry: unknown) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [repo]: entry }));
  };

  const authError = (env: NodeJS.ProcessEnv = {}): string => {
    const { config } = resolveProject(
      repo,
      { projectUrl: env.FORMIO_PROJECT_URL, baseUrl: env.FORMIO_BASE_URL },
      { cacheDir, onNote: () => {} }
    );
    try {
      requireBaseUrl(config);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    throw new Error('expected requireBaseUrl to reject');
  };

  // The auth path. Every project-scoped tool raises this the first time it needs a
  // deployment, and it names a command for a caller who is nowhere near a report.
  describe('the error raised when authentication needs a deployment', () => {
    it('names a command that runs for a mapped project', () => {
      map({ env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' } });

      holdsFor(authError(), cacheDir);
    });

    // A committed project's deployment is recorded by editing the file — this server
    // never writes one — so the property here is the edit's own version of "the
    // command runs": the message names the exact file and key, and performing that
    // edit resolves the directory.
    it('names an edit that resolves for a committed project', () => {
      commit({ projectUrl: 'https://myproject.mysite.com' });

      const message = authError();
      expect(message).toContain(path.join(repo, 'formio.json'));
      expect(message).toMatch(/"baseUrl"/);

      commit({ projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' });
      const { config } = resolveProject(repo, {}, { cacheDir, onNote: () => {} });
      expect(config.baseUrl).toBe('https://api.mysite.com');
    });

    it('names a command that runs for a project from the environment', () => {
      holdsFor(authError({ FORMIO_PROJECT_URL: 'https://myproject.mysite.com' }), cacheDir);
    });
  });

  // The writers' own refusals.
  describe('the errors a write raises', () => {
    it('names a command that runs when a deployment is required', () => {
      const refused = runProjectCommand(
        ['project', 'set', '--project-url', 'https://myproject.mysite.com', '--cwd', repo],
        { cacheDir, env: {} }
      );

      expect(refused.exitCode).toBe(1);
      holdsFor(refused.stderr, cacheDir);
    });

    it('names an edit that resolves when a committed file holds the project', () => {
      commit({ projectUrl: 'https://myproject.mysite.com' });

      const refused = runProjectCommand(
        ['project', 'set', '--base-url', 'https://api.mysite.com', '--cwd', repo],
        { cacheDir, env: {} }
      );

      expect(refused.exitCode).toBe(1);
      expect(refused.stderr).toContain(path.join(repo, 'formio.json'));
      expect(refused.stderr).toMatch(/"baseUrl"/);

      commit({ projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' });
      const resolved = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });
      expect(resolved.exitCode, resolved.stderr).toBe(0);
    });
  });

  // The two "a record exists and cannot be used" failures, where the answer differs by
  // whether a writer can reach past the damage.
  describe('the errors a broken record raises', () => {
    it('holds for an entry whose URL is not a URL', () => {
      map({ env: { FORMIO_PROJECT_URL: 'notaurl' } });

      const report = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

      expect(report.exitCode).toBe(2);
      holdsFor(report.stderr, cacheDir);
    });

    it('holds for an entry that is not an entry', () => {
      map('oops');

      const report = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

      expect(report.exitCode).toBe(2);
      holdsFor(report.stderr, cacheDir);
    });

    it('holds for a map that is not a map', () => {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, 'projects.json'), '[]');

      const report = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

      expect(report.exitCode).toBe(2);
      holdsFor(report.stderr, cacheDir);
    });

    // A committed file's repair is an edit — the message says what a usable file
    // holds — so the property is that performing it resolves the directory.
    it('holds for a committed file that cannot be used', () => {
      commit({ baseUrl: 'https://api.mysite.com' });

      const report = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

      expect(report.exitCode).toBe(2);
      expect(report.stderr).toContain(path.join(repo, 'formio.json'));
      expect(report.stderr).toContain('"projectUrl"');

      commit({ projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' });
      const resolved = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });
      expect(resolved.exitCode, resolved.stderr).toBe(0);
    });
  });
});

// The Open Source refusal exists so a configuration that cannot work is caught where it
// is made. Enforced only in the two WRITERS, the state stayed reachable by the route the
// unset-project error itself recommends — hand-writing a formio.json — and by two
// environment variables, which no writer ever sees. A reader that accepts what every
// writer refuses is the same disagreement in the other direction.
describe('a deployment that is the project, arriving by a route no writer saw', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-oss-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-oss-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const get = (env: NodeJS.ProcessEnv = {}) =>
    runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env });

  it('is refused when a hand-written formio.json holds it', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({
        projectUrl: 'https://forms.mysite.com',
        baseUrl: 'https://forms.mysite.com',
      })
    );

    const result = get();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/Enterprise/);
  });

  it('is refused when the environment holds it', () => {
    const result = get({
      FORMIO_PROJECT_URL: 'https://forms.mysite.com',
      FORMIO_BASE_URL: 'https://forms.mysite.com',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/Enterprise/);
  });

  it('leaves a real pair alone', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      })
    );

    expect(get().exitCode).toBe(0);
  });
});

// The auth error reached the way a user reaches it: through a project-scoped tool, not
// by calling requireBaseUrl directly. A message tested only at its own function is
// tested one layer away from where it is read, and the layer in between is where a
// caller's actual experience is decided.
describe('the auth error a project-scoped tool raises', () => {
  let repo: string;
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-authpath-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-authpath-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const callFormList = async (env: NodeJS.ProcessEnv) => {
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { registerFormListTool } = await import('../tools/form_list.js');

    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerFormListTool(server, {
      projectUrl: env.FORMIO_PROJECT_URL,
      baseUrl: env.FORMIO_BASE_URL,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const connected = new Client({ name: 'test-client', version: '0.0.0' });
    await connected.connect(clientTransport);

    const result = (await connected.callTool({
      name: 'form_list',
      arguments: { cwd: repo },
    })) as unknown as { isError?: boolean; content: Array<{ text: string }> };
    return result.content.map((entry) => entry.text).join('\n');
  };

  it('names a runnable command for a project the environment holds', async () => {
    const message = await callFormList({ FORMIO_PROJECT_URL: 'https://myproject.mysite.com' });

    expect(message).toMatch(/Base URL/);
    holdsFor(message, cacheDir, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' });
  });

  it('names an edit that resolves for a project a committed file holds', async () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://myproject.mysite.com' })
    );

    const message = await callFormList({});

    expect(message).toMatch(/Base URL/);
    expect(message).toContain(path.join(repo, 'formio.json'));
    expect(message).toMatch(/"baseUrl"/);

    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      })
    );
    const { config } = resolveProject(repo, {}, { cacheDir, onNote: () => {} });
    expect(config.baseUrl).toBe('https://api.mysite.com');
  });
});
