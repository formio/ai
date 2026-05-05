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

const { registerFormRevisionsSetTool } = await import('../tools/form_revisions_set.js');

const FORM_ID = '69f8f9ca71592601fd814e0f';

function baseForm(overrides: Record<string, unknown> = {}) {
  return {
    _id: FORM_ID,
    title: 'test5',
    name: 'test5',
    path: 'test5',
    type: 'form',
    components: [{ type: 'button', key: 'submit', label: 'Submit' }],
    revisions: '',
    submissionRevisions: '',
    _vid: 0,
    ...overrides,
  };
}

describe('form_revisions_set tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    mockFormioFetch.mockResolvedValue(baseForm());
    const { client } = await createTestClient(registerFormRevisionsSetTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_revisions_set');
  });

  it('tool description directs the agent to confirm with the user and covers all three modes', async () => {
    mockFormioFetch.mockResolvedValue(baseForm());
    const { client } = await createTestClient(registerFormRevisionsSetTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_revisions_set');
    expect(tool).toBeDefined();
    expect(tool!.description).toMatch(/ask the user|confirm/i);
    expect(tool!.description).toMatch(/current/i);
    expect(tool!.description).toMatch(/original/i);
    expect(tool!.description).toMatch(/disable|""/i);
  });

  it('with mode "current" on a non-revisioned form, GETs then PUTs revisions: "current" — exactly one PUT', async () => {
    const form = baseForm({ revisions: '' });
    const updated = baseForm({ revisions: 'current', _vid: 1 });
    mockFormioFetch.mockResolvedValueOnce(form).mockResolvedValueOnce(updated);
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: 'current' },
    });

    expect(mockFormioFetch).toHaveBeenNthCalledWith(1, `form/${FORM_ID}`, {}, TEST_CONFIG);
    expect(mockFormioFetch).toHaveBeenNthCalledWith(
      2,
      `form/${FORM_ID}`,
      {},
      TEST_CONFIG,
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({ revisions: 'current' }),
      })
    );
    const putCalls = mockFormioFetch.mock.calls.filter((c) => c[3]?.method === 'PUT');
    expect(putCalls).toHaveLength(1);
  });

  it('with mode "original", merges revisions: "original" into the body', async () => {
    const form = baseForm();
    mockFormioFetch.mockResolvedValueOnce(form).mockResolvedValueOnce(form);
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: 'original' },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall).toBeDefined();
    expect((putCall![3] as { body: { revisions: string } }).body.revisions).toBe('original');
  });

  it('with mode "" on a revisioned form, PUTs revisions: "" to disable', async () => {
    const form = baseForm({ revisions: 'original', _vid: 2 });
    const updated = baseForm({ revisions: '', _vid: 2 });
    mockFormioFetch.mockResolvedValueOnce(form).mockResolvedValueOnce(updated);
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: '' },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall).toBeDefined();
    expect((putCall![3] as { body: { revisions: string } }).body.revisions).toBe('');
    const putCalls = mockFormioFetch.mock.calls.filter((c) => c[3]?.method === 'PUT');
    expect(putCalls).toHaveLength(1);
  });

  it('rejects invocation without mode (Zod validation error)', async () => {
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    const result = await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toMatch(/mode/i);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('rejects invalid mode value', async () => {
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    const result = await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: 'bogus' },
    });

    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('short-circuits when revisions already enabled with same mode (no PUT)', async () => {
    const form = baseForm({ revisions: 'current', _vid: 1 });
    mockFormioFetch.mockResolvedValueOnce(form);
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: 'current' },
    });

    expect(mockFormioFetch).toHaveBeenCalledTimes(1);
    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${FORM_ID}`, {}, TEST_CONFIG);
  });

  it('short-circuits when already disabled and mode is "" (no PUT)', async () => {
    const form = baseForm({ revisions: '' });
    mockFormioFetch.mockResolvedValueOnce(form);
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: '' },
    });

    expect(mockFormioFetch).toHaveBeenCalledTimes(1);
    const putCalls = mockFormioFetch.mock.calls.filter((c) => c[3]?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
  });

  it('switches mode when current mode differs (issues PUT)', async () => {
    const form = baseForm({ revisions: 'current', _vid: 1 });
    const updated = baseForm({ revisions: 'original', _vid: 2 });
    mockFormioFetch.mockResolvedValueOnce(form).mockResolvedValueOnce(updated);
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: 'original' },
    });

    expect(mockFormioFetch).toHaveBeenCalledTimes(2);
    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect((putCall![3] as { body: { revisions: string } }).body.revisions).toBe('original');
  });

  it('initial GET 404 surfaces via toMcpError, no PUT issued', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    const result = await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: 'current' },
    });

    expect(result.isError).toBe(true);
    expect(mockFormioFetch).toHaveBeenCalledTimes(1);
    const putCalls = mockFormioFetch.mock.calls.filter((c) => c[3]?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
  });

  it('preserves upstream 402/403 license errors verbatim', async () => {
    const form = baseForm();
    mockFormioFetch
      .mockResolvedValueOnce(form)
      .mockRejectedValueOnce(new Error('Form.io API error: 402 Payment Required'));
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    const result = await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: 'current' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('402') }),
    ]);
  });

  it('asserts wire shape: revisions field is the single string carrier', async () => {
    const form = baseForm();
    mockFormioFetch.mockResolvedValueOnce(form).mockResolvedValueOnce(form);
    const { client } = await createTestClient(registerFormRevisionsSetTool);

    await client.callTool({
      name: 'form_revisions_set',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, mode: 'current' },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    const body = (putCall![3] as { body: Record<string, unknown> }).body;
    expect(body.revisions).toBe('current');
    expect(body.submissionRevisions).toBe('');
  });
});
