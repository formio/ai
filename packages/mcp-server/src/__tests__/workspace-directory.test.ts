// The directory a call resolves against when the caller passes no `cwd`.
//
// A client spawns the server wherever it likes — a desktop app often in `/` — so the
// server's own working directory is the last resort, not the default. The order is:
// the `cwd` argument, the client's workspace roots (read with `roots/list`, and only
// from a client that declared `roots`), CLAUDE_PROJECT_DIR, then the process's own
// directory. Driven through a real SDK client over the in-memory transport, so the
// capability negotiation and the `roots/list` round trip are the SDK's own.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FormioConfig } from '../config.js';
import { ERROR_META_KEY } from '../mcp-responses.js';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';
import { registerAllTools } from '../tools/index.js';
import { ROOTS_TIMEOUT_MS, workspaceDirectory } from '../workspace-directory.js';

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, { code?: string } | undefined>;
}

const SERVER_CWD = '/workspace/server-spawn-directory';

interface ConnectOptions {
  /** Roots the client reports; omitted, the client declares no `roots` capability. */
  roots?: () => string[];
  /** Replaces the client's `roots/list` handler. */
  listRoots?: () => Promise<{ roots: Array<{ uri: string }> }>;
  rootsTimeoutMs?: number;
  /** The launch environment's configuration; none by default. */
  config?: FormioConfig;
}

interface Connected {
  client: Client;
  /** Every request method the server sent to the client. */
  sentToClient: string[];
  /** How many times the client answered `roots/list`. */
  rootsAnswered: () => number;
}

async function connect(options: ConnectOptions = {}): Promise<Connected> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  if (options.rootsTimeoutMs !== undefined) {
    workspaceDirectory(server, { rootsTimeoutMs: options.rootsTimeoutMs });
  }
  registerAllTools(server, options.config ?? {}, { cwd: () => SERVER_CWD });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const sentToClient: string[] = [];
  const send = serverTransport.send.bind(serverTransport);
  serverTransport.send = async (message, sendOptions) => {
    if ('method' in message && 'id' in message) {
      sentToClient.push(message.method);
    }
    return send(message, sendOptions);
  };
  await server.connect(serverTransport);

  const declaresRoots = options.roots !== undefined || options.listRoots !== undefined;
  const client = new Client(
    { name: 'test-client', version: '0.0.0' },
    declaresRoots ? { capabilities: { roots: { listChanged: true } } } : {}
  );
  let answered = 0;
  if (declaresRoots) {
    const roots = options.roots ?? (() => []);
    client.setRequestHandler(ListRootsRequestSchema, async () => {
      answered += 1;
      return options.listRoots
        ? options.listRoots()
        : { roots: roots().map((dir) => ({ uri: pathToFileURL(dir).href })) };
    });
  }
  await client.connect(clientTransport);
  return { client, sentToClient, rootsAnswered: () => answered };
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as unknown as ToolResult;
}

function text(result: ToolResult): string {
  return result.content.map((item) => item.text ?? '').join('\n');
}

function report(result: ToolResult): Record<string, unknown> {
  expect(result.isError, text(result)).toBeFalsy();
  return result.structuredContent ?? {};
}

const tempDirs: string[] = [];

