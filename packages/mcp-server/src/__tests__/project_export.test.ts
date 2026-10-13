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

const { registerProjectExportTool } = await import('../tools/project_export.js');

describe('project_export tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    const { client } = await createTestClient(registerProjectExportTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('project_export');
  });

  it('calls GET /export and returns the template JSON', async () => {
    const template = {
      title: 'My App',
      name: 'myApp',
      roles: {},
      forms: {},
      resources: {},
      actions: {},
    };
    mockFormioFetch.mockResolvedValue(template);
    const { client } = await createTestClient(registerProjectExportTool);

    const result = await client.callTool({ name: 'project_export', arguments: { cwd: TEST_CWD } });

    // Exporting a large project takes as long as importing it: at least 300 seconds,
    // however short FORMIO_REQUEST_TIMEOUT makes everyday calls.
    expect(mockFormioFetch).toHaveBeenCalledWith('export', {}, TEST_CONFIG, {
      timeoutMs: 300_000,
    });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(template, null, 2) }]);
  });

  it('returns error response on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 401'));
    const { client } = await createTestClient(registerProjectExportTool);

    const result = await client.callTool({ name: 'project_export', arguments: { cwd: TEST_CWD } });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('401') }),
    ]);
  });

  // FORMIO_REQUEST_TIMEOUT can lengthen a template transfer, never shorten it.
  it.each([
    [5_000, 300_000],
    [600_000, 600_000],
  ])('with FORMIO_REQUEST_TIMEOUT at %i ms, waits %i ms', async (requestTimeoutMs, expected) => {
    mockFormioFetch.mockResolvedValue({ forms: {}, resources: {} });
    const { client } = await createTestClient((server) =>
      registerProjectExportTool(server, { ...TEST_CONFIG, requestTimeoutMs })
    );

    await client.callTool({ name: 'project_export', arguments: { cwd: TEST_CWD } });

    expect(mockFormioFetch).toHaveBeenCalledWith('export', {}, expect.anything(), {
      timeoutMs: expected,
    });
  });

  describe('with tag', () => {
    const TAG_ID = '69d68310040fa2cea2572945';

    it('names tag in its description', async () => {
      const { client } = await createTestClient(registerProjectExportTool);
      const { tools } = await client.listTools();
      expect(tools.find((t) => t.name === 'project_export')?.description).toMatch(/`tag`/);
    });

    it('returns the template the named tag stored', async () => {
      const template = { forms: { order: {} }, resources: {}, roles: {}, actions: {} };
      mockFormioFetch.mockImplementation(async (path: string) => {
        if (path === 'tag') return { data: [{ _id: TAG_ID, tag: '1.2.0' }], total: 1 };
        if (path === `tag/${TAG_ID}`) return { _id: TAG_ID, tag: '1.2.0', template };
        throw new Error(`unexpected ${path}`);
      });
      const { client } = await createTestClient(registerProjectExportTool);

      const result = await client.callTool({
        name: 'project_export',
        arguments: { cwd: TEST_CWD, tag: '1.2.0' },
      });

      expect(mockFormioFetch).toHaveBeenCalledWith(
        'tag',
        expect.objectContaining({ tag: '1.2.0' }),
        TEST_CONFIG,
        { withMeta: true }
      );
      expect(mockFormioFetch).not.toHaveBeenCalledWith(
        'export',
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      expect(result.structuredContent).toEqual(template);
    });

    // Chunk documents carry the same tag name as the tag itself.
    it('skips the chunk documents that share the tag name', async () => {
      mockFormioFetch.mockImplementation(async (path: string) => {
        if (path === 'tag')
          return {
            data: [
              { _id: '69d68310040fa2cea2572946', tag: '1.2.0', chunk: true },
              { _id: TAG_ID, tag: '1.2.0' },
            ],
            total: 2,
          };
        if (path === `tag/${TAG_ID}`) return { _id: TAG_ID, tag: '1.2.0', template: { forms: {} } };
        throw new Error(`unexpected ${path}`);
      });
      const { client } = await createTestClient(registerProjectExportTool);

      const result = await client.callTool({
        name: 'project_export',
        arguments: { cwd: TEST_CWD, tag: '1.2.0' },
      });

      expect(result.isError).toBeFalsy();
    });

    it('reports an unknown tag as NOT_FOUND naming it', async () => {
      mockFormioFetch.mockResolvedValue({ data: [], total: 0 });
      const { client } = await createTestClient(registerProjectExportTool);

      const result = await client.callTool({
        name: 'project_export',
        arguments: { cwd: TEST_CWD, tag: '9.9.9' },
      });

      expect(result._meta?.['io.form/error']).toMatchObject({ code: 'NOT_FOUND' });
      expect(JSON.stringify(result.content)).toMatch(/9\.9\.9/);
    });
  });
});
