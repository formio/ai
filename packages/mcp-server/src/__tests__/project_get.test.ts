import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FormioConfig } from '../config.js';
import { projectMapPath } from '../project-map.js';
import { writeProjectEntry } from '../project-map.js';
import { registerProjectGetTool } from '../tools/project_get.js';

// The read half of the project surface, as a tool rather than a shell command.
//
// `project get` on the CLI is what every skill's preflight ran, which meant an
// agent with the server already connected spawned an npm download to ask that
// same server a question it could answer over the open transport. The answers
// must agree — same resolver, same precedence, same three outcomes — so these
// tests assert the outcomes rather than the prose, which is exactly what the CLI
// exit codes exist to give callers.

async function createTestClient(config: FormioConfig, options?: { cwd?: () => string }) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerProjectGetTool(server, config, options);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);

  return { client };
}

interface ProjectGetPayload {
  status: string;
  cwd: string;
  projectUrl?: string;
  baseUrl?: string;
  projectUrlSource?: string;
  baseUrlSource?: string;
  shadowed?: string[];
  message: string;
  notes?: string[];
}

function payload(result: unknown): ProjectGetPayload {
  const { structuredContent } = (result ?? {}) as { structuredContent?: ProjectGetPayload };
  if (!structuredContent) {
    throw new Error('project_get returned no structuredContent');
  }
  return structuredContent;
}

