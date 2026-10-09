import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', () => ({
  formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
}));

const { registerRoleListTool } = await import('../tools/role_list.js');

function roles(count: number) {
  return Array.from({ length: count }, (_, index) => ({ _id: `${index}`, title: `Role ${index}` }));
}

describe('role_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    mockFormioFetch.mockResolvedValue({ data: [], total: 0 });
  });

  it('is listed in available tools', async () => {
    const { client } = await createTestClient(registerRoleListTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('role_list');
  });

  // Form.io's own default page is 10, so a project with 12 roles used to come back
  // truncated with nothing saying so.
  it('sends limit 100 and skip 0 by default and returns every role with the total', async () => {
    const page = roles(12);
    mockFormioFetch.mockResolvedValue({ data: page, total: 12 });
    const { client } = await createTestClient(registerRoleListTool);

    const result = await client.callTool({ name: 'role_list', arguments: { cwd: TEST_CWD } });

    expect(mockFormioFetch).toHaveBeenCalledWith('role', { limit: '100', skip: '0' }, TEST_CONFIG, {
      withMeta: true,
    });
    expect(result.structuredContent).toEqual({ roles: page, total: 12, hasMore: false });
  });

  it('forwards limit, skip, sort and select', async () => {
    const { client } = await createTestClient(registerRoleListTool);

    await client.callTool({
      name: 'role_list',
      arguments: { cwd: TEST_CWD, limit: 5, skip: 5, sort: 'title', select: '_id,title' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'role',
      { limit: '5', skip: '5', sort: 'title', select: '_id,title' },
      TEST_CONFIG,
      { withMeta: true }
    );
  });

  it('reports hasMore when Form.io holds more roles than the page', async () => {
    mockFormioFetch.mockResolvedValue({ data: roles(5), total: 12 });
    const { client } = await createTestClient(registerRoleListTool);

    const result = await client.callTool({
      name: 'role_list',
      arguments: { cwd: TEST_CWD, limit: 5 },
    });

    expect(result.structuredContent).toMatchObject({ total: 12, hasMore: true });
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
