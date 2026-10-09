import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeProjectEntry } from '../project-map.js';
import { SERVER_VERSION } from '../server.js';
import { registerServerStatusTool } from '../tools/server_status.js';
import { connectTools } from './test-helpers.js';

// The first call to make when other tools fail: it needs no project and no
// credentials, so it answers on a bare install, and what it reports about the
// caller's directory is the same answer project_get gives.

interface StatusPayload {
  name: string;
  version: string;
  status: string;
  cwd: string;
  projectUrl?: string;
  baseUrl?: string;
  projectUrlSource?: string;
  baseUrlSource?: string;
}

function payload(result: unknown): StatusPayload {
  const { structuredContent } = (result ?? {}) as { structuredContent?: StatusPayload };
  if (!structuredContent) {
    throw new Error('server_status returned no structuredContent');
  }
  return structuredContent;
}

describe('server_status tool', () => {
  const cwd = '/workspace/status-app';
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is listed in available tools', async () => {
    const client = await connectTools((server) => registerServerStatusTool(server, {}));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('server_status');
  });

  it('reports the version and not-configured when nothing configures a project', async () => {
    const client = await connectTools((server) => registerServerStatusTool(server, {}));

    const result = await client.callTool({ name: 'server_status', arguments: { cwd } });

    expect(result.isError).toBeFalsy();
    const status = payload(result);
    expect(status.name).toBe('formio-mcp');
    expect(status.version).toBe(SERVER_VERSION);
    expect(status.status).toBe('not-configured');
    expect(status.cwd).toBe(cwd);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reports the resolved project, its deployment and their sources for a mapped directory', async () => {
    writeProjectEntry({ cwd, env: { FORMIO_PROJECT_URL: 'https://examples.form.io' } });
    const client = await connectTools((server) => registerServerStatusTool(server, {}));

    const result = await client.callTool({ name: 'server_status', arguments: { cwd } });

    expect(result.isError).toBeFalsy();
    const status = payload(result);
    expect(status.version).toBe(SERVER_VERSION);
    expect(status.status).toBe('ok');
    expect(status.projectUrl).toBe('https://examples.form.io');
    expect(status.baseUrl).toBe('https://api.form.io');
    expect(status.projectUrlSource).toBe('mapping');
    expect(status.baseUrlSource).toBe('derived');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('names the server version in its text', async () => {
    const client = await connectTools((server) => registerServerStatusTool(server, {}));

    const result = await client.callTool({ name: 'server_status', arguments: { cwd } });

    const text = (result.content as { text: string }[]).map((part) => part.text).join('\n');
    expect(text).toContain(`formio-mcp ${SERVER_VERSION}`);
  });

  it('answers for the server process directory when no cwd is given', async () => {
    const client = await connectTools((server) =>
      registerServerStatusTool(server, {}, { cwd: () => cwd })
    );

    const result = await client.callTool({ name: 'server_status', arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(payload(result).cwd).toBe(cwd);
  });
});
