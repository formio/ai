import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';
import { registerProjectSetTool } from '../tools/project_set.js';

// The user-scope branch can key a mapping to the server's own process cwd and
// warn, because a mapping is read back by that one exact path. A committed file
// is not: it is found by walking UP, so one written into an arbitrary directory —
// and for a plugin- or desktop-launched server that directory is arbitrary, often
// the home directory — governs every non-git directory beneath it. There is no
// warning that undoes that, so the repo scope refuses instead.
describe('project_set with scope repo', () => {
  let serverCwd: string;

  beforeEach(() => {
    serverCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-repo-cwd-'));
  });

  afterEach(() => {
    fs.rmSync(serverCwd, { recursive: true, force: true });
  });

  async function call(args: Record<string, unknown>) {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectSetTool(server, { cwd: () => serverCwd, baseUrl: () => undefined });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    return client.callTool({ name: 'project_set', arguments: args });
  }

  it('refuses to write a committed file into the server’s own directory', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', scope: 'repo' });

    expect(result.isError).toBe(true);
    expect(fs.existsSync(path.join(serverCwd, COMMITTED_CONFIG_FILE))).toBe(false);
  });

  it('says the missing cwd is what it refused on', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', scope: 'repo' });

    expect(JSON.stringify(result.content)).toMatch(/cwd/);
  });

  // path.resolve would silently re-base a relative cwd on the server's own
  // directory, which is the same misplacement arrived at through a value the
  // caller did supply.
  it('refuses a relative cwd rather than re-basing it on the server directory', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: 'apps/web', scope: 'repo' });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/absolute/i);
  });

  it('writes the file when an absolute cwd is supplied', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: serverCwd, scope: 'repo' });

    expect(result.isError ?? false).toBe(false);
    expect(fs.existsSync(path.join(serverCwd, COMMITTED_CONFIG_FILE))).toBe(true);
  });
});
