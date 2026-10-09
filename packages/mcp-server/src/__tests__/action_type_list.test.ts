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

const { registerActionTypeListTool } = await import('../tools/action_type_list.js');

describe('action_type_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed with a formId parameter and no paging arguments', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerActionTypeListTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_type_list');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.required).toContain('formId');
    for (const paging of ['limit', 'skip', 'sort', 'select']) {
      expect(tool!.inputSchema.properties).not.toHaveProperty(paging);
    }
  });

  // Form.io does not page this route, so the whole catalog is one answer.
  it('sends GET to /form/{formId}/actions and returns the whole catalog', async () => {
    const formId = '67890abcdef012345678abcd';
    const catalog = [
      { name: 'email', title: 'Email' },
      { name: 'save', title: 'Save Submission' },
    ];
    mockFormioFetch.mockResolvedValue(catalog);
    const { client } = await createTestClient(registerActionTypeListTool);

    const result = await client.callTool({
      name: 'action_type_list',
      arguments: { cwd: TEST_CWD, formId },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}/actions`, {}, TEST_CONFIG);
    expect(result.structuredContent).toEqual({ actionTypes: catalog, total: 2, hasMore: false });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify({ actionTypes: catalog, total: 2, hasMore: false }, null, 2),
      },
    ]);
  });

  it('returns MCP error on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404'));
    const { client } = await createTestClient(registerActionTypeListTool);

    const result = await client.callTool({
      name: 'action_type_list',
      arguments: { cwd: TEST_CWD, formId: '0000000000000000000000ff' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });
});
