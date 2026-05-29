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

const { registerFormGetTool } = await import('../tools/form_get.js');
const { isMongoId } = await import('../formio-client.js');

describe('form_get tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormGetTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_get');
  });

  it('fetches a form by MongoDB ID using /form/{id}', async () => {
    const id = '67890abcdef012345678abcd';
    const form = { _id: id, title: 'Test Form', components: [] };
    mockFormioFetch.mockResolvedValue(form);
    const { client } = await createTestClient(registerFormGetTool);

    await client.callTool({ name: 'form_get', arguments: { cwd: TEST_CWD, formIdOrPath: id } });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}`, {}, TEST_CONFIG);
  });

  it('fetches a form by multi-segment path alias using /{alias}', async () => {
    const form = { _id: '123', title: 'User Login', components: [] };
    mockFormioFetch.mockResolvedValue(form);
    const { client } = await createTestClient(registerFormGetTool);

    await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'user/login' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith('user/login', {}, TEST_CONFIG);
  });

  it('fetches a form by single-segment path alias using /{alias}', async () => {
    const form = { _id: '456', title: 'Example', components: [] };
    mockFormioFetch.mockResolvedValue(form);
    const { client } = await createTestClient(registerFormGetTool);

    await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'example' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith('example', {}, TEST_CONFIG);
  });

  it('passes select parameter when provided', async () => {
    const id = '67890abcdef012345678abcd';
    mockFormioFetch.mockResolvedValue({ _id: id, title: 'Test' });
    const { client } = await createTestClient(registerFormGetTool);

    await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id, select: '_id,title,components' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${id}`,
      { select: '_id,title,components' },
      TEST_CONFIG
    );
  });

  it('does not include select param when not provided', async () => {
    const id = '67890abcdef012345678abcd';
    mockFormioFetch.mockResolvedValue({ _id: id });
    const { client } = await createTestClient(registerFormGetTool);

    await client.callTool({ name: 'form_get', arguments: { cwd: TEST_CWD, formIdOrPath: id } });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}`, {}, TEST_CONFIG);
  });

  it('returns form JSON as MCP text content', async () => {
    const id = '67890abcdef012345678abcd';
    const form = { _id: id, title: 'Test Form', components: [] };
    mockFormioFetch.mockResolvedValue(form);
    const { client } = await createTestClient(registerFormGetTool);

    const result = await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id },
    });

    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(form, null, 2) }]);
  });

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerFormGetTool);

    const result = await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'nonexistent' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });

  it('with draft: true fetches /{base}/draft and returns the body when _vid === "draft"', async () => {
    const id = '67890abcdef012345678abcd';
    const draft = { _vid: 'draft', _id: id, components: [{ type: 'staged' }] };
    mockFormioFetch.mockResolvedValue(draft);
    const { client } = await createTestClient(registerFormGetTool);

    const result = await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id, draft: true },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}/draft`, {}, TEST_CONFIG);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(draft, null, 2) }]);
  });

  it('with draft: true throws "no draft exists" when _vid is not "draft"', async () => {
    const id = '67890abcdef012345678abcd';
    mockFormioFetch.mockResolvedValue({ _vid: 5, components: [] });
    const { client } = await createTestClient(registerFormGetTool);

    const result = await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id, draft: true },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ text: expect.stringMatching(/No draft exists/) }),
    ]);
  });
});

describe('isMongoId', () => {
  it('returns true for a 24-character hex string', () => {
    expect(isMongoId('67890abcdef012345678abcd')).toBe(true);
  });

  it('returns true for uppercase hex', () => {
    expect(isMongoId('67890ABCDEF012345678ABCD')).toBe(true);
  });

  it('returns false for a path alias', () => {
    expect(isMongoId('user/login')).toBe(false);
  });

  it('returns false for a single-segment alias', () => {
    expect(isMongoId('example')).toBe(false);
  });

  it('returns false for a short hex string', () => {
    expect(isMongoId('67890abc')).toBe(false);
  });

  it('returns false for a 24-character non-hex string', () => {
    expect(isMongoId('zzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
  });
});
