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

const { registerFormRevisionListTool } = await import('../tools/form_revision_list.js');

const COMPACT_SELECT = '_id,_vid,_vnote,_vuser,created,modified';

describe('form_revision_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    mockFormioFetch.mockResolvedValue({ data: [], total: 0 });
  });

  it('fetches /form/{id}/v newest first with compact metadata and returns the page', async () => {
    const id = '67890abcdef012345678abcd';
    const revisions = Array.from({ length: 15 }, (_, index) => ({ _vid: 15 - index }));
    mockFormioFetch.mockResolvedValue({ data: revisions, total: 15 });
    const { client } = await createTestClient(registerFormRevisionListTool);

    const result = await client.callTool({
      name: 'form_revision_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: id },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${id}/v`,
      { limit: '100', skip: '0', sort: '-_vid', select: COMPACT_SELECT },
      TEST_CONFIG,
      { withMeta: true }
    );
    expect(result.structuredContent).toEqual({ revisions, total: 15, hasMore: false });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify({ revisions, total: 15, hasMore: false }, null, 2),
      },
    ]);
  });

  it('fetches /{alias}/v for a path alias', async () => {
    const { client } = await createTestClient(registerFormRevisionListTool);

    await client.callTool({
      name: 'form_revision_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'user/login' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'user/login/v',
      expect.objectContaining({ limit: '100', skip: '0' }),
      TEST_CONFIG,
      { withMeta: true }
    );
  });

  it('uses the given sort and select instead of the defaults', async () => {
    const { client } = await createTestClient(registerFormRevisionListTool);

    await client.callTool({
      name: 'form_revision_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'contact', sort: '_vid', select: '_vid,title' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'contact/v',
      { limit: '100', skip: '0', sort: '_vid', select: '_vid,title' },
      TEST_CONFIG,
      { withMeta: true }
    );
  });

  it('reports hasMore when more revisions remain', async () => {
    mockFormioFetch.mockResolvedValue({ data: [{ _vid: 15 }, { _vid: 14 }], total: 15 });
    const { client } = await createTestClient(registerFormRevisionListTool);

    const result = await client.callTool({
      name: 'form_revision_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'contact', limit: 2 },
    });

    expect(result.structuredContent).toMatchObject({ total: 15, hasMore: true });
  });
});
