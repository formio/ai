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

const { registerFormUpdateTool } = await import('../tools/form_update.js');

describe('form_update tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with workflow guidance', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormUpdateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_update');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain('form_get');
    expect(tool!.description).toContain('formio-form');
  });

  it('sends PUT to /form/{formId} with form body', async () => {
    const formId = '67890abcdef012345678abcd';
    const updated = { _id: formId, title: 'Updated', components: [] };
    mockFormioFetch.mockResolvedValue(updated);
    const { client } = await createTestClient(registerFormUpdateTool);

    const form = { title: 'Updated', components: [] };
    await client.callTool({ name: 'form_update', arguments: { cwd: TEST_CWD, formId, form } });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: form,
    });
  });

  it('passes all form fields in the body', async () => {
    const formId = '67890abcdef012345678abcd';
    mockFormioFetch.mockResolvedValue({ _id: formId });
    const { client } = await createTestClient(registerFormUpdateTool);

    const form = {
      title: 'College App v2',
      name: 'collegeApp',
      path: 'college-app',
      display: 'wizard',
      tags: ['updated'],
      components: [{ type: 'textfield', key: 'name', label: 'Name', input: true }],
    };
    await client.callTool({ name: 'form_update', arguments: { cwd: TEST_CWD, formId, form } });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: form,
    });
  });

  it('returns updated form JSON as MCP text content', async () => {
    const formId = '67890abcdef012345678abcd';
    const updated = { _id: formId, title: 'Updated', components: [] };
    mockFormioFetch.mockResolvedValue(updated);
    const { client } = await createTestClient(registerFormUpdateTool);

    const result = await client.callTool({
      name: 'form_update',
      arguments: { cwd: TEST_CWD, formId, form: { title: 'Updated', components: [] } },
    });

    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(updated, null, 2) }]);
  });

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404'));
    const { client } = await createTestClient(registerFormUpdateTool);

    const result = await client.callTool({
      name: 'form_update',
      arguments: { cwd: TEST_CWD, formId: '67890abcdef012345678abcd', form: { components: [] } },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });
});
