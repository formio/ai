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

  // Form.io's deploy with a template sets the project's `tag` without storing a tag
  // document, and deleting a tag leaves `tag` as it was: `current` can name a version
  // the family has no template for. The listing still answers.
  it('with compare and a current version that has no stored tag, keeps the listing', async () => {
    serve({
      current: '1.4.0',
      tags: [{ _id: TAG_ID, tag: '1.0.0', description: 'First', created: '2026-10-01' }],
    });
    const result = await call({ compare: true });
    expect(result.isError).toBeFalsy();
    const content = result.structuredContent as {
      current: string;
      tags: unknown[];
      comparison: Record<string, unknown>;
    };
    expect(content.current).toBe('1.4.0');
    expect(content.tags).toHaveLength(1);
    expect(content.comparison.against).toBeUndefined();
    expect(content.comparison.message).toMatch(/1\.4\.0[^.]*no stored tag/i);
    expect(mockFormioFetch).not.toHaveBeenCalledWith(
      'export',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('fetches the current tag template by the id the listing returned, with no second lookup', async () => {
    serve({
      current: '1.0.0',
      tags: [{ _id: TAG_ID, tag: '1.0.0', description: 'First', created: '2026-10-01' }],
      exported: { forms: {} },
      tagged: { forms: {} },
    });
    await call({ compare: true });
    const lookups = mockFormioFetch.mock.calls.filter(
      ([path, query]) => path === 'tag' && (query as Record<string, string>).tag
    );
    expect(lookups).toEqual([]);
  });

  it('sends no select, which Form.io ignores beside its own projection', async () => {
    serve({ current: '0.0.0', tags: [] });
    await call();
    const [, query] = mockFormioFetch.mock.calls.find(([path]) => path === 'tag') ?? [];
    expect(query).not.toHaveProperty('select');
  });

  it('starts the listing and the current-version read together', async () => {
    const started: string[] = [];
    const release: Array<() => void> = [];
    mockFormioFetch.mockImplementation((path: string) => {
      started.push(path);
      return new Promise((resolve) => {
        release.push(() =>
          resolve(path === 'tag/current' ? { tag: '0.0.0' } : { data: [], total: 0 })
        );
      });
    });
    const pending = call();
    await vi.waitFor(() => expect(started).toEqual(expect.arrayContaining(['tag', 'tag/current'])));
    release.forEach((go) => go());
    expect((await pending).structuredContent).toEqual({ tags: [] });
  });

  it('reports a Form.io failure with the shared error contract', async () => {
    mockFormioFetch.mockRejectedValue(new Error('boom'));
    const result = await call();
    expect(result.isError).toBe(true);
  });
});
