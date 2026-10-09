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

const FORM_ID = '67890abcdef012345678abcd';

function actions(count: number) {
  return Array.from({ length: count }, (_, index) => ({ _id: `${index}`, name: 'email' }));
}

describe('action_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    mockFormioFetch.mockResolvedValue({ data: [], total: 0 });
  });

  it('is listed in available tools with formId parameter', async () => {
    const { client } = await createTestClient(registerActionListTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_list');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.required).toContain('formId');
  });

  it('sends GET to /form/{formId}/action with limit 100 and skip 0, returning every action', async () => {
    const page = actions(11);
    mockFormioFetch.mockResolvedValue({ data: page, total: 11 });
    const { client } = await createTestClient(registerActionListTool);

    const result = await client.callTool({
      name: 'action_list',
      arguments: { cwd: TEST_CWD, formId: FORM_ID },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${FORM_ID}/action`,
      { limit: '100', skip: '0' },
      TEST_CONFIG,
      { withMeta: true }
    );
    expect(result.structuredContent).toEqual({ actions: page, total: 11, hasMore: false });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify({ actions: page, total: 11, hasMore: false }, null, 2),
      },
    ]);
  });

  it('forwards sort and select', async () => {
    const { client } = await createTestClient(registerActionListTool);

    await client.callTool({
      name: 'action_list',
      arguments: { cwd: TEST_CWD, formId: FORM_ID, sort: '-priority', select: 'name,priority' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${FORM_ID}/action`,
      { limit: '100', skip: '0', sort: '-priority', select: 'name,priority' },
      TEST_CONFIG,
      { withMeta: true }
    );
  });

  it('answers a skip past the end with no actions and the total, not an error', async () => {
    mockFormioFetch.mockResolvedValue({ data: [], total: 3 });
    const { client } = await createTestClient(registerActionListTool);

    const result = await client.callTool({
      name: 'action_list',
      arguments: { cwd: TEST_CWD, formId: FORM_ID, skip: 500 },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ actions: [], total: 3, hasMore: false });
  });

  it('returns MCP error on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 500'));
    const { client } = await createTestClient(registerActionListTool);

    const result = await client.callTool({
      name: 'action_list',
      arguments: { cwd: TEST_CWD, formId: '0000000000000000000000ff' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('500') }),
    ]);
  });
});