/** A directory of its own; with a project, it carries a committed formio.json naming it. */
function workspace(name: string, projectUrl?: string): string {
  // realpath: on macOS the temp directory is a symlink, and a file URL round-trips the
  // resolved path.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `formio-roots-${name}-`)));
  tempDirs.push(dir);
  // Bounds the committed-file walk at this directory.
  fs.mkdirSync(path.join(dir, '.git'));
  if (projectUrl) {
    fs.writeFileSync(path.join(dir, 'formio.json'), JSON.stringify({ projectUrl }));
  }
  return dir;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('the directory a call resolves against', () => {
  it('waits at most two seconds for roots/list by default', () => {
    expect(ROOTS_TIMEOUT_MS).toBe(2_000);
  });

  it('uses the cwd argument over the client root', async () => {
    const app = workspace('app', 'https://app.form.io');
    const other = workspace('other', 'https://other.form.io');
    const { client } = await connect({ roots: () => [app] });

    const result = report(await call(client, 'project_get', { cwd: other }));

    expect(result.cwd).toBe(other);
    expect(result.cwdSource).toBe('argument');
    expect(result.projectUrl).toBe('https://other.form.io');
  });

  it("uses the client's single root as is", async () => {
    const app = workspace('app');
    const { client } = await connect({ roots: () => [app] });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(app);
    expect(result.cwdSource).toBe('client-root');
  });

  it('uses the one root of several that has a committed formio.json', async () => {
    const app = workspace('app', 'https://app.form.io');
    const lib = workspace('lib');
    const { client } = await connect({ roots: () => [lib, app] });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(app);
    expect(result.cwdSource).toBe('client-root');
    expect(result.projectUrl).toBe('https://app.form.io');
  });

  it('uses the one root of several that has a directory mapping', async () => {
    const app = workspace('app');
    const lib = workspace('lib');
    writeProjectEntry({ cwd: app, env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' } });
    const { client } = await connect({ roots: () => [app, lib] });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(app);
    expect(result.projectUrl).toBe('https://mapped.form.io');
  });

  it.each([
    ['different projects', ['https://one.form.io', 'https://two.form.io']],
    // Two records are two records, even naming one URL: each carries its own deployment.
    ['the same project URL from two files', ['https://same.form.io', 'https://same.form.io']],
  ])('refuses with INVALID_ARGUMENT when two roots resolve %s', async (_case, urls) => {
    const one = workspace('one', urls[0]);
    const two = workspace('two', urls[1]);
    const { client } = await connect({ roots: () => [one, two] });

    const result = await call(client, 'project_get');

    expect(result.isError).toBe(true);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('INVALID_ARGUMENT');
    expect(text(result)).toMatch(/^\[INVALID_ARGUMENT\]/);
    expect(text(result)).toContain(one);
    expect(text(result)).toContain(two);
    expect(text(result)).toMatch(/pass cwd/i);
  });

  it('refuses a committed record in one root and a mapping in another', async () => {
    const one = workspace('one', 'https://one.form.io');
    const two = workspace('two');
    writeProjectEntry({ cwd: two, env: { FORMIO_PROJECT_URL: 'https://two.form.io' } });
    const { client } = await connect({ roots: () => [one, two] });

    const result = await call(client, 'project_get');

    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('INVALID_ARGUMENT');
  });

  // Two roots inside one repository walk up to the same formio.json: one project.
  it('uses the first of several roots that all resolve the same record', async () => {
    const repo = workspace('repo', 'https://monorepo.form.io');
    const a = path.join(repo, 'packages', 'a');
    const b = path.join(repo, 'packages', 'b');
    fs.mkdirSync(a, { recursive: true });
    fs.mkdirSync(b, { recursive: true });
    const lib = workspace('lib');
    const { client } = await connect({ roots: () => [lib, b, a] });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(b);
    expect(result.cwdSource).toBe('client-root');
    expect(result.projectUrl).toBe('https://monorepo.form.io');
  });

  // An environment-only launch resolves the same project for every directory, so
  // roots that name no record of their own decide nothing and must not refuse.
  it('falls through when none of several roots resolves a project record', async () => {
    const one = workspace('one');
    const two = workspace('two');
    const { client } = await connect({
      roots: () => [one, two],
      config: { projectUrl: 'https://environment.form.io' },
    });

    const result = report(await call(client, 'project_get'));

    expect(result.status).toBe('ok');
    expect(result.cwdSource).toBe('server');
    expect(result.cwd).toBe(SERVER_CWD);
    expect(result.projectUrl).toBe('https://environment.form.io');
  });

  it('falls through to CLAUDE_PROJECT_DIR when none of several roots has a record', async () => {
    const one = workspace('one');
    const two = workspace('two');
    const app = workspace('app');
    vi.stubEnv('CLAUDE_PROJECT_DIR', app);
    const { client } = await connect({ roots: () => [one, two] });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(app);
    expect(result.cwdSource).toBe('claude-project-dir');
  });

  // A broken record is still the record the user wrote for that root: choosing the
  // other root silently would target a project nobody picked for this directory.
  it('counts an unreadable formio.json as a record', async () => {
    const broken = workspace('broken');
    fs.writeFileSync(path.join(broken, 'formio.json'), '{ not json');
    const other = workspace('other', 'https://other.form.io');
    const { client } = await connect({ roots: () => [broken, other] });

    const result = await call(client, 'project_get');

    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('INVALID_ARGUMENT');
  });

  it('chooses the root whose formio.json is unreadable and surfaces its error', async () => {
    const broken = workspace('broken');
    fs.writeFileSync(path.join(broken, 'formio.json'), '{ not json');
    const plain = workspace('plain');
    const { client } = await connect({ roots: () => [plain, broken] });

    const result = await call(client, 'project_get');

    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('CONFIG_UNREADABLE');
    expect(text(result)).toContain(path.join(broken, 'formio.json'));
  });

  it('counts a malformed mapping entry as a record and surfaces its error', async () => {
    const malformed = workspace('malformed');
    const plain = workspace('plain');
    fs.mkdirSync(path.join(os.homedir(), '.formio'), { recursive: true });
    fs.writeFileSync(
      path.join(os.homedir(), '.formio', 'projects.json'),
      JSON.stringify({ [malformed]: { env: 'not an object' } })
    );
    const { client } = await connect({ roots: () => [plain, malformed] });

    const result = await call(client, 'project_get');

    expect(result.isError).toBe(true);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('CONFIG_UNREADABLE');
    expect(text(result)).toContain(malformed);
  });

  it('treats two spellings of one directory as one root', async () => {
    const app = workspace('app');
    const { client } = await connect({
      listRoots: async () => ({
        roots: [{ uri: `${pathToFileURL(app).href}/` }, { uri: pathToFileURL(app).href }],
      }),
    });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(app);
    expect(result.cwdSource).toBe('client-root');
  });

  it('ignores a root that is not a file:// URI', async () => {
    const app = workspace('app');
    const { client } = await connect({
      listRoots: async () => ({
        roots: [{ uri: 'https://example.com/workspace' }, { uri: pathToFileURL(app).href }],
      }),
    });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(app);
    expect(result.cwdSource).toBe('client-root');
  });

  it('falls through when every root is something other than a file:// URI', async () => {
    const { client } = await connect({
      listRoots: async () => ({ roots: [{ uri: 'https://example.com/workspace' }] }),
    });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(SERVER_CWD);
    expect(result.cwdSource).toBe('server');
  });

  it('sends no roots/list to a client that did not declare roots, and uses CLAUDE_PROJECT_DIR', async () => {
    const app = workspace('app');
    vi.stubEnv('CLAUDE_PROJECT_DIR', app);
    const { client, sentToClient } = await connect();

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(app);
    expect(result.cwdSource).toBe('claude-project-dir');
    expect(sentToClient).not.toContain('roots/list');
  });

  it('ignores a CLAUDE_PROJECT_DIR that is not absolute', async () => {
    vi.stubEnv('CLAUDE_PROJECT_DIR', 'relative/dir');
    const { client } = await connect();

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(SERVER_CWD);
    expect(result.cwdSource).toBe('server');
  });

  it("falls back to the server's own directory when nothing else names one", async () => {
    const { client } = await connect();

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(SERVER_CWD);
    expect(result.cwdSource).toBe('server');
  });

  it('treats a roots/list that does not answer in time as no roots', async () => {
    const app = workspace('app');
    vi.stubEnv('CLAUDE_PROJECT_DIR', app);
    const { client } = await connect({
      listRoots: () => new Promise(() => {}),
      rootsTimeoutMs: 50,
    });

    const result = report(await call(client, 'project_get'));

    expect(result.cwd).toBe(app);
    expect(result.cwdSource).toBe('claude-project-dir');
  });

  it('treats a roots/list that fails as no roots', async () => {
    const { client } = await connect({
      listRoots: async () => {
        throw new Error('roots unavailable');
      },
    });

    const result = report(await call(client, 'project_get'));

    expect(result.cwdSource).toBe('server');
  });

  it('keeps the last good roots when a later read fails or times out', async () => {
    const first = workspace('first');
    const answers: Array<() => Promise<{ roots: Array<{ uri: string }> }>> = [
      async () => ({ roots: [{ uri: pathToFileURL(first).href }] }),
      async () => {
        throw new Error('roots unavailable');
      },
      () => new Promise(() => {}),
    ];
    let calls = 0;
    const { client } = await connect({
      listRoots: () => answers[Math.min(calls++, answers.length - 1)](),
      rootsTimeoutMs: 50,
    });

    expect(report(await call(client, 'project_get')).cwd).toBe(first);

    await client.sendRootsListChanged();
    expect(report(await call(client, 'project_get')).cwd).toBe(first);

    await client.sendRootsListChanged();
    const afterTimeout = report(await call(client, 'project_get'));
    expect(afterTimeout.cwd).toBe(first);
    expect(afterTimeout.cwdSource).toBe('client-root');
    expect(calls).toBe(3);
  });

  it('reads again after list_changed when an earlier read failed', async () => {
    const later = workspace('later');
    let calls = 0;
    const { client } = await connect({
      listRoots: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('not yet');
        }
        return { roots: [{ uri: pathToFileURL(later).href }] };
      },
    });

    expect(report(await call(client, 'project_get')).cwdSource).toBe('server');

    await client.sendRootsListChanged();
    expect(report(await call(client, 'project_get')).cwd).toBe(later);
  });

  it('reads the roots once and again after notifications/roots/list_changed', async () => {
    const first = workspace('first');
    const second = workspace('second');
    let roots = [first];
    const { client, rootsAnswered } = await connect({ roots: () => roots });

    expect(report(await call(client, 'project_get')).cwd).toBe(first);
    expect(report(await call(client, 'server_status')).cwd).toBe(first);
    expect(rootsAnswered()).toBe(1);

    roots = [second];
    await client.sendRootsListChanged();

    expect(report(await call(client, 'project_get')).cwd).toBe(second);
    expect(rootsAnswered()).toBe(2);
  });
});

// The report says where the directory came from, and only the server's own directory
// earns the note telling the agent to pass cwd: that is the one source that is not
// where the user is working.
describe('cwdSource in the project reports', () => {
  it.each(['project_get', 'server_status'])(
    '%s reports client-root with no note about the server directory',
    async (tool) => {
      const app = workspace('app', 'https://app.form.io');
      const { client } = await connect({ roots: () => [app] });

      const result = await call(client, tool);
      const payload = report(result);

      expect(payload.cwdSource).toBe('client-root');
      expect(text(result)).not.toMatch(/own working directory/i);
    }
  );

  it.each(['project_get', 'server_status'])(
    "%s reports server, with the note to pass cwd, from the server's own directory",
    async (tool) => {
      writeProjectEntry({ cwd: SERVER_CWD, env: { FORMIO_PROJECT_URL: 'https://spawn.form.io' } });
      const { client } = await connect();

      const result = await call(client, tool);
      const payload = report(result);

      expect(payload.cwdSource).toBe('server');
      expect((payload.notes as string[]).join('\n')).toMatch(
        /server's own working directory[\s\S]*pass cwd/i
      );
    }
  );

  it('adds no note for a cwd argument', async () => {
    const app = workspace('app', 'https://app.form.io');
    const { client } = await connect();

    const result = await call(client, 'project_get', { cwd: app });

    expect(report(result).cwdSource).toBe('argument');
    expect(text(result)).not.toMatch(/pass cwd/i);
  });

  // CLAUDE_PROJECT_DIR is a launch default, not a directory the caller or the client
  // named for this call, so it earns the same note — naming the variable, not the
  // server's directory.
  it.each(['project_get', 'server_status'])(
    '%s reports claude-project-dir with the note to pass cwd',
    async (tool) => {
      const app = workspace('app', 'https://app.form.io');
      vi.stubEnv('CLAUDE_PROJECT_DIR', app);
      const { client } = await connect();

      const result = await call(client, tool);
      const payload = report(result);

      expect(payload.cwdSource).toBe('claude-project-dir');
      const notes = (payload.notes as string[]).join('\n');
      expect(notes).toContain(app);
      expect(notes).toMatch(/CLAUDE_PROJECT_DIR[\s\S]*pass cwd/i);
      expect(notes).not.toMatch(/server's own working directory/i);
    }
  );

  it('names CLAUDE_PROJECT_DIR, without a remedy, when nothing is configured there', async () => {
    const app = workspace('app');
    vi.stubEnv('CLAUDE_PROJECT_DIR', app);
    const { client } = await connect();

    const payload = report(await call(client, 'project_get'));

    expect(payload.status).toBe('not-configured');
    expect(payload.remedy).toBeUndefined();
    expect(payload.message).toMatch(/CLAUDE_PROJECT_DIR/);
  });
});

// Every tool that resolves a project takes the same order — not only the two that
// report it. A tool on an unconfigured directory fails naming the directory it
// searched, which is the client's root here.
const PROJECT_SCOPED: Record<string, Record<string, unknown>> = {
  form_create: { form: { title: 'T', name: 't', path: 't', components: [] } },
  form_get: { formIdOrPath: 'contact' },
  form_list: {},
  form_revision_get: { formIdOrPath: 'contact', version: '1' },
  form_revision_list: { formIdOrPath: 'contact' },
  form_update: { formId: '67890abcdef012345678abcd', form: { components: [] }, note: 'n' },
  form_publish: { formId: '67890abcdef012345678abcd', note: 'n' },
  form_revert: { formId: '67890abcdef012345678abcd', version: '1', note: 'n' },
  project_export: {},
  project_import: { template: {} },
  role_create: { role: { title: 'R' } },
  role_list: {},
  role_update: { roleId: '69d68310040fa2cea2572945', role: { title: 'R' } },
  action_type_list: { formId: '67890abcdef012345678abcd' },
  action_type_get: { formId: '67890abcdef012345678abcd', actionName: 'email' },
  action_create: {
    formId: '67890abcdef012345678abcd',
    action: { name: 'email', title: 'Email', handler: ['after'], method: ['create'] },
  },
  action_list: { formId: '67890abcdef012345678abcd' },
  action_get: { formId: '67890abcdef012345678abcd', actionId: '69d68310040fa2cea2572945' },
  action_update: {
    formId: '67890abcdef012345678abcd',
    actionId: '69d68310040fa2cea2572945',
    action: { name: 'email', title: 'Email', handler: ['after'], method: ['create'] },
  },
  action_delete: { formId: '67890abcdef012345678abcd', actionId: '69d68310040fa2cea2572945' },
};

describe('every project-resolving tool takes the same order', () => {
  it('covers every tool that takes cwd', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const withCwd = tools
      .filter((tool) => 'cwd' in (tool.inputSchema.properties ?? {}))
      .map((tool) => tool.name)
      .sort();

    expect(withCwd).toEqual(
      [...Object.keys(PROJECT_SCOPED), 'project_get', 'project_set', 'server_status'].sort()
    );
  });

  it.each(Object.entries(PROJECT_SCOPED))(
    '%s resolves against the client root',
    async (tool, args) => {
      const app = workspace('scoped');
      const { client } = await connect({ roots: () => [app] });

      const result = await call(client, tool, args);

      expect(result._meta?.[ERROR_META_KEY]?.code).toBe('NOT_CONFIGURED');
      expect(text(result)).toContain(app);
      expect(text(result)).not.toMatch(/own working directory/i);
    }
  );

  it.each(Object.entries(PROJECT_SCOPED))(
    '%s refuses with INVALID_ARGUMENT when several roots are ambiguous',
    async (tool, args) => {
      const one = workspace('one', 'https://one.form.io');
      const two = workspace('two', 'https://two.form.io');
      const { client } = await connect({ roots: () => [one, two] });

      const result = await call(client, tool, args);

      expect(result._meta?.[ERROR_META_KEY]?.code).toBe('INVALID_ARGUMENT');
      expect(text(result)).toContain(one);
      expect(text(result)).toContain(two);
    }
  );

  it('project_set records the mapping for the client root', async () => {
    const app = workspace('app');
    const { client } = await connect({ roots: () => [app] });

    const result = await call(client, 'project_set', { projectUrl: 'https://rooted.form.io' });
    const payload = report(result);

    expect(payload.cwd).toBe(app);
    expect(payload.ok).toBe(true);
    expect(readProjectEntry(app)?.env.FORMIO_PROJECT_URL).toBe('https://rooted.form.io');
    expect(readProjectEntry(SERVER_CWD)).toBeNull();
    expect(text(result)).not.toMatch(/own working directory/i);
  });

  it('project_set refuses the ambiguous roots rather than writing under the server directory', async () => {
    const one = workspace('one', 'https://one.form.io');
    const two = workspace('two', 'https://two.form.io');
    const { client } = await connect({ roots: () => [one, two] });

    const result = await call(client, 'project_set', { projectUrl: 'https://rooted.form.io' });

    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('INVALID_ARGUMENT');
    expect(readProjectEntry(SERVER_CWD)).toBeNull();
  });

  it('project_set warns when CLAUDE_PROJECT_DIR supplied the directory', async () => {
    const app = workspace('app');
    vi.stubEnv('CLAUDE_PROJECT_DIR', app);
    const { client } = await connect();

    const result = await call(client, 'project_set', { projectUrl: 'https://launched.form.io' });

    expect(report(result).cwd).toBe(app);
    expect(text(result)).toMatch(/warning/i);
    expect(text(result)).toContain('CLAUDE_PROJECT_DIR');
    expect(readProjectEntry(app)?.env.FORMIO_PROJECT_URL).toBe('https://launched.form.io');
  });

  it('project_set keeps warning when it falls back to the server directory', async () => {
    const { client } = await connect();

    const result = await call(client, 'project_set', { projectUrl: 'https://spawned.form.io' });

    expect(report(result).cwd).toBe(SERVER_CWD);
    expect(text(result)).toMatch(/own working directory/i);
  });
});
