import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', () => ({
  formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
}));

const { registerRoleCreateTool } = await import('../tools/role_create.js');

describe('role_create tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with title, description, default, and admin parameters', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerRoleCreateTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('role_create');
  });

  it('sends POST /role with title only and returns created role', async () => {
    const created = {
      _id: '69d68310040fa2cea2572945',
      title: 'Employee',
      default: false,
      admin: false,
    };
    mockFormioFetch.mockResolvedValue(created);
    const { client } = await createTestClient(registerRoleCreateTool);

    const result = await client.callTool({
      name: 'role_create',
      arguments: { cwd: TEST_CWD, title: 'Employee' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith('role', {}, TEST_CONFIG, {
      method: 'POST',
      body: { title: 'Employee' },
    });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(created, null, 2) }]);
  });

  it('includes all fields in request body when provided', async () => {
    mockFormioFetch.mockResolvedValue({ _id: '123' });
    const { client } = await createTestClient(registerRoleCreateTool);

    const args = {
      title: 'Manager',
      description: 'A management role',
      default: false,
      admin: false,
    };
    await client.callTool({ name: 'role_create', arguments: { cwd: TEST_CWD, ...args } });

    expect(mockFormioFetch).toHaveBeenCalledWith('role', {}, TEST_CONFIG, {
      method: 'POST',
      body: args,
    });
  });

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 400 Bad Request'));
    const { client } = await createTestClient(registerRoleCreateTool);

    const result = await client.callTool({
      name: 'role_create',
      arguments: { cwd: TEST_CWD, title: 'Test' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('400') }),
    ]);
  });
});
