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

const { registerActionListTool } = await import('../tools/action_list.js');

describe('action_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with formId parameter', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerActionListTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_list');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.required).toContain('formId');
  });

  it('sends GET to /form/{formId}/action and returns action instances array', async () => {
    const formId = '67890abcdef012345678abcd';
    const actions = [
      { _id: 'aaa', name: 'email', title: 'Send Email' },
      { _id: 'bbb', name: 'save', title: 'Save Submission' },
    ];
    mockFormioFetch.mockResolvedValue(actions);
    const { client } = await createTestClient(registerActionListTool);

    const result = await client.callTool({
      name: 'action_list',
      arguments: { cwd: TEST_CWD, formId },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}/action`, {}, TEST_CONFIG);
    expect(result.structuredContent).toEqual({ actions, count: 2 });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ actions, count: 2 }, null, 2) },
    ]);
  });

  it('returns MCP error on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 500'));
    const { client } = await createTestClient(registerActionListTool);

    const result = await client.callTool({
      name: 'action_list',
      arguments: { cwd: TEST_CWD, formId: 'nonexistent0000000000000' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('500') }),
    ]);
  });
});
