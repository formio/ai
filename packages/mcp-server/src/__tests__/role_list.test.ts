import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', () => ({
  formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
}));

const { registerRoleListTool } = await import('../tools/role_list.js');

describe('role_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with optional select parameter', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerRoleListTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('role_list');
  });

  it('calls GET /role with no query params by default and returns JSON array', async () => {
    const roles = [
      { _id: '69d65f4e040fa2cea2572254', title: 'Administrator' },
      { _id: '69d65f4e040fa2cea2572255', title: 'Authenticated' },
    ];
    mockFormioFetch.mockResolvedValue(roles);
    const { client } = await createTestClient(registerRoleListTool);

    const result = await client.callTool({ name: 'role_list', arguments: { cwd: TEST_CWD } });

    expect(mockFormioFetch).toHaveBeenCalledWith('role', { select: undefined }, TEST_CONFIG);
    expect(result.structuredContent).toEqual({ roles, count: 2 });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ roles, count: 2 }, null, 2) },
    ]);
  });

  it('forwards custom select as query parameter', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerRoleListTool);

    await client.callTool({ name: 'role_list', arguments: { cwd: TEST_CWD, select: '_id,title' } });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'role',
      expect.objectContaining({ select: '_id,title' }),
      TEST_CONFIG
    );
  });

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 401 Unauthorized'));
    const { client } = await createTestClient(registerRoleListTool);

    const result = await client.callTool({ name: 'role_list', arguments: { cwd: TEST_CWD } });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('401') }),
    ]);
  });
});
