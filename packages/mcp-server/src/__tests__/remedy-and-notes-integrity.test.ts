import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runProjectCommand } from '../cli/project-command.js';
import { planProjectEntry } from '../project-entry-plan.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

interface Report {
  status: string;
  cwd: string;
  message: string;
  notes?: string[];
  remedy?: { tool: string; arguments: Record<string, string>; supply: string[] };
}

/**
 * The structured remedy is the half of the report an agent ACTS on — the schema
 * says so in as many words — so anything the message warns about that the remedy
 * does not carry is a warning the acting caller never sees.
 *
 * The sharpest case is the fallback directory. When no cwd was passed, the answer
 * is about the server's own process cwd, which for a plugin- or desktop-launched
 * server is not where the user is; the message says "call this again with cwd
 * BEFORE recording anything". A remedy carrying that same directory as an argument
 * contradicts it, and the write it names succeeds — leaving every later call, which
 * does pass the user's cwd, resolving nothing.
 */
describe('the structured remedy never names a directory the message warns against', () => {
  const serverCwd = '/workspace/server-own-directory';

  const report = async (args: Record<string, unknown>, env: NodeJS.ProcessEnv = {}) => {
    const client = await connectTools((server) =>
      registerProjectGetTool(
        server,
        { projectUrl: env.FORMIO_PROJECT_URL, baseUrl: env.FORMIO_BASE_URL },
        { cwd: () => serverCwd }
      )
    );
    const result = (await client.callTool({ name: 'project_get', arguments: args })) as unknown as {
      structuredContent: Report;
    };
    return result.structuredContent;
  };

  beforeEach(() => {
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  it('omits the remedy entirely when nothing is configured and no cwd was passed', async () => {
    const answer = await report({});

    expect(answer.status).toBe('not-configured');
    expect(answer.message).toContain('BEFORE recording anything');
    expect(answer.remedy).toBeUndefined();
  });

  it('omits it for a half-configured answer reached the same way', async () => {
    const answer = await report({}, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' });

    expect(answer.status).toBe('base-url-unresolved');
    expect(answer.message).toContain('BEFORE recording anything');
    expect(answer.remedy).toBeUndefined();
  });

  // The structured remedy is omitted; the prose that names the same call was not,
  // so the message warned "call again with the user's cwd BEFORE recording anything"
  // and then printed `project_set … cwd set to <the server's own directory>` on the
  // next line. Every gated skill relays the message's instruction, so the prose is
  // the channel that gets acted on.
  it('does not print a call naming the fallback directory either', async () => {
    for (const env of [{}, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' }]) {
      const answer = await report({}, env);

      expect(answer.message, answer.message).toContain('BEFORE recording anything');
      const instructions = answer.message
        .split('\n')
        .filter((line) => /call project_set/i.test(line) && line.includes(serverCwd));
      expect(instructions, `named the directory it warned against:\n${answer.message}`).toEqual([]);
    }
  });

  // A clause pointing at a remedy has to be gated with that remedy. Unconditional, it
  // promised "the write below" in the one message that omits every remedy and warns
  // against recording anything under this directory.
  it('promises no write "below" when there is no remedy below', async () => {
    const home = path.join(os.homedir(), '.formio');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(
      path.join(home, 'projects.json'),
      JSON.stringify({ [serverCwd]: { env: { FORMIO_BASE_URL: 'https://stranded.mysite.com' } } })
    );

    const answer = await report({}, { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' });

    expect(answer.status).toBe('base-url-unresolved');
    expect(answer.remedy).toBeUndefined();
    expect(answer.message, answer.message).not.toMatch(/\b(write|edit|command) below\b/i);
  });

  it('still carries it when the caller named the directory', async () => {
    const answer = await report({ cwd: '/workspace/named-by-caller' });

    expect(answer.status).toBe('not-configured');
    expect(answer.remedy?.arguments.cwd).toBe('/workspace/named-by-caller');
  });
});

/**
 * The tool half of the CLI's unknown-flag refusal. `scope` was removed with the
 * committed-file writer; a caller still passing it — from the previous release's
 * own documentation — must not have that write land in the machine-local mapping
 * and be told it succeeded, which is exactly what a non-strict schema does by
 * silently stripping the key.
 */
describe('project_set refuses arguments it does not take', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-strict-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  const call = async (args: Record<string, unknown>) => {
    const client = await connectTools((server) =>
      registerProjectSetTool(server, { cwd: () => repo, projectUrl: () => undefined })
    );
    return (await client.callTool({ name: 'project_set', arguments: args })) as unknown as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
  };

  it('rejects the removed scope argument rather than stripping it', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: repo, scope: 'repo' });

    expect(result.isError, result.content.map((entry) => entry.text).join('\n')).toBe(true);
    expect(fs.existsSync(path.join(os.homedir(), '.formio', 'projects.json'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'formio.json'))).toBe(false);
  });

  it('publishes a schema that forbids unknown arguments', async () => {
    const client = await connectTools((server) =>
      registerProjectSetTool(server, { cwd: () => repo, projectUrl: () => undefined })
    );
    const { tools } = await client.listTools();
    const schema = tools.find((tool) => tool.name === 'project_set')?.inputSchema as {
      additionalProperties?: boolean;
    };

    expect(schema.additionalProperties).toBe(false);
  });

  it('still accepts the arguments it does take', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: repo });

    expect(result.isError ?? false).toBe(false);
  });
});

