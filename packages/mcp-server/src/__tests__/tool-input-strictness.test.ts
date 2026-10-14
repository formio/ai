// Every tool refuses an argument it does not declare, by name, before it runs. A
// silently dropped argument — `projectUrl` on a project-scoped tool, a misspelled
// `acceptNoHistory` — makes the call act on something other than what the caller
// asked for and report success. The documents a tool sends (a form, an action, a
// role, a template) stay open, since their fields are Form.io's own.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  connectTools,
  createTestClient,
  stubRevisionsLicence,
  TEST_CONFIG,
  TEST_CWD,
} from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerAllTools } = await import('../tools/index.js');
const { registerFormUpdateTool } = await import('../tools/form_update.js');

const formId = '67890abcdef012345678abcd';

function resultText(result: Record<string, unknown>): string {
  const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
  return content.map((part) => part.text ?? '').join('\n');
}

describe('tool input strictness', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    stubRevisionsLicence(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('declares additionalProperties: false on every tool input schema', async () => {
    const client = await connectTools((server) => registerAllTools(server, TEST_CONFIG));
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    const open = tools
      .filter((tool) => tool.inputSchema.additionalProperties !== false)
      .map((tool) => tool.name);
    expect(open).toEqual([]);
  });

  it('refuses an undeclared argument by name without calling Form.io', async () => {
    const { client } = await createTestClient(registerFormUpdateTool);
    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId,
        projectUrl: 'https://other.form.io',
        form: { components: [] },
        note: 'retitle',
      },
    });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain('projectUrl');
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('still sends a form field the schema does not list', async () => {
    mockFormioFetch.mockResolvedValue({ _id: formId, revisions: 'original' });
    const { client } = await createTestClient(registerFormUpdateTool);
    const form = { components: [], settings: { theme: 'dark' }, properties: { team: 'ops' } };

    const result = await client.callTool({
      name: 'form_update',
      arguments: { cwd: TEST_CWD, formId, form, note: 'settings' },
    });

    expect(result.isError, resultText(result)).toBeFalsy();
    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: { ...form, _vnote: '@formio/mcp: settings' },
    });
  });
});
