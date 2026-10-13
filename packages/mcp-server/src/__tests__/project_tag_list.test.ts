import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return { ...original, formioFetch: (...args: unknown[]) => mockFormioFetch(...args) };
});

const { registerProjectTagListTool } = await import('../tools/project_tag_list.js');

const TAG_ID = '69d68310040fa2cea2572945';

interface Routes {
  current?: string;
  tags?: Array<Record<string, unknown>>;
  exported?: Record<string, unknown>;
  tagged?: Record<string, unknown>;
}

function serve({ current = '0.0.0', tags = [], exported = {}, tagged = {} }: Routes) {
  mockFormioFetch.mockImplementation(async (path: string, query: Record<string, string>) => {
    if (path === 'tag/current') return { tag: current };
    if (path === 'tag' && query.tag) {
      const match = tags.filter((t) => t.tag === query.tag);
      return { data: match, total: match.length };
    }
    if (path === 'tag') return { data: tags, total: tags.length };
    if (path === 'export') return exported;
    if (path === `tag/${TAG_ID}`) return { _id: TAG_ID, tag: current, template: tagged };
    throw new Error(`unexpected ${path}`);
  });
}

const call = async (args: Record<string, unknown> = {}) => {
  const { client } = await createTestClient(registerProjectTagListTool);
  return client.callTool({ name: 'project_tag_list', arguments: { cwd: TEST_CWD, ...args } });
};

describe('project_tag_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is read-only', async () => {
    const { client } = await createTestClient(registerProjectTagListTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'project_tag_list');
    expect(tool?.annotations?.readOnlyHint).toBe(true);
  });

  it('reports the current version and every tag newest first, without templates', async () => {
    serve({
      current: '1.1.0',
      tags: [
        {
          _id: 'b',
          tag: '1.1.0',
          description: 'Vendors',
          created: '2026-10-02',
          template: { forms: {} },
        },
        { _id: 'c', tag: '1.1.0', chunk: true, template: { forms: { order: {} } } },
        { _id: 'a', tag: '1.0.0', description: 'First build', created: '2026-10-01' },
      ],
    });

    const result = await call();

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'tag',
      expect.objectContaining({ sort: '-created' }),
      TEST_CONFIG,
      { withMeta: true }
    );
    expect(result.structuredContent).toEqual({
      current: '1.1.0',
      tags: [
        { tag: '1.1.0', description: 'Vendors', created: '2026-10-02' },
        { tag: '1.0.0', description: 'First build', created: '2026-10-01' },
      ],
    });
  });

  it('reports no current version for an untagged project', async () => {
    serve({ current: '0.0.0', tags: [] });
    expect((await call()).structuredContent).toEqual({ tags: [] });
  });

  it('with compare, reports what changed since the current tag', async () => {
    serve({
      current: '1.0.0',
      tags: [{ _id: TAG_ID, tag: '1.0.0', description: 'First', created: '2026-10-01' }],
      exported: { forms: { order: { name: 'order' }, vendor: { name: 'vendor' } } },
      tagged: { forms: { order: { name: 'order' } } },
    });

    const result = await call({ compare: true });
    const comparison = (result.structuredContent as { comparison: Record<string, unknown> })
      .comparison;

    expect(comparison.against).toBe('1.0.0');
    expect(comparison.forms).toEqual({ added: ['vendor'], removed: [], changed: [] });
    expect(mockFormioFetch).toHaveBeenCalledWith(
      `tag/${TAG_ID}`,
      {},
      TEST_CONFIG,
      expect.objectContaining({ timeoutMs: 300_000 })
    );
  });

  it('with compare and no current version, says there is nothing to compare against', async () => {
    serve({ current: '0.0.0', tags: [] });
    const result = await call({ compare: true });
    const comparison = (result.structuredContent as { comparison: Record<string, unknown> })
      .comparison;
    expect(comparison.against).toBeUndefined();
    expect(comparison.message).toMatch(/no version to compare against/i);
    expect(mockFormioFetch).not.toHaveBeenCalledWith(
      'export',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('reports a Form.io failure with the shared error contract', async () => {
    mockFormioFetch.mockRejectedValue(new Error('boom'));
    const result = await call();
    expect(result.isError).toBe(true);
  });
});
