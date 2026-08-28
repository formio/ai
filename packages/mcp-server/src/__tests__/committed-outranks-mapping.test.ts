import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { classifyPair } from '../pair-rule.js';
import { runProjectCommand } from '../cli/project-command.js';
import { resolveProject } from '../project-resolver.js';
import { registerProjectGetTool } from '../tools/project_get.js';
import { registerProjectSetTool } from '../tools/project_set.js';

// Both writers computed "what this directory will resolve to once the write
// lands" as `mapping ?? committed`, but resolution runs the other way round: a
// committed formio.json outranks the mapping. With both on record for one
// directory the writers therefore answered about a project that does NOT govern
// it — reporting it as active, and asking the base-URL derivation questions
// against it.
describe('a committed formio.json outranks the mapping', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-outranks-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-outranks-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    // The committed file names one project; the mapping is about to name another.
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.form.io' })
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const run = (args: string[]) => runProjectCommand(['project', ...args], { cacheDir, env: {} });

  const callTool = async (args: Record<string, unknown>) => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    // The tool has no cacheDir seam: setup.ts redirects HOME to a per-worker tmp
    // dir, so the mapping it writes lands there rather than in the real
    // ~/.formio. Only the reported message matters to this test.
    registerProjectSetTool(server);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = (await client.callTool({ name: 'project_set', arguments: args })) as {
      content: { text: string }[];
    };
    await client.close();
    return result.content.map((entry) => entry.text).join('\n');
  };

  it('is the project `project set` reports as active, not the one it just mapped', () => {
    const result = run(['set', '--project-url', 'https://mapped.form.io', '--cwd', repo]);

    // The mapping write itself is legitimate — it is what a later removal of the
    // committed file falls back to — but the directory resolves to the committed
    // project, and saying otherwise sends the user to look for their forms in the
    // wrong project.
    expect(resolveProject(repo, {}, { cacheDir, onNote: () => {} }).config.projectUrl).toBe(
      'https://committed.form.io'
    );
    expect(result.stdout + result.stderr).toContain('https://committed.form.io');
    expect(result.stdout + result.stderr).toMatch(/formio\.json/);
  });

  // The structured field says "now ACTIVE for that directory", and project_get's own
  // schema tells agents to act on fields rather than parse prose — so reporting the
  // value just written told an agent it had re-pointed a directory a committed file
  // still governs.
  it('reports the ACTIVE project in the structured result, and says so in the message', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => repo });
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = (await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://mapped.form.io', cwd: repo },
    })) as unknown as {
      structuredContent?: { projectUrl?: string; changed?: boolean };
      content: Array<{ text: string }>;
    };
    await client.close();

    expect(result.structuredContent?.projectUrl).toBe('https://committed.form.io');
    // The record did change, even though what resolves did not.
    expect(result.structuredContent?.changed).toBe(true);
  });

  // Both halves of the reported pair come from ONE record. Taking the project from
  // whichever record governs and the deployment from the one just written described a
  // pair that never existed anywhere — and one the pair rule itself rejects, which the
  // skills then read as appUrl/apiUrl and write into a user's application.
  it('reports a pair drawn from a single record, never assembled from two', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => repo });
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = (await client.callTool({
      name: 'project_set',
      arguments: {
        cwd: repo,
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://forms.mysite.com',
      },
    })) as unknown as {
      structuredContent?: { projectUrl?: string; baseUrl?: string };
      content: Array<{ text: string }>;
    };
    await client.close();
    const reported = result.structuredContent ?? {};

    // What governs, and its OWN deployment — never one record's project beside
    // another record's deployment, which described a pair existing in no record.
    expect(reported.projectUrl).toBe('https://committed.form.io');
    expect(classifyPair(reported.projectUrl as string, reported.baseUrl)).toBe('ok');
    // What was WRITTEN is the caller's own argument, so it is stated in the message
    // rather than echoed back as a conditional field.
    const text = result.content.map((entry) => entry.text).join('\n');
    expect(text).toContain('https://myproject.mysite.com');
    expect(text).toContain('https://forms.mysite.com');
  });

  // A record's values are validated where that record WINS, which is inside the
  // resolver — so the note explaining that a committed Base URL was set aside exists
  // only there. Asked for the active pair with its notes thrown away, both writers
  // reported a clean success over a directory whose committed file holds a value the
  // server is silently ignoring, and the user had no way to learn it from the write.
  describe('a note only the resolver can emit', () => {
    beforeEach(() => {
      fs.writeFileSync(
        path.join(repo, 'formio.json'),
        JSON.stringify({
          projectUrl: 'https://forms.mysite.com/one/two',
          baseUrl: 'https://wrong.mysite.com',
        })
      );
    });

    it('reaches the caller through the tool', async () => {
      const text = await callTool({ cwd: repo, projectUrl: 'https://mapped.form.io' });

      expect(text, 'dropped the ignored Base URL note').toContain('https://wrong.mysite.com');
    });

    it('reaches the caller through the CLI', () => {
      const result = run(['set', '--project-url', 'https://mapped.form.io', '--cwd', repo]);

      expect(result.stdout + result.stderr).toContain('https://wrong.mysite.com');
    });

    // A write walks the tree for its own plan and the report walks it again, so a note
    // both walks emit arrives twice — and a user told twice that the same file was
    // passed over reads it as two files, in two places, one of which does not exist.
    it('is said once, not once per walk', () => {
      fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify({ nothing: 'here' }));

      const result = run(['set', '--project-url', 'https://mapped.form.io', '--cwd', repo]);
      const output = result.stdout + result.stderr;

      expect(output.split('holds neither').length - 1).toBe(1);
    });
  });

  // The PROSE is the half an agent relays to the user, and it kept quoting the plan
  // while only the structured half asked the resolver: one result announced that the
  // Base URL had been set, the other carried none, and the note between them said the
  // write did not take effect. Whichever of the three a caller believed, two were
  // wrong. The active voice is reserved for a write that actually governs.
  it('does not announce a Base URL the resolved pair does not have', async () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://myproject.mysite.com' })
    );
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => repo });
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({
      name: 'project_set',
      arguments: {
        cwd: repo,
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      },
    });
    const repair = (await client.callTool({
      name: 'project_set',
      arguments: { cwd: repo, baseUrl: 'https://other-api.mysite.com' },
    })) as unknown as {
      content: Array<{ text: string }>;
      structuredContent?: { ok?: boolean; baseUrl?: string };
    };
    await client.close();
    const text = repair.content.map((entry) => entry.text).join('\n');

    expect(repair.structuredContent?.baseUrl, 'the committed record supplies none').toBeUndefined();
    expect(text, 'claimed the deployment was set').not.toMatch(/Base URL for \S+ set to/);
    expect(text, 'printed a value it did not have').not.toContain('undefined');
    expect(text, 'did not say the write does not take effect').toMatch(/does not take effect/);
    expect(repair.structuredContent?.ok, 'reported a serviceable directory').toBe(false);
  });

  // The writer asks the RESOLVER what resolves rather than working it out again.
  // Its own copy of precedence compared only the PROJECT halves, so a committed file
  // naming the SAME project left the just-written deployment reported as active while
  // that record supplies none — the caller is told the repair landed, and the next
  // authenticated call fails.
  it('reports no deployment where the governing record has none, even after writing one', async () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://myproject.mysite.com' })
    );
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => repo });
    registerProjectGetTool(server, {}, { cwd: () => repo });
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const written = (await client.callTool({
      name: 'project_set',
      arguments: {
        cwd: repo,
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      },
    })) as unknown as { structuredContent?: { baseUrl?: string; changed?: boolean } };
    const read = (await client.callTool({
      name: 'project_get',
      arguments: { cwd: repo },
    })) as unknown as { structuredContent?: { baseUrl?: string; status?: string } };
    await client.close();

    // The record changed; what resolves did not gain a deployment.
    expect(written.structuredContent?.changed).toBe(true);
    expect(written.structuredContent?.baseUrl).toBeUndefined();
    expect(read.structuredContent?.status).toBe('base-url-unresolved');
    expect(written.structuredContent?.baseUrl).toBe(read.structuredContent?.baseUrl);
  });

  // And it never reports a pair the pair rule refuses: echoing the committed file's
  // recorded deployment without the chokepoint reported api.form.io for a customer
  // project while the resolver derived the right value.
  it('reports the pair the resolver resolves, not the one recorded', async () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({
        projectUrl: 'https://forms.mysite.com/proj',
        baseUrl: 'https://api.form.io',
      })
    );
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => repo });
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const written = (await client.callTool({
      name: 'project_set',
      arguments: { cwd: repo, projectUrl: 'https://other.form.io' },
    })) as unknown as { structuredContent?: { projectUrl?: string; baseUrl?: string } };
    await client.close();
    const reported = written.structuredContent ?? {};

    expect(reported.baseUrl).toBe('https://forms.mysite.com');
    expect(classifyPair(reported.projectUrl as string, reported.baseUrl)).toBe('ok');
  });

  it('is the project the project_set tool reports as active', async () => {
    const text = await callTool({ projectUrl: 'https://mapped.form.io', cwd: repo });

    expect(text).toContain('https://committed.form.io');
    expect(text).toMatch(/formio\.json/);
  });

  // The record being written is about the project the CALL names, whatever governs
  // the directory: a mapping recorded for a path-less customer project has to carry
  // that project's deployment, because a record holds the pair or it is not written.
  // Asked against the committed project instead, this write would store half a
  // configuration for a project that derives nothing.
  it('demands the deployment of the project this call records, not of the one that governs', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://committed.form.io' })
    );

    const refused = run(['set', '--project-url', 'https://myproject.mysite.com', '--cwd', repo]);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain('--base-url');

    const written = run([
      'set',
      '--project-url',
      'https://myproject.mysite.com',
      '--base-url',
      'https://forms.mysite.com',
      '--cwd',
      repo,
    ]);
    expect(written.exitCode).toBe(0);
  });
});

