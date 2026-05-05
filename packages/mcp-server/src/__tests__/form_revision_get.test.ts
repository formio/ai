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

const { registerFormRevisionGetTool } = await import('../tools/form_revision_get.js');

describe('form_revision_get tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormRevisionGetTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_revision_get');
  });

  it('fetches a revision by sequential numeric version', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    const revision = { _id: 'r2', _vid: 2, _vnote: 'note', _vuser: 'admin' };
    mockFormioFetch.mockResolvedValue(revision);
    const { client } = await createTestClient(registerFormRevisionGetTool);

    await client.callTool({
      name: 'form_revision_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id, version: 2 },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}/v/2`, {}, TEST_CONFIG);
  });

  it('fetches a revision by string numeric version', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormRevisionGetTool);

    await client.callTool({
      name: 'form_revision_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id, version: '3' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}/v/3`, {}, TEST_CONFIG);
  });

  it('fetches a revision by Mongo revision _id', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    const revisionId = '69f8f9d671592601fd814eb6';
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormRevisionGetTool);

    await client.callTool({
      name: 'form_revision_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id, version: revisionId },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}/v/${revisionId}`, {}, TEST_CONFIG);
  });

  it('resolves a path-style formIdOrPath to an _id first', async () => {
    const formId = '69f8f9ca71592601fd814e0f';
    mockFormioFetch
      .mockResolvedValueOnce({ _id: formId, name: 'test5' })
      .mockResolvedValueOnce({ _vid: 1 });
    const { client } = await createTestClient(registerFormRevisionGetTool);

    await client.callTool({
      name: 'form_revision_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'test5', version: 1 },
    });

    expect(mockFormioFetch).toHaveBeenNthCalledWith(1, 'test5', {}, TEST_CONFIG);
    expect(mockFormioFetch).toHaveBeenNthCalledWith(2, `form/${formId}/v/1`, {}, TEST_CONFIG);
  });

  it('returns the revision JSON as MCP text content', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    const revision = { _id: 'r1', _vid: 1, components: [] };
    mockFormioFetch.mockResolvedValue(revision);
    const { client } = await createTestClient(registerFormRevisionGetTool);

    const result = await client.callTool({
      name: 'form_revision_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id, version: 1 },
    });

    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(revision, null, 2) }]);
  });

  it('returns isError true with form + version on 404', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerFormRevisionGetTool);

    const result = await client.callTool({
      name: 'form_revision_get',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: '69f8f9ca71592601fd814e0f',
        version: 99,
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });
});
