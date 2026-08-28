import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';
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
      env: { FORMIO_PROJECT_URL: 'https://next.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
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
      env: { FORMIO_PROJECT_URL: 'https://next.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
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
      env: { FORMIO_PROJECT_URL: 'https://second.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
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

  // The global applies to the ONE project shape that cannot derive a deployment:
  // a path-less project URL on a customer domain, whose deployment is a sibling
  // sub-domain nothing in the project URL names.
  it('persists FORMIO_BASE_URL alongside FORMIO_PROJECT_URL when the shape cannot derive one', async () => {
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
    const { client } = await createTestClient({ cwd: () => cwd });

    await client.callTool({
      name: 'project_set',
      arguments: {
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://forms.mysite.com/',
      },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      },
    });
  });

  // The realistic case for this is a correction: a hosted project's base URL is
  // always https://api.form.io, so a directory mapped to the project's own
  // subdomain is wrong and re-calling with the right value has to take effect.
  it('rewrites the entry when only the base URL changed for the same project URL', async () => {
    const first = await createTestClient({ cwd: () => cwd });
    await first.client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://same.form.io', baseUrl: 'https://same.form.io' },
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
      env: { FORMIO_PROJECT_URL: 'https://next.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
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
        env: { FORMIO_PROJECT_URL: 'https://next.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
      });
    });
  });

  // The stored base URL is data, not the caller's typing, and this call is the
  // documented repair for a directory whose mapping is unusable. Normalizing it
  // strictly made the repair fail with the same error it was called to clear.
  it('re-maps a directory whose stored base URL is not a URL', async () => {
    writeProjectEntry({
      cwd: cwd,
      env: {
        FORMIO_PROJECT_URL: 'https://old.form.io',
        FORMIO_BASE_URL: 'forms.mysite.com',
      },
    });
    const { client } = await createTestClient({ cwd: () => cwd, baseUrl: () => undefined });

    const result = await client.callTool({
      name: 'project_set',
      arguments: { projectUrl: 'https://new.form.io', cwd },
    });

    expect(result.isError).toBeFalsy();
    expect(readProjectEntry(cwd)).toEqual({
      env: { FORMIO_PROJECT_URL: 'https://new.form.io', FORMIO_BASE_URL: 'https://api.form.io' },
    });
  });

  it('lets an explicit baseUrl replace an unusable stored one', async () => {
    writeProjectEntry({
      cwd: cwd,
      env: {
        FORMIO_PROJECT_URL: 'https://old.form.io',
        FORMIO_BASE_URL: 'forms.mysite.com',
      },
    });
    const { client } = await createTestClient({ cwd: () => cwd, baseUrl: () => undefined });

    await client.callTool({
      name: 'project_set',
      arguments: {
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://forms.mysite.com',
        cwd,
      },
    });

    expect(readProjectEntry(cwd)).toEqual({
      env: {
        FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
        FORMIO_BASE_URL: 'https://forms.mysite.com',
      },
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
