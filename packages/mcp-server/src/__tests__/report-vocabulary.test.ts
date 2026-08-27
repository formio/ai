import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runProjectCommand } from '../cli/project-command.js';
import { registerProjectGetTool } from '../tools/project_get.js';

// One report, two readers, and the vocabulary is what separates them. The CLI runs
// in the user's shell; the tool runs inside the MCP server, whose environment
// block is written in a launch configuration the shell cannot see. Remedies were
// already parameterized for that. The PROVENANCE was not, so the tool told an
// agent that its project came from "this shell\u2019s environment" and named a
// variable to look for in a shell that does not have it.
describe('the report names the environment the reader can actually reach', () => {
  const cwd = '/workspace/env-provenance';

  async function projectGet(config: { projectUrl?: string; baseUrl?: string }, args = { cwd }) {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerProjectGetTool(server, config);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    const result = await client.callTool({ name: 'project_get', arguments: args });
    const { structuredContent } = result as unknown as {
      structuredContent: { message: string; shadowed: string[] };
    };
    return structuredContent;
  }

  it('attributes a project from the environment to the server, not to a shell', async () => {
    const report = await projectGet({ projectUrl: 'https://examples.form.io' });

    expect(report.message).toMatch(/FORMIO_PROJECT_URL/);
    expect(report.message).not.toMatch(/this shell/i);
    expect(report.message).toMatch(/MCP server/i);
  });

  it('names the same environment when it reports a shadowed variable', async () => {
    const { writeProjectEntry } = await import('../project-map.js');
    writeProjectEntry({ cwd: cwd, env: { FORMIO_PROJECT_URL: 'https://mapped.form.io' } });

    const report = await projectGet({ projectUrl: 'https://from-env.form.io' });

    expect(report.shadowed.join(' ')).toMatch(/from-env\.form\.io/);
    expect(report.shadowed.join(' ')).not.toMatch(/this shell/i);
  });

  // The CLI keeps its own wording: its reader IS a shell, and telling that reader
  // to look in the server's environment would send them to a block they cannot
  // read from where they stand.
  it('still says "this shell" when a shell asked', () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-vocab-'));
    try {
      const result = runProjectCommand(['project', 'get', '--cwd', '/workspace/cli-vocab'], {
        cacheDir,
        env: { FORMIO_PROJECT_URL: 'https://examples.form.io' },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/this shell/i);
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});

// A note collected on the way to a failure explains that failure. `project set`
// hoisted its collector above the "--project-url is required" guard so an
// unexpanded FORMIO_PROJECT_URL could be dropped rather than thrown \u2014 and then
// returned through a failure shape that discards notes, which is the exact
// omission the comments on notConfigured and baseUrlUnresolved in that file exist
// to prevent.
describe('project set reports the variable it discarded', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-set-notes-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('carries the ignored-variable note into the required-project failure', () => {
    const result = runProjectCommand(
      ['project', 'set', '--base-url', 'https://forms.mysite.com', '--cwd', '/w/unexpanded'],
      { cacheDir, env: { FORMIO_PROJECT_URL: '${FORMIO_PROJECT_URL}' } }
    );

    // 1, not 2: a named value is missing and the message says which, so the caller acts
    // on it rather than relaying and stopping.
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--project-url is required/);
    expect(result.stderr).toMatch(/Ignoring FORMIO_PROJECT_URL/);
  });
});
