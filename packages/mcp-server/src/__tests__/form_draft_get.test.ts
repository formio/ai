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

const { registerFormDraftGetTool } = await import('../tools/form_draft_get.js');

describe('form_draft_get tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftGetTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_draft_get');
  });

  it('fetches the draft by Mongo form _id with a single GET', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    const draft = { _id: 'd1', _vid: 'draft', _rid: id, components: [] };
    mockFormioFetch.mockResolvedValue(draft);
    const { client } = await createTestClient(registerFormDraftGetTool);

    await client.callTool({
      name: 'form_draft_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id },
    });

    expect(mockFormioFetch).toHaveBeenCalledTimes(1);
    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}/draft`, {}, TEST_CONFIG);
  });

  it('resolves a path-style formIdOrPath to an _id first', async () => {
    const formId = '69f8f9ca71592601fd814e0f';
    mockFormioFetch
      .mockResolvedValueOnce({ _id: formId, name: 'test5' })
      .mockResolvedValueOnce({ _vid: 'draft' });
    const { client } = await createTestClient(registerFormDraftGetTool);

    await client.callTool({
      name: 'form_draft_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'test5' },
    });

    expect(mockFormioFetch).toHaveBeenNthCalledWith(1, 'test5', {}, TEST_CONFIG);
    expect(mockFormioFetch).toHaveBeenNthCalledWith(2, `form/${formId}/draft`, {}, TEST_CONFIG);
  });

  it('returns the draft JSON as MCP text content', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    const draft = { _id: 'd1', _vid: 'draft', components: [{ key: 'name' }] };
    mockFormioFetch.mockResolvedValue(draft);
    const { client } = await createTestClient(registerFormDraftGetTool);

    const result = await client.callTool({
      name: 'form_draft_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id },
    });

    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(draft, null, 2) }]);
  });

  it('returns isError true on upstream 404 (no draft saved)', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerFormDraftGetTool);

    const result = await client.callTool({
      name: 'form_draft_get',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: '69f8f9ca71592601fd814e0f',
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });

  it('description distinguishes the draft from numbered revisions', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftGetTool);

    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_draft_get');

    expect(tool).toBeDefined();
    expect(tool!.description).toMatch(/draft/i);
    expect(tool!.description).toMatch(/form_revision_get/);
  });
});