/**
 * The `projectUrl` description told callers that omitting it updates the baseUrl
 * alone "whenever ANY source already configures a project for this cwd — a
 * committed formio.json, this directory's mapping, or FORMIO_PROJECT_URL". Two of
 * those three are refused: a deployment is recorded beside its project, and this
 * tool writes only the mapping. The schema must not instruct the call the server
 * rejects.
 */
describe('the projectUrl description matches what the writer accepts', () => {
  it('scopes the omit-it case to this directory’s own mapping', async () => {
    const client = await connectTools((server) =>
      registerProjectSetTool(server, { cwd: () => '/w', projectUrl: () => undefined })
    );
    const { tools } = await client.listTools();
    const properties = (
      tools.find((tool) => tool.name === 'project_set')?.inputSchema as {
        properties?: Record<string, { description?: string }>;
      }
    ).properties;
    const description = properties?.projectUrl?.description ?? '';

    expect(description).not.toMatch(/ANY source/);
    // Either case: the sentence emphasises the record in capitals.
    expect(description).toMatch(/mapping/i);
    // And it says what happens for the other two records, rather than implying the
    // same call works there.
    expect(description).toMatch(/committed/);
    expect(description).toMatch(/FORMIO_PROJECT_URL/);
  });
});

/**
 * What the report says about a value it did NOT use has to match why it did not use
 * it. A deployment the pair rule REJECTED was reported as "overridden by the source
 * above" — false, since nothing outranked it — and only when a committed file held
 * it; the identical rejection in the mapping or the environment appeared nowhere.
 * The note already names every rejection, in every record, so the precedence lists
 * simply must not claim it.
 */
describe('a rejected deployment is not reported as a shadowed one', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-reject-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-reject-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const get = (env: NodeJS.ProcessEnv = {}) =>
    runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env });
  const seed = (env: Record<string, string>) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [repo]: { env } }));
  };

  const REJECTED = 'https://forms.oldcorp.com';

  it.each([
    [
      'a committed file',
      () =>
        fs.writeFileSync(
          path.join(repo, 'formio.json'),
          JSON.stringify({ projectUrl: 'https://examples.form.io', baseUrl: REJECTED })
        ),
      {},
    ],
    [
      'a mapping entry',
      () => seed({ FORMIO_PROJECT_URL: 'https://examples.form.io', FORMIO_BASE_URL: REJECTED }),
      {},
    ],
    [
      'the environment',
      () => {},
      { FORMIO_PROJECT_URL: 'https://examples.form.io', FORMIO_BASE_URL: REJECTED },
    ],
  ])('names it in a note and in no precedence list: %s', (_label, setup, env) => {
    setup();

    const result = get(env);

    expect(result.exitCode, result.stderr).toBe(0);
    // The note carries it, in every record.
    expect(result.stderr).toContain(REJECTED);
    // And no line claims something outranked it.
    const claimed = result.stdout
      .split('\n')
      .filter((line) => /^(Shadowed|Unpaired):/.test(line) && line.includes(REJECTED));
    expect(claimed, `reported as outranked:\n${result.stdout}`).toEqual([]);
  });

  // Every echoed candidate is labelled when it is not a usable URL, or a stale
  // unusable value reads as a real alternative target beside a labelled sibling.
  it('labels an unusable project URL it echoes, as it already labels a base URL', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.form.io' })
    );
    seed({ FORMIO_PROJECT_URL: 'examples.form.io', FORMIO_BASE_URL: 'nope' });

    const shadowed =
      get()
        .stdout.split('\n')
        .find((line) => line.startsWith('Shadowed:')) ?? '';

    expect(shadowed).toContain('examples.form.io (not a usable URL)');
  });
});

