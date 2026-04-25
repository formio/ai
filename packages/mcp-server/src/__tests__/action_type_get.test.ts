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

const { registerActionTypeGetTool } = await import('../tools/action_type_get.js');

describe('action_type_get tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with formId and actionName parameters, description instructs LLM to call before action_create', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerActionTypeGetTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'action_type_get');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.properties).toHaveProperty('formId');
    expect(tool!.inputSchema.properties).toHaveProperty('actionName');
    expect(tool!.inputSchema.required).toContain('formId');
    expect(tool!.inputSchema.required).toContain('actionName');
    expect(tool!.description).toMatch(/action_create/);
  });

  it('sends GET to /form/{formId}/actions/{actionName} and returns type info with settingsForm', async () => {
    const formId = '67890abcdef012345678abcd';
    const actionName = 'email';
    const typeInfo = {
      name: 'email',
      title: 'Email',
      settingsForm: { components: [{ type: 'textfield', key: 'from' }] },
    };
    mockFormioFetch.mockResolvedValue(typeInfo);
    const { client } = await createTestClient(registerActionTypeGetTool);

    const result = await client.callTool({
      name: 'action_type_get',
      arguments: { cwd: TEST_CWD, formId, actionName },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${formId}/actions/${actionName}`,
      {},
      TEST_CONFIG
    );
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(typeInfo, null, 2) }]);
  });

  it('returns available types error when action name not found', async () => {
    const formId = '67890abcdef012345678abcd';
    // First call (type fetch) fails
    mockFormioFetch.mockRejectedValueOnce(new Error('Form.io API error: 404'));
    // Second call (catalog fetch) succeeds
    mockFormioFetch.mockResolvedValueOnce([
      { name: 'email', title: 'Email' },
      { name: 'save', title: 'Save Submission' },
      { name: 'login', title: 'Login' },
    ]);
    const { client } = await createTestClient(registerActionTypeGetTool);

    const result = await client.callTool({
      name: 'action_type_get',
      arguments: { cwd: TEST_CWD, formId, actionName: 'oauth' },
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
  });

  it('returns original error when both type fetch and catalog fetch fail', async () => {
    const formId = '67890abcdef012345678abcd';
    // First call (type fetch) fails
    mockFormioFetch.mockRejectedValueOnce(new Error('Form.io API error: 500'));
    // Second call (catalog fetch) also fails
    mockFormioFetch.mockRejectedValueOnce(new Error('Form.io API error: 503'));
    const { client } = await createTestClient(registerActionTypeGetTool);

    const result = await client.callTool({
      name: 'action_type_get',
      arguments: { cwd: TEST_CWD, formId, actionName: 'oauth' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('500'),
      }),
    ]);
  });
});
