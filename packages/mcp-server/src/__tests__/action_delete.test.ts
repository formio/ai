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

const { registerActionDeleteTool } = await import('../tools/action_delete.js');

describe('action_delete tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with formId and actionId parameters', async () => {
    mockFormioFetch.mockResolvedValue('OK');
    const { client } = await createTestClient(registerActionDeleteTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_delete');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.properties).toHaveProperty('actionId');
    expect(tool!.inputSchema.required).toContain('formId');
    expect(tool!.inputSchema.required).toContain('actionId');
  });

  it('sends DELETE to /form/{formId}/action/{actionId} and returns success', async () => {
    const formId = '67890abcdef012345678abcd';
    const actionId = 'abcdef012345678901234567';
    mockFormioFetch.mockResolvedValue('OK');
    const { client } = await createTestClient(registerActionDeleteTool);

    const result = await client.callTool({
      name: 'action_delete',
      arguments: { cwd: TEST_CWD, formId, actionId },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${formId}/action/${actionId}`,
      {},
      TEST_CONFIG,
      { method: 'DELETE', responseType: 'text' }
    );
    expect(result.content).toEqual([{ type: 'text', text: 'OK' }]);
  });

  it('returns MCP error on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerActionDeleteTool);

    const result = await client.callTool({
      name: 'action_delete',
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
