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

const { registerFormDraftCreateTool } = await import('../tools/form_draft_create.js');

const FORM_ID = '69f8f9ca71592601fd814e0f';

describe('form_draft_create tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftCreateTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_draft_create');
  });

  it('description warns about single active draft and overwrite', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftCreateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_draft_create');
    expect(tool!.description).toMatch(/one active draft/i);
    expect(tool!.description).toMatch(/overwrites/i);
  });

  it('description forbids fallback to form_update on failure', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftCreateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_draft_create');
    expect(tool!.description).toMatch(/do not.*form_update/i);
    expect(tool!.description).toMatch(/surface/i);
  });

  it('with explicit definition and no note, GETs current form, overlays draft fields, PUTs merged body to /draft', async () => {
    const current = {
      _id: FORM_ID,
      title: 'test5',
      revisions: 'original',
      access: [{ type: 'read_all', roles: ['r1'] }],
      submissionAccess: [{ type: 'create_own', roles: ['r1'] }],
      owner: 'owner1',
      project: 'p1',
      components: [{ type: 'textfield', key: 'old' }],
    };
    const definition = {
      components: [{ type: 'button', key: 'submit' }],
    };
    mockFormioFetch
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ _vid: 'draft' })
      .mockResolvedValueOnce({ _vid: 'draft' });
    const { client } = await createTestClient(registerFormDraftCreateTool);

    await client.callTool({
      name: 'form_draft_create',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, definition },
    });

    expect(mockFormioFetch).toHaveBeenNthCalledWith(1, `form/${FORM_ID}`, {}, TEST_CONFIG);
    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall![0]).toBe(`form/${FORM_ID}/draft`);
    expect(putCall![3].body).toEqual({
      _id: FORM_ID,
      title: 'test5',
      revisions: 'original',
      access: current.access,
      submissionAccess: current.submissionAccess,
      owner: 'owner1',
      project: 'p1',
      components: definition.components,
    });
    expect(putCall![3].body).not.toHaveProperty('_vnote');
  });

  it('with explicit definition, only overlays draft-specific fields (components, settings, tags, properties, display) — preserves form-level fields', async () => {
    const current = {
      _id: FORM_ID,
      title: 'keep',
      name: 'keep',
      path: 'keep',
      revisions: 'original',
      access: [{ type: 'read_all', roles: ['r1'] }],
      submissionAccess: [{ type: 'create_own', roles: ['r1'] }],
      owner: 'owner1',
      components: [{ key: 'old' }],
      settings: { keep: true },
      tags: ['old-tag'],
      properties: { foo: 'old' },
      display: 'wizard',
    };
    const definition = {
      title: 'NEW-TITLE-IGNORED',
      revisions: 'IGNORED',
      access: [],
      owner: 'IGNORED',
      components: [{ key: 'new' }],
      settings: { keep: false },
      tags: ['new-tag'],
      properties: { foo: 'new' },
      display: 'form',
    };
    mockFormioFetch
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ _vid: 'draft' })
      .mockResolvedValueOnce({ _vid: 'draft' });
    const { client } = await createTestClient(registerFormDraftCreateTool);

    await client.callTool({
      name: 'form_draft_create',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, definition },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall![3].body).toEqual({
      _id: FORM_ID,
      title: 'keep',
      name: 'keep',
      path: 'keep',
      revisions: 'original',
      access: current.access,
      submissionAccess: current.submissionAccess,
      owner: 'owner1',
      components: definition.components,
      settings: definition.settings,
      tags: definition.tags,
      properties: definition.properties,
      display: definition.display,
    });
  });

  it('with explicit definition and note, attaches _vnote at top level of merged body', async () => {
    const current = {
      _id: FORM_ID,
      revisions: 'original',
      owner: 'owner1',
      components: [{ key: 'old' }],
    };
    const definition = {
      components: [{ type: 'button', key: 'submit' }],
    };
    mockFormioFetch
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ _vid: 'draft' })
      .mockResolvedValueOnce({ _vid: 'draft' });
    const { client } = await createTestClient(registerFormDraftCreateTool);

    await client.callTool({
      name: 'form_draft_create',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, definition, note: 'wip' },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall![0]).toBe(`form/${FORM_ID}/draft`);
    expect(putCall![3].body).toEqual(
      expect.objectContaining({
        _vnote: 'wip',
        revisions: 'original',
        owner: 'owner1',
        components: definition.components,
      })
    );
  });

  it('without definition, GETs current form then PUTs that body to /draft', async () => {
    const currentForm = {
      _id: FORM_ID,
      title: 'test5',
      components: [{ type: 'button', key: 'submit' }],
      revisions: 'current',
      _vid: 1,
    };
    mockFormioFetch
      .mockResolvedValueOnce(currentForm)
      .mockResolvedValueOnce(currentForm)
      .mockResolvedValueOnce(currentForm);
    const { client } = await createTestClient(registerFormDraftCreateTool);

    await client.callTool({
      name: 'form_draft_create',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(mockFormioFetch).toHaveBeenNthCalledWith(1, `form/${FORM_ID}`, {}, TEST_CONFIG);
    expect(mockFormioFetch).toHaveBeenNthCalledWith(
      2,
      `form/${FORM_ID}/draft`,
      {},
      TEST_CONFIG,
      expect.objectContaining({ method: 'PUT', body: currentForm })
    );
    expect(mockFormioFetch).toHaveBeenNthCalledWith(3, `form/${FORM_ID}/draft`, {}, TEST_CONFIG);
  });

  it('returns the post-PUT GET result, not the stale PUT response', async () => {
    const currentForm = {
      _id: FORM_ID,
      components: [{ type: 'button', key: 'submit' }],
      revisions: 'original',
    };
    const stalePutResponse = { _vid: 'draft', _vnote: 'old-note' };
    const freshGetResponse = { _vid: 'draft', _vnote: 'new-note' };
    mockFormioFetch
      .mockResolvedValueOnce(currentForm)
      .mockResolvedValueOnce(stalePutResponse)
      .mockResolvedValueOnce(freshGetResponse);
    const { client } = await createTestClient(registerFormDraftCreateTool);

    const result = await client.callTool({
      name: 'form_draft_create',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, note: 'new-note' },
    });

    const text = (result.content as { text: string }[])[0].text;
    expect(text).toContain('new-note');
    expect(text).not.toContain('old-note');
  });

  it('returns isError true and guides caller when revisions not enabled (404)', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerFormDraftCreateTool);

    const result = await client.callTool({
      name: 'form_draft_create',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        definition: { components: [] },
      },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toContain('404');
  });
});
