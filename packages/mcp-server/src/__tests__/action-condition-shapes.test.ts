// The action tools accept, and send unchanged, every condition shape Form.io
// stores. The portal saves a condition as `{conjunction: '', conditions: [],
// custom: ''}` (apps/formio/src/actions/actions.js), so an action read with
// action_get must survive action_update untouched — a dropped `custom` makes the
// action run on every submission.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerActionCreateTool } = await import('../tools/action_create.js');
const { registerActionUpdateTool } = await import('../tools/action_update.js');

const formId = '67890abcdef012345678abcd';
const actionId = 'aaa111bbb222ccc333ddd444';
const base = { name: 'email', title: 'Email', handler: ['after'], method: ['create'] };

const shapes: Array<[string, Record<string, unknown>]> = [
  [
    'a portal-shaped condition',
    {
      ...base,
      condition: { conjunction: '', conditions: [], custom: 'show = data.amount > 100;' },
    },
  ],
  [
    'a custom condition with all',
    { ...base, condition: { conjunction: 'all', conditions: [], custom: 'show = true;' } },
  ],
  [
    'a legacy field/eq condition',
    { ...base, condition: { field: 'status', eq: 'equals', value: 'open' } },
  ],
  ['a null condition', { ...base, condition: null }],
  ['null settings', { ...base, settings: null }],
  [
    'an empty portal row',
    { ...base, condition: { conjunction: '', conditions: [{}], custom: '' } },
  ],
];

describe('action condition shapes', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it.each(shapes)('action_create posts %s unchanged', async (_label, action) => {
    mockFormioFetch.mockResolvedValueOnce([{ name: 'email' }]);
    mockFormioFetch.mockResolvedValueOnce({ _id: actionId, ...action });
    const { client } = await createTestClient(registerActionCreateTool);

    const result = await client.callTool({
      name: 'action_create',
      arguments: { cwd: TEST_CWD, formId, action },
    });

    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect(mockFormioFetch).toHaveBeenLastCalledWith(
      `form/${formId}/action`,
      {},
      expect.anything(),
      { method: 'POST', body: action }
    );
  });

  it.each(shapes)('action_update puts %s unchanged', async (_label, action) => {
    mockFormioFetch.mockResolvedValueOnce({ _id: actionId, ...action });
    const { client } = await createTestClient(registerActionUpdateTool);

    const result = await client.callTool({
      name: 'action_update',
      arguments: { cwd: TEST_CWD, formId, actionId, action },
    });

    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect(mockFormioFetch).toHaveBeenLastCalledWith(
      `form/${formId}/action/${actionId}`,
      {},
      expect.anything(),
      { method: 'PUT', body: action }
    );
  });

  it('still refuses an operator the server does not have', async () => {
    const { client } = await createTestClient(registerActionUpdateTool);
    const result = await client.callTool({
      name: 'action_update',
      arguments: {
        cwd: TEST_CWD,
        formId,
        actionId,
        action: {
          ...base,
          condition: {
            conjunction: 'all',
            conditions: [{ component: 'status', operator: 'looksLike', value: 'open' }],
          },
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });
});