/**
 * A record is discarded whole, so every variable in it is accounted for. The
 * api-root note named one variable where its Open-Source twin named two, and a
 * FORMIO_BASE_URL set beside a rejected project URL was then reported nowhere at all.
 */
/**
 * A refusal from the writer carries the same two things the reader's answers do: the
 * notes collected on the way, and a warning when the directory it names is the
 * server's own fallback rather than one the caller chose. Carried only on the success
 * paths, one refusal told an agent to record the pair under the server's spawn
 * directory — a write that succeeds, is read by nothing, and returns the next call to
 * this same refusal.
 */
describe('project_set refusals carry what the reader’s answers carry', () => {
  let refusalRepo: string;

  beforeEach(() => {
    refusalRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-refusal-'));
    fs.mkdirSync(path.join(refusalRepo, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => fs.rmSync(refusalRepo, { recursive: true, force: true }));

  const call = async (args: Record<string, unknown>, envProject?: string) => {
    const client = await connectTools((server) =>
      registerProjectSetTool(server, { cwd: () => refusalRepo, projectUrl: () => envProject })
    );
    const result = (await client.callTool({
      name: 'project_set',
      arguments: args,
    })) as unknown as { isError?: boolean; content: Array<{ text: string }> };
    return { isError: result.isError, text: result.content.map((entry) => entry.text).join('\n') };
  };

  it('names a formio.json the walk passed over, on the refusal path too', async () => {
    fs.writeFileSync(path.join(refusalRepo, 'formio.json'), JSON.stringify(['not', 'ours']));

    const { isError, text } = await call({ cwd: refusalRepo, baseUrl: 'https://api.mysite.com' });

    expect(isError).toBe(true);
    expect(text).toMatch(/Ignoring/);
    expect(text).toContain(path.join(refusalRepo, 'formio.json'));
  });

  it('warns when the directory it names is the server’s own, not the caller’s', async () => {
    const { isError, text } = await call(
      { baseUrl: 'https://api.mysite.com' },
      'https://myproject.mysite.com'
    );

    expect(isError).toBe(true);
    expect(text).toContain(refusalRepo);
    expect(text, text).toMatch(/BEFORE recording anything/);
  });
});

describe('a discarded environment record names every variable it loses', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-envdiscard-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-envdiscard-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('names the base URL it drops beside an API-root project URL', () => {
    const result = runProjectCommand(['project', 'get', '--cwd', repo], {
      cacheDir,
      env: {
        FORMIO_PROJECT_URL: 'https://api.form.io',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      },
    });

    // The NOTE itself has to name it, not merely some other line of the report: the
    // note is the account of what this record lost, and it is what a client showing
    // text alone displays.
    const note = result.stderr
      .split('\n')
      .find((line) => line.includes('Ignoring FORMIO_PROJECT_URL'));
    expect(note, result.stderr).toBeDefined();
    expect(note).toMatch(/FORMIO_BASE_URL/);
    expect(note).toContain('https://forms.mysite.com');
  });

  // An environment variable is not an entry any write can replace. Claiming so left
  // the user told the value was gone while it is reported again, unchanged, on every
  // later call.
  it('does not claim a write replaces an environment variable', () => {
    const result = runProjectCommand(['project', 'get', '--cwd', repo], {
      cacheDir,
      env: { FORMIO_BASE_URL: 'https://envdeploy.mysite.com' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('https://envdeploy.mysite.com');
    expect(result.stderr).toMatch(/No write can change an environment variable/);
    expect(result.stderr).not.toMatch(/replaces that entry/);
  });

  // The same account on the status that had neither list: its remedy REPLACES the
  // entry holding the value, so a value overwritten without ever being named is one
  // the user cannot get back or explain.
  it('names a stranded mapped deployment on the unconfigured answer', () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'projects.json'),
      JSON.stringify({ [repo]: { env: { FORMIO_BASE_URL: 'https://stranded.mysite.com' } } })
    );

    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('https://stranded.mysite.com');
  });
});

/**
 * The walk's own notes reach BOTH output channels. A formio.json passed over on the
 * way to an answer is reported by project_get and was silent on the write path, so a
 * caller that wrote first saw a clean success and no hint that a file they expected
 * to govern had been skipped.
 */
describe('a formio.json passed over on the walk is reported by the writer too', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-walknote-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-walknote-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ title: 'Contact', components: [] })
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('says so through the CLI', () => {
    const result = runProjectCommand(
      ['project', 'set', '--project-url', 'https://x.form.io', '--cwd', repo],
      { cacheDir, env: {} }
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/Ignoring/);
    expect(`${result.stdout}${result.stderr}`).toContain(path.join(repo, 'formio.json'));
  });

  it('says so through the tool', async () => {
    const client = await connectTools((server) =>
      registerProjectSetTool(server, { cwd: () => repo, projectUrl: () => undefined })
    );
    const result = (await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://x.form.io', cwd: repo },
    })) as unknown as { isError?: boolean; content: Array<{ text: string }> };
    const text = result.content.map((entry) => entry.text).join('\n');

    expect(result.isError ?? false).toBe(false);
    expect(text).toMatch(/Ignoring/);
    expect(text).toContain(path.join(repo, 'formio.json'));
  });
});

