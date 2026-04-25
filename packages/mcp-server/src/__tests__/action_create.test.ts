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

const { registerActionCreateTool } = await import('../tools/action_create.js');

describe('action_create tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with formId and action parameters, description references action_type_get', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerActionCreateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_create');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.properties).toHaveProperty('action');
    expect(tool!.inputSchema.required).toContain('formId');
    expect(tool!.inputSchema.required).toContain('action');
    expect(tool!.description).toMatch(/action_type_get/);
  });

  it('sends POST to /form/{formId}/action with minimum action definition', async () => {
    const formId = '67890abcdef012345678abcd';
    const actionDef = {
      name: 'email',
      title: 'Email',
      handler: ['after'],
      method: ['create'],
    };
    const created = { _id: 'aaa111bbb222ccc333ddd444', ...actionDef };
    // First call: catalog fetch for validation
    mockFormioFetch.mockResolvedValueOnce([
      { name: 'email', title: 'Email' },
      { name: 'save', title: 'Save Submission' },
    ]);
    // Second call: POST to create
    mockFormioFetch.mockResolvedValueOnce(created);
    const { client } = await createTestClient(registerActionCreateTool);

    const result = await client.callTool({
      name: 'action_create',
      arguments: { cwd: TEST_CWD, formId, action: actionDef },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}/action`, {}, TEST_CONFIG, {
      method: 'POST',
      body: actionDef,
    });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(created, null, 2) }]);
  });

  it('sends POST with full definition including settings, condition, and priority', async () => {
    const formId = '67890abcdef012345678abcd';
    const actionDef = {
      name: 'email',
      title: 'Email',
      handler: ['after'],
      method: ['create'],
      priority: 0,
      settings: {
        transport: 'default',
        from: 'no-reply@example.com',
        emails: ['user@example.com'],
        subject: 'New submission',
        message: '{{ submission }}',
      },
      condition: {
        conjunction: 'all' as const,
        conditions: [{ component: 'status', operator: 'isEqual' as const, value: 'approved' }],
      },
    };
    const created = { _id: 'aaa111bbb222ccc333ddd444', ...actionDef };
    // Catalog fetch
    mockFormioFetch.mockResolvedValueOnce([{ name: 'email', title: 'Email' }]);
    // POST
    mockFormioFetch.mockResolvedValueOnce(created);
    const { client } = await createTestClient(registerActionCreateTool);

    const result = await client.callTool({
      name: 'action_create',
      arguments: { cwd: TEST_CWD, formId, action: actionDef },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}/action`, {}, TEST_CONFIG, {
      method: 'POST',
      body: actionDef,
    });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(created, null, 2) }]);
  });

  it('validates action type against server catalog and returns available types on mismatch', async () => {
    const formId = '67890abcdef012345678abcd';
    const actionDef = {
      name: 'oauth',
      title: 'OAuth',
      handler: ['before'],
      method: ['create'],
    };
    // Catalog fetch returns types that don't include 'oauth'
    mockFormioFetch.mockResolvedValueOnce([
      { name: 'email', title: 'Email' },
      { name: 'save', title: 'Save Submission' },
      { name: 'login', title: 'Login' },
    ]);
    const { client } = await createTestClient(registerActionCreateTool);

    const result = await client.callTool({
      name: 'action_create',
      arguments: { cwd: TEST_CWD, formId, action: actionDef },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining(
          "Action type 'oauth' is not available on this server. Available types: email, save, login"
        ),
      }),
    ]);
    // Should NOT have attempted the POST
    expect(mockFormioFetch).toHaveBeenCalledTimes(1);
  });

  it('returns MCP error on API failure', async () => {
    const formId = '67890abcdef012345678abcd';
    const actionDef = {
      name: 'email',
      title: 'Email',
      handler: ['after'],
      method: ['create'],
    };
    // Catalog fetch succeeds
    mockFormioFetch.mockResolvedValueOnce([{ name: 'email', title: 'Email' }]);
    // POST fails
    mockFormioFetch.mockRejectedValueOnce(new Error('Form.io API error: 400 Bad Request'));
    const { client } = await createTestClient(registerActionCreateTool);

    const result = await client.callTool({
      name: 'action_create',
      arguments: { cwd: TEST_CWD, formId, action: actionDef },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('400') }),
    ]);
  });
});
