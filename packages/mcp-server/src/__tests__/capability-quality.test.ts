/**
 * Asserts the qualities a client — human or automated — needs in order to use
 * this server's tools without reading its source.
 *
 * Every tool must be discoverable with NO configuration present, then describe
 * itself well enough to be called correctly: what it does, what each parameter
 * accepts, what comes back, and whether calling it is safe to retry or will
 * change data. Directory crawlers score exactly these properties, but the reason
 * to hold the line is that an assistant choosing between twenty tools has
 * nothing else to go on.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../server.js';

const originalEnv = process.env;

/** Boots the server the way an unconfigured client does: bare environment. */
async function listToolsUnconfigured(): Promise<Tool[]> {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'capability-probe', version: '0.0.0' });
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  return tools;
}

describe('capability quality', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FORMIO_BASE_URL;
    delete process.env.FORMIO_PROJECT_URL;
    delete process.env.FORMIO_API_KEY;
    delete process.env.FORMIO_LOGIN_FORM;
    delete process.env.FORMIO_PLUGIN_CONTEXT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('starts and enumerates its tools with no configuration at all', async () => {
    const tools = await listToolsUnconfigured();
    // The whole standalone surface, minus project_set (plugin context only).
    expect(tools.length).toBe(19);
    expect(tools.map((t) => t.name)).toContain('form_list');
  });

  it('still reports a missing project URL clearly when a tool is called', async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'capability-probe', version: '0.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'form_list', arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toMatch(/FORMIO_PROJECT_URL/);
  });

  it('describes what every tool does', async () => {
    const tools = await listToolsUnconfigured();
    for (const tool of tools) {
      expect(tool.description, `${tool.name} has no description`).toBeTruthy();
      // A one-word description technically satisfies "has a description" while
      // telling a caller nothing.
      expect(tool.description!.length, `${tool.name} description is too terse`).toBeGreaterThan(30);
    }
  });

  it('describes what every input parameter accepts', async () => {
    const tools = await listToolsUnconfigured();
    for (const tool of tools) {
      const properties = (tool.inputSchema?.properties ?? {}) as Record<
        string,
        { description?: string }
      >;
      for (const [name, schema] of Object.entries(properties)) {
        expect(schema.description, `${tool.name}.${name} has no description`).toBeTruthy();
      }
    }
  });

  it('declares an output schema so callers can type-check responses', async () => {
    const tools = await listToolsUnconfigured();
    for (const tool of tools) {
      expect(tool.outputSchema, `${tool.name} has no outputSchema`).toBeTruthy();
      expect(tool.outputSchema!.type).toBe('object');
    }
  });

  it('annotates whether each tool reads or writes', async () => {
    const tools = await listToolsUnconfigured();
    for (const tool of tools) {
      const annotations = tool.annotations;
      expect(annotations, `${tool.name} has no annotations`).toBeTruthy();
      expect(annotations!.title, `${tool.name} has no annotation title`).toBeTruthy();
      expect(typeof annotations!.readOnlyHint, `${tool.name} does not declare readOnlyHint`).toBe(
        'boolean'
      );
      // A read-only tool cannot also be destructive; asserting the pair stays
      // coherent catches copy-paste drift between tool files.
      if (annotations!.readOnlyHint) {
        expect(annotations!.destructiveHint, `${tool.name} is read-only yet destructive`).toBe(
          false
        );
      }
    }
  });

  it('marks the delete tool destructive and the read tools not', async () => {
    const tools = await listToolsUnconfigured();
    const byName = new Map(tools.map((t) => [t.name, t]));
    expect(byName.get('action_delete')!.annotations!.destructiveHint).toBe(true);
    for (const name of ['form_list', 'form_get', 'role_list', 'action_list', 'project_export']) {
      expect(byName.get(name)!.annotations!.readOnlyHint, `${name} should be read-only`).toBe(true);
    }
    for (const name of ['form_create', 'form_update', 'role_create', 'project_import']) {
      expect(byName.get(name)!.annotations!.readOnlyHint, `${name} writes`).toBe(false);
    }
  });
});
