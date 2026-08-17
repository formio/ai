import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig, getConfig } from '../config.js';
import { resolveProjectConfig } from '../project-resolver.js';
import { registerAllTools } from '../tools/index.js';
import { SERVER_INSTRUCTIONS } from '../server.js';
import { writeProjectEntry } from '../project-map.js';

// A configured default is a SUGGESTION. It reaches the agent through the two
// surfaces that already explain a missing project — the resolution error and the
// server's instructions — and it never reaches resolution itself. The moment it
// did, it would be a pin with a friendlier name, which is the failure this
// exists to remove.
const DEFAULT_URL = 'https://suggested.form.io';
const PINNED_URL = 'https://pinned.form.io';
const UNMAPPED_CWD = '/workspace/offer-unmapped';

describe('a configured default project', () => {
  let cacheDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-offer-'));
    process.env = { ...originalEnv };
    for (const key of ['FORMIO_PROJECT_URL', 'FORMIO_BASE_URL', 'FORMIO_DEFAULT_PROJECT_URL']) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('is read from the environment as its own field', () => {
    process.env.FORMIO_DEFAULT_PROJECT_URL = DEFAULT_URL;

    const config = getConfig();

    expect(config.defaultProjectUrl).toBe(DEFAULT_URL);
    expect(config.projectUrl, 'the default must never populate the pinning field').toBeUndefined();
  });

  it('does not resolve a project on its own', () => {
    const config: FormioConfig = {
      baseUrl: 'https://api.form.io',
      defaultProjectUrl: DEFAULT_URL,
    };

    expect(() => resolveProjectConfig(UNMAPPED_CWD, config, { cacheDir })).toThrow(
      /No Form\.io project is configured/
    );
  });

  it('is named in the resolution error as the suggested project', () => {
    const config: FormioConfig = {
      baseUrl: 'https://api.form.io',
      defaultProjectUrl: DEFAULT_URL,
    };

    let message = '';
    try {
      resolveProjectConfig(UNMAPPED_CWD, config, { cacheDir });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(DEFAULT_URL);
    expect(message).toContain('project_set');
    expect(message).toMatch(/confirm/i);
  });

  it('is absent from the error when unset', () => {
    const config: FormioConfig = { baseUrl: 'https://api.form.io' };

    let message = '';
    try {
      resolveProjectConfig(UNMAPPED_CWD, config, { cacheDir });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toMatch(/suggested/i);
    expect(message).toContain('project_set');
    expect(message).toMatch(/base url/i);
  });

  it('never overrides a pinned project', () => {
    const config: FormioConfig = {
      baseUrl: 'https://api.form.io',
      projectUrl: PINNED_URL,
      defaultProjectUrl: DEFAULT_URL,
    };

    const resolved = resolveProjectConfig(UNMAPPED_CWD, config, { cacheDir });

    expect(resolved.projectUrl).toBe(PINNED_URL);
  });

  it('never overrides a working-directory mapping', () => {
    const mapped = 'https://mapped.form.io';
    writeProjectEntry(UNMAPPED_CWD, { FORMIO_PROJECT_URL: mapped }, cacheDir);
    const config: FormioConfig = {
      baseUrl: 'https://api.form.io',
      defaultProjectUrl: DEFAULT_URL,
    };

    const resolved = resolveProjectConfig(UNMAPPED_CWD, config, { cacheDir });

    expect(resolved.projectUrl).toBe(mapped);
  });
});

describe('the offer reaches a tool caller', () => {
  it('surfaces in a project-scoped tool failure', async () => {
    const config: FormioConfig = {
      baseUrl: 'https://api.form.io',
      defaultProjectUrl: DEFAULT_URL,
    };
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerAllTools(server, config);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'form_list',
      arguments: { cwd: '/workspace/offer-never-mapped' },
    });
    const text = ((result?.content ?? []) as Array<{ type: string; text?: string }>)
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('\n');

    expect(text).toContain(DEFAULT_URL);
    expect(text).toContain('project_set');
    await client.close();
  });
});

describe('the server instructions describe the offer', () => {
  it('tells the agent to confirm and persist rather than assume', () => {
    expect(SERVER_INSTRUCTIONS).toContain('FORMIO_DEFAULT_PROJECT_URL');
    expect(SERVER_INSTRUCTIONS).toMatch(/confirm/i);
    expect(SERVER_INSTRUCTIONS).toContain('project_set');
  });

  it('does not present the default as already applied', () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/the default is used|automatically uses/i);
  });
});
