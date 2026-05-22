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

const { registerFormRevisionGetTool } = await import('../tools/form_revision_get.js');

describe('form_revision_get tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('fetches /form/{id}/v/{version} and returns the body as MCP text', async () => {
    const id = '67890abcdef012345678abcd';
    const revision = { _vid: 3, components: [] };
    mockFormioFetch.mockResolvedValue(revision);
    const { client } = await createTestClient(registerFormRevisionGetTool);

    const result = await client.callTool({
      name: 'form_revision_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: id, version: '3' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}/v/3`, {}, TEST_CONFIG);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(revision, null, 2) }]);
  });
});
