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

const { registerFormRevisionsListTool } = await import('../tools/form_revisions_list.js');

describe('form_revisions_list tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    mockFormioFetch.mockResolvedValue([]);
    const { client } = await createTestClient(registerFormRevisionsListTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_revisions_list');
  });

  it('fetches revisions by MongoDB id using GET /form/{id}/v', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    const revisions = [
      { _id: 'r1', _rid: id, revisionId: 'r1', _vid: 1, _vnote: '', _vuser: 'admin' },
      {
        _id: 'r2',
        _rid: id,
        revisionId: 'r2',
        _vid: 2,
        _vnote: 'publish-with-email',
        _vuser: 'admin',
      },
    ];
    mockFormioFetch.mockResolvedValue(revisions);
    const { client } = await createTestClient(registerFormRevisionsListTool);

    await client.callTool({
      name: 'form_revisions_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: id },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${id}/v`, {}, TEST_CONFIG);
  });

  it('resolves a path to an id then calls /v', async () => {
    const formId = '69f8f9ca71592601fd814e0f';
    const formByPath = { _id: formId, name: 'test5', path: 'test5' };
    const revisions = [
      { _id: 'r1', _rid: formId, revisionId: 'r1', _vid: 1, _vnote: '', _vuser: 'admin' },
    ];
    mockFormioFetch.mockResolvedValueOnce(formByPath).mockResolvedValueOnce(revisions);
    const { client } = await createTestClient(registerFormRevisionsListTool);

    await client.callTool({
      name: 'form_revisions_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'test5' },
    });

    expect(mockFormioFetch).toHaveBeenNthCalledWith(1, 'test5', {}, TEST_CONFIG);
    expect(mockFormioFetch).toHaveBeenNthCalledWith(2, `form/${formId}/v`, {}, TEST_CONFIG);
  });

  it('returns a compact summary array (vid, modified, user, note)', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    const revisions = [
      {
        _id: 'r1',
        _rid: id,
        revisionId: 'r1',
        _vid: 1,
        _vnote: '',
        _vuser: 'admin',
        modified: '2026-05-04T19:56:07.003Z',
        components: [{ type: 'button', key: 'submit' }],
        title: 'test5',
      },
    ];
    mockFormioFetch.mockResolvedValue(revisions);
    const { client } = await createTestClient(registerFormRevisionsListTool);

    const result = await client.callTool({
      name: 'form_revisions_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: id },
    });

    const summaries = [{ vid: 1, modified: '2026-05-04T19:56:07.003Z', user: 'admin', note: '' }];
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(summaries, null, 2) }]);
  });

  it('returns isError true on 404', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerFormRevisionsListTool);

    const result = await client.callTool({
      name: 'form_revisions_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: '69f8f9ca71592601fd814e0f' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });

  it('matches the captured Form.io revision wire shape', async () => {
    const id = '69f8f9ca71592601fd814e0f';
    const realisticRevisions = [
      {
        _id: '69f8f9d671592601fd814eb6',
        _rid: id,
        revisionId: '69f8f9d671592601fd814eb6',
        _vid: 1,
        _vnote: '',
        _vuser: 'admin',
        modified: '2026-05-04T19:56:07.003Z',
        title: 'test5',
        name: 'test5',
        path: 'test5',
        components: [{ type: 'button', key: 'submit', label: 'Submit' }],
      },
      {
        _id: '69f8fa3071592601fd815100',
        _rid: id,
        revisionId: '69f8fa3071592601fd815100',
        _vid: 2,
        _vnote: 'publish-with-email',
        _vuser: 'admin',
        modified: '2026-05-04T19:58:35.905Z',
        title: 'test5',
        name: 'test5',
        path: 'test5',
        components: [
          { type: 'email', key: 'email', label: 'Email' },
          { type: 'button', key: 'submit', label: 'Submit' },
        ],
      },
    ];
    mockFormioFetch.mockResolvedValue(realisticRevisions);
    const { client } = await createTestClient(registerFormRevisionsListTool);

    const result = await client.callTool({
      name: 'form_revisions_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: id },
    });

    const parsed = JSON.parse((result.content as { text: string }[])[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      vid: 1,
      modified: '2026-05-04T19:56:07.003Z',
      user: 'admin',
      note: '',
    });
    expect(parsed[1]).toEqual({
      vid: 2,
      modified: '2026-05-04T19:58:35.905Z',
      user: 'admin',
      note: 'publish-with-email',
    });
    for (const rev of parsed) {
      expect(rev).not.toHaveProperty('components');
      expect(rev).not.toHaveProperty('title');
      expect(rev).not.toHaveProperty('_id');
      expect(rev).not.toHaveProperty('_rid');
      expect(rev).not.toHaveProperty('revisionId');
    }
  });
});
