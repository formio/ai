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

  it('takes the working directory and a role object whose title is required', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerRoleCreateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'role_create');
    expect(tool).toBeDefined();
    expect(Object.keys(tool!.inputSchema.properties ?? {}).sort()).toEqual(['cwd', 'role']);
    expect(tool!.inputSchema.required).toContain('role');
    const role = (tool!.inputSchema.properties as Record<string, Record<string, unknown>>).role;
    expect(Object.keys(role.properties as Record<string, unknown>).sort()).toEqual([
      'admin',
      'default',
      'description',
      'title',
    ]);
    expect(role.required).toEqual(['title']);
  });

  it('refuses flat role fields without a request', async () => {
    const { client } = await createTestClient(registerRoleCreateTool);

    const result = await client.callTool({
      name: 'role_create',
      arguments: { cwd: TEST_CWD, title: 'Employee' },
    });

    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('refuses a role without a title without a request', async () => {
    const { client } = await createTestClient(registerRoleCreateTool);

    const result = await client.callTool({
      name: 'role_create',
      arguments: { cwd: TEST_CWD, role: { description: 'No title' } },
    });

    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
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
      arguments: { cwd: TEST_CWD, role: { title: 'Employee' } },
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
    await client.callTool({ name: 'role_create', arguments: { cwd: TEST_CWD, role: args } });

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
      arguments: { cwd: TEST_CWD, role: { title: 'Test' } },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('400') }),
    ]);
  });
});