// Precedence picks one WHOLE record, so wherever a committed file names a project the
// mapping cannot change the answer — with or without a baseUrl key of its own. The
// tolerance rule still demanded both halves, which is the pre-pairing question, so the
// shape the docs recommend most (`{"projectUrl": …}`, deployment derived) failed every
// call for a directory whose ~/.formio/projects.json happened to be corrupt.
describe('an unreadable map beside a committed project', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-tolerate-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-tolerate-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), '[]');
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const get = () => runProjectCommand(['project', 'get', '--cwd', repo], { cacheDir, env: {} });

  it('resolves a committed project whose deployment is derived', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://examples.form.io' })
    );

    const result = get();

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('https://api.form.io');
  });

  it('says the map could not be read rather than swallowing it', () => {
    fs.writeFileSync(
      path.join(repo, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://examples.form.io' })
    );

    const { stderr } = get();

    // Named, with the file and the cause — the map is not swallowed.
    expect(stderr).toMatch(/unreadable Form\.io project map/);
    expect(stderr).toContain(path.join(cacheDir, 'projects.json'));
    // But NOT the fatal case's remedy. Here nothing needs repairing for this answer:
    // that instruction names a write which cannot run while the file is unreadable
    // and would not take effect if it could, because the committed file governs.
    expect(stderr).not.toMatch(/Repair or delete that file FIRST/);
    expect(stderr).not.toMatch(/nothing below will run/);
  });

  // With no committed project there is nothing to fall back to, so the unreadable map
  // is still the answer.
  it('still fails when nothing else configures the directory', () => {
    expect(get().exitCode).toBe(2);
  });
});

// A note is often the CAUSE of the failure printed beside it. Collected inside the
// subcommand and rendered only on its own return paths, every note vanished the moment
// anything threw — so the one run where the explanation matters most, a bad URL typed
// into a directory whose formio.json was already being passed over, printed the throw
// alone and sent the caller to fix a file the server had never read.
describe('notes survive a throw', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-throwrun-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-throwrun-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify({ nothing: 'here' }));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('keeps them when the plan rejects the URL', () => {
    const result = runProjectCommand(
      ['project', 'set', '--project-url', 'notaurl', '--cwd', repo],
      { cacheDir, env: {} }
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr, 'lost the note explaining the passed-over file').toContain(
      'holds neither'
    );
  });
});
