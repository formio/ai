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

const { registerActionUpdateTool } = await import('../tools/action_update.js');

describe('action_update tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with formId, actionId, and action parameters', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerActionUpdateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_update');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.properties).toHaveProperty('actionId');
    expect(tool!.inputSchema.properties).toHaveProperty('action');
    expect(tool!.inputSchema.required).toContain('formId');
    expect(tool!.inputSchema.required).toContain('actionId');
    expect(tool!.inputSchema.required).toContain('action');
  });

  it('sends PUT to /form/{formId}/action/{actionId} with action definition body', async () => {
    const formId = '67890abcdef012345678abcd';
    const actionId = 'abcdef012345678901234567';
    const actionDef = {
      name: 'email',
      title: 'Updated Email',
      handler: ['after'],
      method: ['create'],
    };
    const updated = { _id: actionId, ...actionDef };
    mockFormioFetch.mockResolvedValue(updated);
    const { client } = await createTestClient(registerActionUpdateTool);

    const result = await client.callTool({
      name: 'action_update',
      arguments: { cwd: TEST_CWD, formId, actionId, action: actionDef },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${formId}/action/${actionId}`,
      {},
      TEST_CONFIG,
      { method: 'PUT', body: actionDef }
    );
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(updated, null, 2) }]);
  });

  it('returns MCP error on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerActionUpdateTool);

    const result = await client.callTool({
      name: 'action_update',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        actionId: 'nonexistent000000000000',
        action: { name: 'email', title: 'Email', handler: ['after'], method: ['create'] },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });
});
