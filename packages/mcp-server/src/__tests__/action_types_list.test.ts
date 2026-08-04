import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerActionTypesListTool } = await import('../tools/action_types_list.js');

describe('action_types_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with formId parameter', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerActionTypesListTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_types_list');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.required).toContain('formId');
  });

  it('sends GET to /form/{formId}/actions and returns catalog array', async () => {
    const formId = '67890abcdef012345678abcd';
    const catalog = [
      { name: 'email', title: 'Email' },
      { name: 'save', title: 'Save Submission' },
    ];
    mockFormioFetch.mockResolvedValue(catalog);
    const { client } = await createTestClient(registerActionTypesListTool);

    const result = await client.callTool({
      name: 'action_types_list',
      arguments: { cwd: TEST_CWD, formId },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}/actions`, {}, TEST_CONFIG);
    expect(result.structuredContent).toEqual({ actionTypes: catalog, count: 2 });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ actionTypes: catalog, count: 2 }, null, 2) },
    ]);
  });

  it('returns MCP error on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404'));
    const { client } = await createTestClient(registerActionTypesListTool);

    const result = await client.callTool({
      name: 'action_types_list',
      arguments: { cwd: TEST_CWD, formId: 'nonexistent0000000000000' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });
});
