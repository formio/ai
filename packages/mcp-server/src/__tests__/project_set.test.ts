import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readProjectEntry } from '../project-map.js';
import { registerProjectSetTool } from '../tools/project_set.js';

async function createTestClient(options?: {
  cwd?: () => string;
  baseUrl?: () => string | undefined;
}) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerProjectSetTool(server, options);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);

  return { client };
}

function projectsJsonPath(): string {
  return path.join(os.homedir(), '.formio', 'projects.json');
}

describe('project_set tool', () => {
  const cwd = '/workspace/pkg-a';

  it('persists the chosen URL to projects.json for the cwd', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://next.form.io' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://next.form.io' },
    });
    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toContain('https://next.form.io');
  });

  it('strips a trailing slash from the provided URL before persisting', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://next.form.io/' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://next.form.io' },
    });
  });

  it('rejects a value that is not a valid URL and does not write', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'not a url' },
    });

    expect(result.isError).toBe(true);
    expect(readProjectEntry(cwd)).toBeNull();
  });

  it('rejects a non-http protocol and does not write', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'ftp://next.form.io' },
    });

    expect(result.isError).toBe(true);
    expect(readProjectEntry(cwd)).toBeNull();
  });

  it('is listed in available tools', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('project_set');
  });

  it('reports the previous mapped URL in the success message when overwriting', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://first.form.io' },
    });
    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://second.form.io' },
    });

    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toContain('https://second.form.io');
    expect(first.text).toContain('was https://first.form.io');
    expect(readProjectEntry(cwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://second.form.io' },
    });
  });

  it('is a no-op when the on-disk mapping for cwd already matches', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://same.form.io' },
    });
    const mtimeBefore = fs.statSync(projectsJsonPath()).mtimeMs;

    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://same.form.io/' },
    });

    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toContain('already');
    expect(first.text).toContain('no change');
    const mtimeAfter = fs.statSync(projectsJsonPath()).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it('persists FORMIO_BASE_URL alongside FORMIO_PROJECT_URL when a base URL is available', async () => {
    const { client } = await createTestClient({
      cwd: () => cwd,
      baseUrl: () => 'https://api.form.io',
    });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://next.form.io' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://next.form.io',
        FORMIO_BASE_URL: 'https://api.form.io',
      },
    });
  });

  it('persists an explicit baseUrl argument, overriding the env global', async () => {
    const { client } = await createTestClient({
      cwd: () => cwd,
      baseUrl: () => 'https://global.example.com',
    });

    await client.callTool({
      name: 'project_set',
      arguments: {
        projectUrl: 'https://enterprise.example.com/next',
        baseUrl: 'https://enterprise.example.com',
      },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://enterprise.example.com/next',
        FORMIO_BASE_URL: 'https://enterprise.example.com',
      },
    });
  });

  it('strips a trailing slash from an explicit baseUrl argument', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: {
        projectUrl: 'https://enterprise.example.com/next',
        baseUrl: 'https://enterprise.example.com/',
      },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://enterprise.example.com/next',
        FORMIO_BASE_URL: 'https://enterprise.example.com',
      },
    });
  });

  // Sub-domain project routing on a customer deployment: the project host is a
  // sibling of the deployment host, not a path under it. Persisting the pair must
  // not require or impose any containment between the two.
  it('persists a customer pair whose project is a sibling sub-domain of the deployment', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: {
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://forms.mysite.com',
      },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      },
    });
  });

  it('rejects an invalid baseUrl and does not write', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    const result = await client.callTool({
      name: 'project_set',
      arguments: {
        projectUrl: 'https://next.form.io',
        baseUrl: 'not a url',
      },
    });

    expect(result.isError).toBe(true);
    expect(readProjectEntry(cwd)).toBeNull();
  });

  it('strips a trailing slash from the base URL before persisting', async () => {
    const { client } = await createTestClient({
      cwd: () => cwd,
      baseUrl: () => 'https://api.form.io/',
    });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://next.form.io' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://next.form.io',
        FORMIO_BASE_URL: 'https://api.form.io',
      },
    });
  });

  // The realistic case for this is a correction: a hosted project's base URL is
  // always https://api.form.io, so a directory mapped to the project's own
  // subdomain is wrong and re-calling with the right value has to take effect.
  it('rewrites the entry when only the base URL changed for the same project URL', async () => {
    const first = await createTestClient({
      cwd: () => cwd,
      baseUrl: () => 'https://same.form.io',
    });
    await first.client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://same.form.io' },
    });

    const second = await createTestClient({ cwd: () => cwd });
    const result = await second.client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://same.form.io', baseUrl: 'https://api.form.io' },
    });

    const [first0] = result.content as Array<{ type: string; text: string }>;
    expect(first0.text).not.toContain('no change');
    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://same.form.io',
        FORMIO_BASE_URL: 'https://api.form.io',
      },
    });
  });

  // The mapping is the more specific answer for THIS directory, and it is the
  // one resolveProjectConfig honours over the environment at resolve time. A
  // plugin install always carries a FORMIO_BASE_URL (the manifests default it to
  // https://api.form.io), so an environment-first fallback here would rewrite
  // every self-hosted mapping the moment a directory was re-pointed at a sibling
  // project — the exact silent deployment move the fallback exists to prevent.
  it('prefers the mapped base URL over the environment global when no argument is passed', async () => {
    const first = await createTestClient({
      cwd: () => cwd,
      baseUrl: () => 'https://forms.acme.com',
    });
    await first.client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://forms.acme.com/old' },
    });

    const second = await createTestClient({
      cwd: () => cwd,
      baseUrl: () => 'https://api.form.io',
    });
    await second.client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://forms.acme.com/new' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://forms.acme.com/new',
        FORMIO_BASE_URL: 'https://forms.acme.com',
      },
    });
  });

  // Re-pointing a directory at a sibling project must not quietly move it to a
  // different deployment: without an explicit baseUrl and without a global one,
  // the base URL already mapped for that directory stands.
  // FORMIO_BASE_URL reaches the server from a host prompt the user may have
  // cleared, so the global can be an empty string rather than absent. It has to
  // fall through to the mapped value like any other missing global.
  it('keeps the mapped base URL when the global is set but empty', async () => {
    const { client } = await createTestClient({ cwd: () => cwd, baseUrl: () => '' });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://forms.acme.com/old', baseUrl: 'https://forms.acme.com' },
    });
    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://forms.acme.com/new' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://forms.acme.com/new',
        FORMIO_BASE_URL: 'https://forms.acme.com',
      },
    });
  });

  it('keeps the mapped base URL when neither an argument nor a global supplies one', async () => {
    const { client } = await createTestClient({ cwd: () => cwd, baseUrl: () => undefined });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://forms.acme.com/old', baseUrl: 'https://forms.acme.com' },
    });
    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://forms.acme.com/new' },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://forms.acme.com/new',
        FORMIO_BASE_URL: 'https://forms.acme.com',
      },
    });
  });

  // The server's process cwd is fixed at spawn and, for a plugin-launched
  // server, is not where the user is. Writing there silently produces a mapping
  // no cwd-passing call will ever find, so the caller is told what was keyed.
  it('warns that the mapping was keyed on the server cwd when no cwd argument is passed', async () => {
    const serverCwd = '/workspace/server-root';
    const { client } = await createTestClient({ cwd: () => serverCwd });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://next.form.io' },
    });

    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toContain(serverCwd);
    expect(first.text).toMatch(/cwd/);
    expect(first.text).toMatch(/warning/i);
  });

  it('does not warn when the caller passes a cwd', async () => {
    const { client } = await createTestClient({ cwd: () => '/workspace/server-root' });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://next.form.io', cwd },
    });

    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).not.toMatch(/warning/i);
  });

  it('persists under the explicit cwd argument when provided, ignoring server cwd', async () => {
    const serverCwd = '/workspace/server-root';
    const userCwd = '/workspace/server-root/packages/inner';
    const { client } = await createTestClient({ cwd: () => serverCwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://next.form.io', cwd: userCwd },
    });

    expect(readProjectEntry(userCwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://next.form.io' },
    });
    expect(readProjectEntry(serverCwd)).toBeNull();
  });

  // The default global reader is the one production uses through registerAllTools,
  // and every shipped manifest sets FORMIO_BASE_URL from a host variable. An
  // unsubstituted "${FORMIO_BASE_URL}" is truthy, so taken raw it failed the whole
  // call — leaving a fresh directory with no way to map any project at all.
  describe('reading the global FORMIO_BASE_URL from the environment', () => {
    const originalBaseUrl = process.env.FORMIO_BASE_URL;

    afterEach(() => {
      if (originalBaseUrl === undefined) {
        delete process.env.FORMIO_BASE_URL;
      } else {
        process.env.FORMIO_BASE_URL = originalBaseUrl;
      }
    });

    it('maps the directory anyway when the global is an unsubstituted literal', async () => {
      process.env.FORMIO_BASE_URL = '${FORMIO_BASE_URL}';
      const { client } = await createTestClient({ cwd: () => cwd });

      const result = await client.callTool({
        name: 'project_set',
        arguments: { projectUrl: 'https://next.form.io' },
      });

      expect(result.isError).toBeFalsy();
      expect(readProjectEntry(cwd)).toEqual({
        env: { FORMIO_PROJECT_URL: 'https://next.form.io' },
      });
    });

    it('persists a usable global', async () => {
      process.env.FORMIO_BASE_URL = 'https://forms.acme.com/';
      const { client } = await createTestClient({ cwd: () => cwd });

      await client.callTool({
        name: 'project_set',
        arguments: { projectUrl: 'https://forms.acme.com/next' },
      });

      expect(readProjectEntry(cwd)).toEqual({
        env: {
          FORMIO_PROJECT_URL: 'https://forms.acme.com/next',
          FORMIO_BASE_URL: 'https://forms.acme.com',
        },
      });
    });
  });

  it('does not write to projects.json when the URL is rejected', async () => {
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'ftp://next.form.io' },
    });

    expect(readProjectEntry(cwd)).toBeNull();
  });
});
