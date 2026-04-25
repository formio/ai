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

const { registerActionGetTool } = await import('../tools/action_get.js');

describe('action_get tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with formId and actionId parameters', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerActionGetTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_get');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.properties).toHaveProperty('actionId');
    expect(tool!.inputSchema.required).toContain('formId');
    expect(tool!.inputSchema.required).toContain('actionId');
  });

  it('sends GET to /form/{formId}/action/{actionId} and returns action document', async () => {
    const formId = '67890abcdef012345678abcd';
    const actionId = 'abcdef012345678901234567';
    const action = { _id: actionId, name: 'email', title: 'Send Email' };
    mockFormioFetch.mockResolvedValue(action);
    const { client } = await createTestClient(registerActionGetTool);

    const result = await client.callTool({
      name: 'action_get',
      arguments: { cwd: TEST_CWD, formId, actionId },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${formId}/action/${actionId}`,
      {},
      TEST_CONFIG
    );
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(action, null, 2) }]);
  });

  it('returns MCP error on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerActionGetTool);

    const result = await client.callTool({
      name: 'action_get',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        actionId: 'nonexistent000000000000',
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });
});
