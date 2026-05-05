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

const { registerFormDraftPublishTool } = await import('../tools/form_draft_publish.js');

const FORM_ID = '69f8f9ca71592601fd814e0f';

describe('form_draft_publish tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftPublishTool);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('form_draft_publish');
  });

  it('description states note rides as _vnote, server auto-clears draft, no-op against unchanged body', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftPublishTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_draft_publish');
    expect(tool!.description).toMatch(/_vnote/);
    expect(tool!.description).toMatch(/auto.?clear/i);
    expect(tool!.description).toMatch(/no-op/i);
  });

  it('description marks itself the canonical "add a new revision" path', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftPublishTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_draft_publish');
    expect(tool!.description).toMatch(/add (a |the )?(new )?revision/i);
  });

  it('description forbids fallback to form_update on failure', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftPublishTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_draft_publish');
    expect(tool!.description).toMatch(/do not.*form_update/i);
    expect(tool!.description).toMatch(/surface/i);
  });

  it("description forbids auto-inferring `note` from the draft's `_vnote`", async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormDraftPublishTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_draft_publish');
    expect(tool!.description).toMatch(
      /do not infer|do NOT infer|do not auto-?forward|do NOT auto-?forward/
    );
    expect(tool!.description).toMatch(/independent/i);
    const noteParam = (tool!.inputSchema as { properties?: { note?: { description?: string } } })
      .properties?.note;
    expect(noteParam?.description).toMatch(/do not auto-?populate|do NOT auto-?populate/i);
    expect(noteParam?.description).toMatch(/explicitly stated|explicit/i);
  });

  it('with no definition and no note, fetches draft + current form then PUTs merged body', async () => {
    const current = {
      _id: FORM_ID,
      title: 'test5',
      revisions: 'original',
      access: [{ type: 'read_all', roles: ['r1'] }],
      submissionAccess: [{ type: 'create_own', roles: ['r1'] }],
      owner: 'owner1',
      components: [{ type: 'textfield', key: 'old' }],
    };
    const draft = {
      _id: FORM_ID,
      title: 'test5',
      components: [{ type: 'email', key: 'email' }],
    };
    const published = { ...current, ...draft, _vid: 2 };
    mockFormioFetch
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(published);
    const { client } = await createTestClient(registerFormDraftPublishTool);

    await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(mockFormioFetch).toHaveBeenNthCalledWith(1, `form/${FORM_ID}/draft`, {}, TEST_CONFIG);
    expect(mockFormioFetch).toHaveBeenNthCalledWith(2, `form/${FORM_ID}`, {}, TEST_CONFIG);
    expect(mockFormioFetch).toHaveBeenNthCalledWith(
      3,
      `form/${FORM_ID}`,
      {},
      TEST_CONFIG,
      expect.objectContaining({ method: 'PUT', body: { ...current, ...draft } })
    );
  });

  it('publish preserves form-level fields (revisions, access, submissionAccess, owner) when draft body lacks them', async () => {
    const current = {
      _id: FORM_ID,
      title: 'test5',
      revisions: 'original',
      access: [{ type: 'read_all', roles: ['r1'] }],
      submissionAccess: [{ type: 'create_own', roles: ['r1'] }],
      owner: 'owner1',
      components: [{ type: 'textfield', key: 'old' }],
    };
    const draft = {
      _id: FORM_ID,
      components: [{ type: 'email', key: 'email' }],
    };
    mockFormioFetch
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ ...current, ...draft, _vid: 2 });
    const { client } = await createTestClient(registerFormDraftPublishTool);

    await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall![3].body).toEqual(
      expect.objectContaining({
        revisions: 'original',
        access: current.access,
        submissionAccess: current.submissionAccess,
        owner: 'owner1',
        components: draft.components,
      })
    );
  });

  it('selective overlay: draft fields outside the whitelist (access, owner, revisions, _id) do NOT override current form', async () => {
    const current = {
      _id: FORM_ID,
      title: 'keep',
      name: 'keep',
      path: 'keep',
      revisions: 'original',
      access: [{ type: 'read_all', roles: ['real-role'] }],
      submissionAccess: [{ type: 'create_own', roles: ['real-role'] }],
      owner: 'real-owner',
      project: 'real-project',
      components: [{ key: 'old' }],
      settings: { keep: true },
      tags: ['old-tag'],
      properties: { foo: 'old' },
      display: 'wizard',
    };
    const draft = {
      _id: 'STALE-ID',
      title: 'STALE-TITLE',
      revisions: 'STALE',
      access: [],
      submissionAccess: [],
      owner: 'STALE-OWNER',
      project: 'STALE-PROJECT',
      components: [{ key: 'new' }],
      settings: { keep: false },
      tags: ['new-tag'],
      properties: { foo: 'new' },
      display: 'form',
    };
    mockFormioFetch
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({});
    const { client } = await createTestClient(registerFormDraftPublishTool);

    await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
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
      owner: 'real-owner',
      project: 'real-project',
      components: draft.components,
      settings: draft.settings,
      tags: draft.tags,
      properties: draft.properties,
      display: draft.display,
    });
  });

  it("strips draft's _vnote from publish body when caller does not supply note (matches portal behavior)", async () => {
    const current = {
      _id: FORM_ID,
      revisions: 'original',
      owner: 'o1',
      components: [{ key: 'old' }],
    };
    const draft = {
      _id: FORM_ID,
      _vnote: 'wip-draft-note',
      components: [{ key: 'new' }],
    };
    mockFormioFetch
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({});
    const { client } = await createTestClient(registerFormDraftPublishTool);

    await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall![3].body).not.toHaveProperty('_vnote');
  });

  it("strips draft's _vnote and replaces with caller-supplied note (no concat, no leak)", async () => {
    const current = { _id: FORM_ID, revisions: 'original', owner: 'o1', components: [] };
    const draft = { _id: FORM_ID, _vnote: 'old-draft-note', components: [{ key: 'new' }] };
    mockFormioFetch
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({});
    const { client } = await createTestClient(registerFormDraftPublishTool);

    await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, note: 'fresh-publish-note' },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall![3].body._vnote).toBe('fresh-publish-note');
  });

  it('strips _vnote from supplied definition when caller does not supply note', async () => {
    const definition = {
      _id: FORM_ID,
      revisions: 'original',
      _vnote: 'leaked-from-definition',
      components: [{ key: 'submit' }],
    };
    mockFormioFetch.mockResolvedValueOnce({});
    const { client } = await createTestClient(registerFormDraftPublishTool);

    await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, definition },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall![3].body).not.toHaveProperty('_vnote');
  });

  it('with note and no definition, attaches _vnote to merged publish body', async () => {
    const current = { _id: FORM_ID, revisions: 'original', owner: 'o1', components: [] };
    const draft = { _id: FORM_ID, components: [] };
    mockFormioFetch
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ ...current, ...draft, _vid: 2 });
    const { client } = await createTestClient(registerFormDraftPublishTool);

    await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, note: 'Added email field' },
    });

    const putCall = mockFormioFetch.mock.calls.find((c) => c[3]?.method === 'PUT');
    expect(putCall![3].body).toEqual(expect.objectContaining({ _vnote: 'Added email field' }));
  });

  it('with explicit definition, skips draft GET and PUTs supplied body', async () => {
    const definition = {
      _id: FORM_ID,
      title: 'test5',
      components: [{ type: 'email', key: 'email' }],
    };
    mockFormioFetch.mockResolvedValueOnce({ ...definition, _vid: 2 });
    const { client } = await createTestClient(registerFormDraftPublishTool);

    await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, definition, note: 'with-def' },
    });

    expect(mockFormioFetch).toHaveBeenCalledTimes(1);
    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${FORM_ID}`,
      {},
      TEST_CONFIG,
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({ ...definition, _vnote: 'with-def' }),
      })
    );
  });

  it('missing draft (404 on draft GET) surfaces toMcpError indicating no draft', async () => {
    mockFormioFetch.mockRejectedValueOnce(new Error('Form.io API error: 404 Not Found'));
    const { client } = await createTestClient(registerFormDraftPublishTool);

    const result = await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toContain('404');
  });

  it('preserves 409 publish conflict via toMcpError', async () => {
    const draft = { _id: FORM_ID, components: [] };
    const current = { _id: FORM_ID, revisions: 'original', components: [] };
    mockFormioFetch
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(current)
      .mockRejectedValueOnce(new Error('Form.io API error: 409 Conflict'));
    const { client } = await createTestClient(registerFormDraftPublishTool);

    const result = await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('409') }),
    ]);
  });

  it('publish with no diff vs current published returns success (not error) — server no-op behavior', async () => {
    const draft = { _id: FORM_ID, _vid: 1, components: [{ key: 'submit' }] };
    const current = { _id: FORM_ID, _vid: 1, components: [{ key: 'submit' }] };
    const noOpResponse = { _id: FORM_ID, _vid: 1, components: [{ key: 'submit' }] };
    mockFormioFetch
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(noOpResponse);
    const { client } = await createTestClient(registerFormDraftPublishTool);

    const result = await client.callTool({
      name: 'form_draft_publish',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as { text: string }[])[0].text);
    expect(parsed._vid).toBe(1);
  });
});
