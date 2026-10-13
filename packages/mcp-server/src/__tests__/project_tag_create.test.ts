import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormioApiError } from '../tool-errors.js';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return { ...original, formioFetch: (...args: unknown[]) => mockFormioFetch(...args) };
});

const { registerProjectTagCreateTool } = await import('../tools/project_tag_create.js');

const call = async (args: Record<string, unknown>) => {
  const { client } = await createTestClient(registerProjectTagCreateTool);
  return client.callTool({ name: 'project_tag_create', arguments: { cwd: TEST_CWD, ...args } });
};

describe('project_tag_create tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is a write that adds rather than overwrites', async () => {
    const { client } = await createTestClient(registerProjectTagCreateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'project_tag_create');
    expect(tool?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });

  it('posts the tag and description and returns the tag without its template', async () => {
    mockFormioFetch.mockResolvedValue({
      _id: 'x',
      tag: '1.3.0',
      description: 'Vendors',
      created: '2026-10-13',
      template: { forms: { order: {} } },
    });

    const result = await call({ tag: '1.3.0', description: 'Vendors' });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'tag',
      {},
      TEST_CONFIG,
      expect.objectContaining({
        method: 'POST',
        body: { tag: '1.3.0', description: 'Vendors' },
        timeoutMs: 300_000,
      })
    );
    expect(result.structuredContent).toEqual({
      tag: '1.3.0',
      description: 'Vendors',
      created: '2026-10-13',
    });
  });

  it.each(['release-3', '1.3', 'v1.3.0', `1.0.0-${'x'.repeat(30)}`])(
    'refuses %s before any request',
    async (tag) => {
      const result = await call({ tag, description: 'd' });
      expect(result.isError).toBe(true);
      expect(result._meta?.['io.form/error']).toMatchObject({ code: 'INVALID_ARGUMENT' });
      expect(mockFormioFetch).not.toHaveBeenCalled();
    }
  );

  it('accepts a pre-release version', async () => {
    mockFormioFetch.mockResolvedValue({ tag: '2.0.0-rc.1', description: 'd', created: 'c' });
    const result = await call({ tag: '2.0.0-rc.1', description: 'd' });
    expect(result.isError).toBeFalsy();
  });

  it('refuses a description over 256 characters before any request', async () => {
    const result = await call({ tag: '1.0.0', description: 'd'.repeat(257) });
    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('reports a name already used as VALIDATION_FAILED naming the tag', async () => {
    mockFormioFetch.mockRejectedValue(
      new FormioApiError({
        status: 400,
        url: 'https://formio.invalid/sub/example/tag',
        body: JSON.stringify({
          name: 'ValidationError',
          errors: { tag: { message: 'The tag must be unique.' } },
        }),
      })
    );

    const result = await call({ tag: '1.0.0', description: 'd' });

    expect(result._meta?.['io.form/error']).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(JSON.stringify(result.content)).toMatch(/1\.0\.0/);
  });
});
