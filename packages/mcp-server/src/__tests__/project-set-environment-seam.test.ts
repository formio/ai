import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { FormioConfig } from '../config.js';
import { registerAllTools } from '../tools/index.js';

// Read at module load, before any case below mutates the environment: what leaks
// into a test is what the shell exported when vitest started, and a later delete
// in one case would otherwise hide it from the assertion at the bottom.
const environmentAtLoad = {
  projectUrl: process.env.FORMIO_PROJECT_URL,
  baseUrl: process.env.FORMIO_BASE_URL,
};

// project_set reads the environment for one question — does anything configure a
// project for this directory? — and it has to read it through the same
// already-validated config every other tool takes. Left to reach process.env
// itself it re-drops an unusable FORMIO_PROJECT_URL on every call, duplicating the
// warning getConfig already emitted, and its view of the environment can disagree
// with the view the resolver uses on the very next call.
//
// It also means the tool registered by registerAllTools reads whatever the
// developer happens to have exported, which is a test suite that passes or fails
// by shell.
describe('project_set reads the environment through config, not process.env', () => {
  async function connect(config: FormioConfig) {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerAllTools(server, config, { cwd: () => '/w/registry-cwd' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  it('ignores a FORMIO_PROJECT_URL that getConfig did not accept', async () => {
    process.env.FORMIO_PROJECT_URL = 'https://leaked.form.io';
    try {
      // What getConfig hands the registry after dropping the unusable value: no
      // project at all. The tool must agree, or it reports a project configured
      // for a directory the next tool call will refuse.
      const client = await connect({});

      const result = await client.callTool({
        name: 'project_set',
        arguments: { baseUrl: 'https://forms.mysite.com', cwd: '/w/registry-unmapped' },
      });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(/projectUrl is required/);
    } finally {
      delete process.env.FORMIO_PROJECT_URL;
    }
  });
});

// The suite redirects HOME so no test reads the developer's real ~/.formio. The
// same has to hold for the environment: FORMIO_PROJECT_URL exported in the shell
// that runs vitest is a project configured for every directory, which silently
// inverts every "nothing is configured here" assertion.
describe('the suite environment configures no project', () => {
  it('leaves both URL variables unset', () => {
    expect(environmentAtLoad.projectUrl).toBeUndefined();
    expect(environmentAtLoad.baseUrl).toBeUndefined();
  });
});
