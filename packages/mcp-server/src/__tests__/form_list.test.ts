import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', () => ({
  formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
}));

const { registerFormListTool } = await import('../tools/form_list.js');

const DEFAULT_SELECT = '_id,title,name,path,type,tags';

function forms(count: number) {
  return Array.from({ length: count }, (_, index) => ({ _id: `${index}`, title: `Form ${index}` }));
}

describe('form_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    mockFormioFetch.mockResolvedValue({ data: [], total: 0 });
  });

  it('is listed in available tools', async () => {
    const { client } = await createTestClient(registerFormListTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_list');
  });

  it('always sends limit 100 and skip 0 with the summary select when called with no arguments', async () => {
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD } });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      { limit: '100', skip: '0', select: DEFAULT_SELECT },
      TEST_CONFIG,
      { withMeta: true }
    );
  });

  it('returns the forms with total and hasMore, and no count', async () => {
    const page = forms(2);
    mockFormioFetch.mockResolvedValue({ data: page, total: 2 });
    const { client } = await createTestClient(registerFormListTool);

    const result = await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD } });

    expect(result.structuredContent).toEqual({ forms: page, total: 2, hasMore: false });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify({ forms: page, total: 2, hasMore: false }, null, 2),
      },
    ]);
  });

  it('pages through more forms than one page holds', async () => {
    const { client } = await createTestClient(registerFormListTool);

    mockFormioFetch.mockResolvedValueOnce({ data: forms(100), total: 150 });
    const first = await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD } });
    expect(first.structuredContent).toMatchObject({ total: 150, hasMore: true });
    expect((first.structuredContent as { forms: unknown[] }).forms).toHaveLength(100);

    mockFormioFetch.mockResolvedValueOnce({ data: forms(50), total: 150 });
    const second = await client.callTool({
      name: 'form_list',
      arguments: { cwd: TEST_CWD, skip: 100 },
    });
    expect(second.structuredContent).toMatchObject({ total: 150, hasMore: false });
    expect((second.structuredContent as { forms: unknown[] }).forms).toHaveLength(50);
    expect(mockFormioFetch).toHaveBeenLastCalledWith(
      'form',
      expect.objectContaining({ limit: '100', skip: '100' }),
      TEST_CONFIG,
      { withMeta: true }
    );
  });

  it('passes type parameter', async () => {
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD, type: 'resource' } });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      expect.objectContaining({ type: 'resource' }),
      TEST_CONFIG,
      { withMeta: true }
    );
  });

  it('forwards limit, skip, sort and select', async () => {
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({
      name: 'form_list',
      arguments: { cwd: TEST_CWD, limit: 10, skip: 20, sort: '-created', select: '_id,title' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'form',
      { limit: '10', skip: '20', sort: '-created', select: '_id,title' },
      TEST_CONFIG,
      { withMeta: true }
    );
  });

  it('filters by every given tag with tags__all', async () => {
    const { client } = await createTestClient(registerFormListTool);

    await client.callTool({
      name: 'form_list',
      arguments: { cwd: TEST_CWD, tags: ['crm', 'intake'] },
    });

    const params = mockFormioFetch.mock.calls[0][1] as Record<string, string | undefined>;
    expect(params.tags__all).toBe('crm,intake');
    expect(params.tags).toBeUndefined();
  });

  // Form.io splits tags__all on commas, so "a,b" would be read as two tags and match
  // forms carrying both, never the one tag the caller named.
  it('refuses a tag containing a comma with INVALID_ARGUMENT, without a request', async () => {
    const { client } = await createTestClient(registerFormListTool);

    const result = (await client.callTool({
      name: 'form_list',
      arguments: { cwd: TEST_CWD, tags: ['crm', 'sales,emea'] },
    })) as {
      isError?: boolean;
      content: Array<{ text?: string }>;
      _meta?: Record<string, { code?: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result._meta?.['io.form/error']?.code).toBe('INVALID_ARGUMENT');
    expect(result.content[0].text).toContain('"sales,emea"');
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it.each([{ limit: 0 }, { limit: -1 }, { limit: 1.5 }, { skip: -1 }, { skip: 0.5 }])(
    'refuses %o without a request',
    async (args) => {
      const { client } = await createTestClient(registerFormListTool);

      const result = await client.callTool({
        name: 'form_list',
        arguments: { cwd: TEST_CWD, ...args },
      });

      expect(result.isError).toBe(true);
      expect(mockFormioFetch).not.toHaveBeenCalled();
    }
  );

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 401 Unauthorized'));
    const { client } = await createTestClient(registerFormListTool);

    const result = await client.callTool({ name: 'form_list', arguments: { cwd: TEST_CWD } });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('401') }),
    ]);
  });
});
