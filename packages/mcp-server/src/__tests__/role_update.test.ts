import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...actual,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerRoleUpdateTool } = await import('../tools/role_update.js');

describe('role_update tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with full-replacement guidance', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerRoleUpdateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'role_update');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain('full replacement');
  });

  it('returns isError for invalid roleId format', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerRoleUpdateTool);

    const result = await client.callTool({
      name: 'role_update',
      arguments: {
        cwd: TEST_CWD,
        roleId: 'not-valid',
        role: { title: 'Test' },
      },
    });

    expect(result.isError).toBe(true);
  });

  it('sends PUT /role/:roleId with role body and returns updated role', async () => {
    const roleId = '69d68310040fa2cea2572945';
    const updated = { _id: roleId, title: 'Senior Employee', description: 'Updated role' };
    mockFormioFetch.mockResolvedValue(updated);
    const { client } = await createTestClient(registerRoleUpdateTool);

    const role = { title: 'Senior Employee', description: 'Updated role' };
    const result = await client.callTool({
      name: 'role_update',
      arguments: { cwd: TEST_CWD, roleId, role },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`role/${roleId}`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: role,
    });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(updated, null, 2) }]);
  });

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404'));
    const { client } = await createTestClient(registerRoleUpdateTool);

    const result = await client.callTool({
      name: 'role_update',
      arguments: {
        cwd: TEST_CWD,
        roleId: '69d68310040fa2cea2572945',
        role: { title: 'Test' },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });
});