/**
 * Repairing a mapping entry whose stored project URL is unusable must not demand a
 * value the entry already holds. The pair rule still applies — an unusable project
 * is not a project, so its deployment cannot be silently adopted for the one being
 * recorded — but the refusal has to NAME what is sitting there, or the user is
 * asked to supply a value they can see on disk.
 */
describe('repairing an entry whose stored project is unusable', () => {
  it('names the recorded deployment in the refusal rather than hiding it', () => {
    const plan = planProjectEntry({
      cwd: '/w/app',
      requested: { projectUrl: 'https://myproject.mysite.com' },
      record: { projectUrl: 'myproject.mysite.com', baseUrl: 'https://forms.mysite.com' },
    });

    expect(plan.outcome).toBe('base-url-required');
    expect(plan.outcome === 'base-url-required' && plan.recordedBaseUrl).toBe(
      'https://forms.mysite.com'
    );
    expect(plan.outcome === 'base-url-required' && plan.unusableRecordedProjectUrl).toBe(
      'myproject.mysite.com'
    );
  });

  // Three genuinely different reasons, and the fallback was stated for all of them.
  // An entry holding a deployment and NO project has no "different project" — saying
  // so tells the user a false fact about a record they are looking at.
  it('says the entry names no project, where that is the reason', () => {
    const plan = planProjectEntry({
      cwd: '/w/app',
      requested: { projectUrl: 'https://myproject.mysite.com' },
      record: { baseUrl: 'https://forms.mysite.com' },
    });

    expect(plan.outcome).toBe('base-url-required');
    expect(plan.outcome === 'base-url-required' && plan.strandedReason).toBe('no-project');
  });

  // Moving from the hosted cloud to a self-hosted Enterprise deployment is the
  // ordinary way a directory changes deployments: the user records a NEW Project URL
  // on their own domain, which must override the SaaS pair exactly as a fresh entry
  // would. Where the new project derives its deployment that is the whole story;
  // where it does not, the refusal asks for the Base URL — and must not invite the
  // user to re-supply the stranded https://api.form.io, which cannot serve a project
  // on their own domain and is refused every time it is offered.
  describe('migrating a directory from the hosted cloud to Enterprise', () => {
    let cacheDir: string;
    let repo: string;

    beforeEach(() => {
      cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-migrate-cache-'));
      repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-migrate-repo-'));
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, 'projects.json'),
        JSON.stringify({
          [repo]: {
            env: {
              FORMIO_PROJECT_URL: 'https://myproject.form.io',
              FORMIO_BASE_URL: 'https://api.form.io',
            },
          },
        })
      );
    });

    afterEach(() => {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    });

    const set = (args: string[]) =>
      runProjectCommand(['project', 'set', ...args, '--cwd', repo], { cacheDir, env: {} });

    it('re-points to a project whose deployment derives, dropping the SaaS pair', () => {
      const result = set(['--project-url', 'https://forms.mycompany.com/myproject']);

      expect(result.exitCode, result.stderr).toBe(0);
      const after = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });
      expect(after.stdout).toContain('Base URL:    https://forms.mycompany.com');
      expect(after.stdout).not.toContain('api.form.io');
    });

    it('asks for the deployment without offering back the one that cannot serve it', () => {
      const result = set(['--project-url', 'https://myproject.mycompany.com']);

      expect(result.exitCode).toBe(1);
      // It says what is there and why it was not carried over...
      expect(result.stderr).toContain('https://api.form.io');
      // ...but never invites re-supplying it, because that is refused every time.
      expect(result.stderr).not.toMatch(/pass it explicitly to confirm it/);
    });

    it('accepts the deployment that does serve the new project', () => {
      set(['--project-url', 'https://myproject.mycompany.com']);

      const completed = set([
        '--project-url',
        'https://myproject.mycompany.com',
        '--base-url',
        'https://forms.mycompany.com',
      ]);

      expect(completed.exitCode, completed.stderr).toBe(0);
    });
  });

  // 'cannot-serve' means the pair rule REJECTS that exact value, so inviting the user
  // to "pass it explicitly to confirm it" is an instruction refused every time it is
  // followed. The invitation belongs to the reasons where re-supplying could work.
  it('does not invite re-supplying a deployment the rule rejects', () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-cannotserve-cache-'));
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-cannotserve-repo-'));
    try {
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, 'projects.json'),
        JSON.stringify({
          [repo]: {
            env: {
              FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
              FORMIO_BASE_URL: 'https://myproject.mysite.com',
            },
          },
        })
      );

      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://myproject.mysite.com', '--cwd', repo],
        { cacheDir, env: {} }
      );

      expect(result.stderr).toMatch(/cannot serve this project/);
      expect(result.stderr).not.toMatch(/pass it explicitly to confirm it/);
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('says which reason through the CLI, and never the wrong one', () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-noproj-cache-'));
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-noproj-repo-'));
    try {
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, 'projects.json'),
        JSON.stringify({ [repo]: { env: { FORMIO_BASE_URL: 'https://forms.mysite.com' } } })
      );

      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://myproject.mysite.com', '--cwd', repo],
        { cacheDir, env: {} }
      );

      expect(result.stderr).toContain('https://forms.mysite.com');
      expect(result.stderr).toMatch(/names no project/);
      expect(result.stderr).not.toMatch(/recorded for a different project/);
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('says so through the CLI, naming both the value and why it was not adopted', () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-repair-cache-'));
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-repair-repo-'));
    try {
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, 'projects.json'),
        JSON.stringify({
          [repo]: {
            env: {
              FORMIO_PROJECT_URL: 'myproject.mysite.com',
              FORMIO_BASE_URL: 'https://forms.mysite.com',
            },
          },
        })
      );

      const result = runProjectCommand(
        ['project', 'set', '--project-url', 'https://myproject.mysite.com', '--cwd', repo],
        { cacheDir, env: {} }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('https://forms.mysite.com');
      expect(result.stderr).toContain('myproject.mysite.com');
      // And running what it names completes the repair.
      const completed = runProjectCommand(
        [
          'project',
          'set',
          '--project-url',
          'https://myproject.mysite.com',
          '--base-url',
          'https://forms.mysite.com',
          '--cwd',
          repo,
        ],
        { cacheDir, env: {} }
      );
      expect(completed.exitCode, completed.stderr).toBe(0);
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

/**
 * A note is often the CAUSE of the failure it accompanies, so it has to survive the
 * failure — including the one shape where the report cannot answer at all and
 * throws. Collected inside the report and lost on the way out, the reader is left
 * with the second problem and no sight of the first.
 */
describe('notes survive a report that cannot answer', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-notes-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-notes-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
    // A stray formio.json the walk passes over — the note — above an unreadable
    // map, which is the failure.
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify({ title: 'Contact' }));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('the CLI keeps the note collected during resolution', () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), '[]');

    const result = runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Ignoring');
    expect(result.stderr).toContain(path.join(repo, 'formio.json'));
  });

  it('the tool keeps it too', async () => {
    const home = path.join(os.homedir(), '.formio');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'projects.json'), '[]');

    const client = await connectTools((server) =>
      registerProjectGetTool(server, {}, { cwd: () => repo })
    );
    const result = (await client.callTool({
      name: 'project_get',
      arguments: { cwd: repo },
    })) as unknown as { isError?: boolean; content: Array<{ text: string }> };
    const text = result.content.map((entry) => entry.text).join('\n');

    expect(result.isError).toBe(true);
    expect(text).toContain('Ignoring');
    expect(text).toContain(path.join(repo, 'formio.json'));
  });
});
