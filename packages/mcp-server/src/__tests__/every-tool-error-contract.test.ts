// Every registered tool reports a failure the same way: `[CODE] message` in the text,
// with CODE one of the shared codes, and the code under `_meta['io.form/error']`. One
// error path is driven per tool, against the full registry, so a tool added later
// without a case fails here rather than shipping a failure that carries no code.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_META_KEY } from '../mcp-responses.js';
import { TOOL_ERROR_CODES } from '../tool-errors.js';
import { registerAllTools } from '../tools/index.js';
import { connectTools } from './test-helpers.js';

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  _meta?: Record<string, { code?: string } | undefined>;
}

const UNCONFIGURED = '/workspace/every-tool-unconfigured';
const FORM_ID = '67890abcdef012345678abcd';
const OBJECT_ID = '69d68310040fa2cea2572945';
const ACTION = { name: 'email', title: 'Email', handler: ['after'], method: ['create'] };

// The project-scoped tools fail on a directory with no project, before any request.
const PROJECT_SCOPED: Record<string, Record<string, unknown>> = {
  form_create: { form: { title: 'T', name: 't', path: 't', components: [] } },
  form_get: { formIdOrPath: 'contact' },
  form_list: {},
  form_revision_get: { formIdOrPath: 'contact', version: '1' },
  form_revision_list: { formIdOrPath: 'contact' },
  form_update: { formId: FORM_ID, form: { components: [] }, note: 'n' },
  form_publish: { formId: FORM_ID, note: 'n' },
  form_revert: { formId: FORM_ID, version: '1', note: 'n' },
  project_export: {},
  project_import: { template: {} },
  role_create: { role: { title: 'R' } },
  role_list: {},
  role_update: { roleId: OBJECT_ID, role: { title: 'R' } },
  action_type_list: { formId: FORM_ID },
  action_type_get: { formId: FORM_ID, actionName: 'email' },
  action_create: { formId: FORM_ID, action: ACTION },
  action_list: { formId: FORM_ID },
  action_get: { formId: FORM_ID, actionId: OBJECT_ID },
  action_update: { formId: FORM_ID, actionId: OBJECT_ID, action: ACTION },
  action_delete: { formId: FORM_ID, actionId: OBJECT_ID },
};

// The local tools make no request; each fails on its own input or on an unreadable
// project map.
const LOCAL: Record<string, { args: Record<string, unknown>; unreadableMap?: boolean }> = {
  project_set: { args: { projectUrl: 'not a url', cwd: UNCONFIGURED } },
  project_get: { args: { cwd: UNCONFIGURED }, unreadableMap: true },
  server_status: { args: { cwd: UNCONFIGURED }, unreadableMap: true },
};

// Tools that cannot fail on any input, each with the reason. Empty today.
const CANNOT_ERROR: Record<string, string> = {};

function breakProjectMap(): void {
  const dir = path.join(os.homedir(), '.formio');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'projects.json'), '{ not json', 'utf8');
}

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const client = await connectTools((server) => registerAllTools(server, {}));
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

function expectCodedError(result: ToolResult): void {
  const text = result.content.map((part) => part.text ?? '').join('\n');
  const code = result._meta?.[ERROR_META_KEY]?.code;
  expect(result.isError).toBe(true);
  expect(TOOL_ERROR_CODES).toContain(code);
  expect(text.startsWith(`[${code}] `), text).toBe(true);
}

describe('every tool reports a failure with a code', () => {
  beforeEach(() => {
    // No case here reaches Form.io; a request would mean the error path was missed.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('unexpected request');
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has a case, or a stated reason, for every registered tool', async () => {
    const client = await connectTools((server) => registerAllTools(server, {}));
    const { tools } = await client.listTools();
    const covered = [
      ...Object.keys(PROJECT_SCOPED),
      ...Object.keys(LOCAL),
      ...Object.keys(CANNOT_ERROR),
    ];
    expect(tools.map((tool) => tool.name).sort()).toEqual(covered.sort());
  });

  it.each(Object.entries(PROJECT_SCOPED))('%s', async (name, args) => {
    const result = await callTool(name, { cwd: UNCONFIGURED, ...args });

    expectCodedError(result);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('NOT_CONFIGURED');
  });

  it.each(Object.entries(LOCAL))('%s', async (name, { args, unreadableMap }) => {
    if (unreadableMap) {
      breakProjectMap();
    }

    expectCodedError(await callTool(name, args));
  });
});
