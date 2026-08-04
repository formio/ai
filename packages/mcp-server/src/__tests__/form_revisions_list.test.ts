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

const { registerFormRevisionsListTool } = await import('../tools/form_revisions_list.js');

describe('form_revisions_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('fetches /form/{id}/v for a Mongo id and returns the revisions', async () => {
    const id = '67890abcdef012345678abcd';
    const revisions = [{ _vid: 1, _vnote: 'first' }];
    mockFormioFetch.mockResolvedValue(revisions);
    const { client } = await createTestClient(registerFormRevisionsListTool);

    const result = await client.callTool({
      name: 'form_revisions_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: id },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}/v`, {}, TEST_CONFIG);
    expect(result.structuredContent).toEqual({ revisions, count: 1 });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ revisions, count: 1 }, null, 2) },
    ]);
  });

  it('fetches /{alias}/v for a path alias', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormRevisionsListTool);

    await client.callTool({
      name: 'form_revisions_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'user/login' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith('user/login/v', {}, TEST_CONFIG);
  });
});