function resultText(result: unknown): string {
  const { content } = (result ?? {}) as { content?: Array<{ type: string; text?: string }> };
  return (content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n');
}

describe('project_get tool', () => {
  const cwd = '/workspace/app-a';

  it('reports the project mapped to the cwd and how its base URL was resolved', async () => {
    writeProjectEntry({ cwd: cwd, env: { FORMIO_PROJECT_URL: 'https://examples.form.io' } });
    const { client } = await createTestClient({});

    const result = await client.callTool({ name: 'project_get', arguments: { cwd } });

    expect(result.isError).toBeFalsy();
    const report = payload(result);
    expect(report.status).toBe('ok');
    expect(report.cwd).toBe(cwd);
    expect(report.projectUrl).toBe('https://examples.form.io');
    expect(report.baseUrl).toBe('https://api.form.io');
    expect(report.projectUrlSource).toBe('mapping');
    expect(report.baseUrlSource).toBe('derived');
  });

  it('keys the mapping on the server process cwd when no cwd is passed', async () => {
    const serverCwd = '/workspace/server-cwd';
    writeProjectEntry({ cwd: serverCwd, env: { FORMIO_PROJECT_URL: 'https://implicit.form.io' } });
    const { client } = await createTestClient({}, { cwd: () => serverCwd });

    const result = await client.callTool({ name: 'project_get', arguments: {} });

    const report = payload(result);
    expect(report.cwd).toBe(serverCwd);
    expect(report.projectUrl).toBe('https://implicit.form.io');
  });

  it('answers "nothing is mapped here" as a status, not as a tool failure', async () => {
    const { client } = await createTestClient({});

    const result = await client.callTool({
      name: 'project_get',
      arguments: { cwd: '/workspace/unmapped' },
    });

    // The CLI gave this its own exit code precisely so a caller would not have to
    // branch on a substring. The tool owes callers the same: a machine-readable
    // status, and an error reserved for "could not answer at all".
    expect(result.isError).toBeFalsy();
    const report = payload(result);
    expect(report.status).toBe('not-configured');
    expect(report.projectUrl).toBeUndefined();
    expect(report.message).toMatch(/project_set/);
    expect(report.message).toMatch(/A Project URL is the full URL of one Form.io project/);
  });

  // The remedy names a cwd to record the project under, so an unmapped answer
  // that reached the server's OWN directory has to say so. Without it the agent is
  // told to project_set the directory the server happens to have been spawned in —
  // for a plugin- or desktop-launched server, not the user's — and every later
  // call, which does pass the user's cwd, still resolves nothing. The same loop
  // missingProjectError already names for every other tool.
  it("says the searched directory was the server's own when no cwd was passed", async () => {
    const serverCwd = '/workspace/server-spawn-dir';
    const { client } = await createTestClient({}, { cwd: () => serverCwd });

    const result = await client.callTool({ name: 'project_get', arguments: {} });

    const report = payload(result);
    expect(report.status).toBe('not-configured');
    expect(report.message).toMatch(/no cwd argument was passed/i);
    expect(report.message).toMatch(/the MCP server's own working directory/i);
  });

  it('makes no such claim when the caller named the directory', async () => {
    const { client } = await createTestClient({});

    const result = await client.callTool({
      name: 'project_get',
      arguments: { cwd: '/workspace/named-by-caller' },
    });

    const report = payload(result);
    expect(report.status).toBe('not-configured');
    expect(report.message).not.toMatch(/no cwd argument was passed/i);
  });

  it('reports a configured project whose base URL cannot be derived as its own status', async () => {
    writeProjectEntry({ cwd: cwd, env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' } });
    const { client } = await createTestClient({});

    const result = await client.callTool({ name: 'project_get', arguments: { cwd } });

    const report = payload(result);
    expect(report.status).toBe('base-url-unresolved');
    expect(report.projectUrl).toBe('https://myproject.mysite.com');
    expect(report.baseUrl).toBeUndefined();
    // The remedy is the base URL alone. Re-asking for the project URL is the
    // failure this status exists to prevent.
    expect(report.message).toMatch(/baseUrl/);
    expect(report.message).not.toMatch(/--project-url/);
  });

  it('names project_set rather than a shell command in every remedy it prints', async () => {
    const { client } = await createTestClient({});

    const unmapped = await client.callTool({
      name: 'project_get',
      arguments: { cwd: '/workspace/unmapped-remedy' },
    });

    writeProjectEntry({ cwd: cwd, env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' } });
    const halfConfigured = await client.callTool({ name: 'project_get', arguments: { cwd } });

    // The whole point of the tool: a connected agent has no reason to shell out
    // to npm, so nothing this tool says may send it back there.
    for (const result of [unmapped, halfConfigured]) {
      expect(payload(result).message).not.toMatch(/npx/);
      expect(payload(result).message).not.toMatch(/@formio\/mcp/);
    }
  });

  it("carries the server's-own-directory note into the text on an ok result", async () => {
    const serverCwd = '/workspace/server-cwd-note';
    writeProjectEntry({ cwd: serverCwd, env: { FORMIO_PROJECT_URL: 'https://implicit.form.io' } });
    const { client } = await createTestClient({}, { cwd: () => serverCwd });

    const result = await client.callTool({ name: 'project_get', arguments: {} });

    expect(payload(result).status).toBe('ok');
    expect(resultText(result)).toMatch(/No cwd argument was passed/i);
  });

  it('omits the CLI shell caveat, which is false when the server itself answers', async () => {
    writeProjectEntry({ cwd: cwd, env: { FORMIO_PROJECT_URL: 'https://examples.form.io' } });
    const { client } = await createTestClient({});

    const result = await client.callTool({ name: 'project_get', arguments: { cwd } });

    expect(payload(result).message).not.toMatch(/not visible from this shell/);
  });

  it('reports a losing source rather than silently omitting it', async () => {
    writeProjectEntry({ cwd: cwd, env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' } });
    const { client } = await createTestClient({ projectUrl: 'https://from-env.form.io' });

    const result = await client.callTool({ name: 'project_get', arguments: { cwd } });

    const report = payload(result);
    expect(report.projectUrl).toBe('https://mapped.form.io');
    expect(report.shadowed?.join(' ')).toMatch(/from-env\.form\.io/);
  });

  it('fails as a tool error when it cannot answer at all', async () => {
    // An unreadable map is not an unmapped directory: answering "nothing is
    // configured" here sends the caller to project_set, whose rewrite destroys
    // every other mapping in the file.
    const mapPath = projectMapPath();
    fs.mkdirSync(path.dirname(mapPath), { recursive: true });
    fs.writeFileSync(mapPath, '{ this is not json');
    const { client } = await createTestClient({});

    const result = await client.callTool({ name: 'project_get', arguments: { cwd } });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toMatch(/Cannot read the Form.io project map/);
  });

  it('rejects a relative cwd instead of resolving against the wrong directory', async () => {
    const { client } = await createTestClient({});

    const result = await client.callTool({ name: 'project_get', arguments: { cwd: 'relative' } });

    expect(result.isError).toBe(true);
  });

  it('is registered read-only, since it writes nothing', async () => {
    const { client } = await createTestClient({});

    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === 'project_get');

    expect(tool).toBeTruthy();
    expect(tool!.annotations!.readOnlyHint).toBe(true);
  });
});

// Guards against the tmp HOME leaking a stale map between the cases above.
describe('project_get test isolation', () => {
  it('uses the redirected HOME the suite sets up', () => {
    expect(projectMapPath().startsWith(os.homedir())).toBe(true);
  });
});
