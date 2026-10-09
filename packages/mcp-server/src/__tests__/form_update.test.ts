import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestClient,
  freshProjectUrl,
  stubRevisionsLicence,
  TEST_CONFIG,
  TEST_CWD,
} from './test-helpers.js';
import { ERROR_META_KEY } from '../mcp-responses.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...actual,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerFormUpdateTool } = await import('../tools/form_update.js');

describe('form_update tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    stubRevisionsLicence(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is listed in available tools with workflow guidance', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormUpdateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_update');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain('form_get');
    expect(tool!.description).toContain('formio-schema');
    expect(tool!.description).not.toContain('formio-form');
  });

  it('sends PUT to /form/{formId} with form body and _vnote prefix', async () => {
    const formId = '67890abcdef012345678abcd';
    const updated = { _id: formId, title: 'Updated', components: [], revisions: 'original' };
    mockFormioFetch.mockResolvedValue(updated);
    const { client } = await createTestClient(registerFormUpdateTool);

    const form = { title: 'Updated', components: [] };
    await client.callTool({
      name: 'form_update',
      arguments: { cwd: TEST_CWD, formId, form, note: 'tidy fields' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: { ...form, _vnote: '@formio/mcp: tidy fields' },
    });
  });

  it('passes all form fields in the body', async () => {
    const formId = '67890abcdef012345678abcd';
    mockFormioFetch.mockResolvedValue({ _id: formId, revisions: 'original' });
    const { client } = await createTestClient(registerFormUpdateTool);

    const form = {
      title: 'College App v2',
      name: 'collegeApp',
      path: 'college-app',
      display: 'wizard',
      tags: ['updated'],
      components: [{ type: 'textfield', key: 'name', label: 'Name', input: true }],
    };
    await client.callTool({
      name: 'form_update',
      arguments: { cwd: TEST_CWD, formId, form, note: 'rev' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: { ...form, _vnote: '@formio/mcp: rev' },
    });
  });

  it('returns updated form JSON as MCP text content', async () => {
    const formId = '67890abcdef012345678abcd';
    const updated = { _id: formId, title: 'Updated', components: [], revisions: 'original' };
    mockFormioFetch.mockResolvedValue(updated);
    const { client } = await createTestClient(registerFormUpdateTool);

    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId,
        form: { title: 'Updated', components: [] },
        note: 'n',
      },
    });

    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(updated, null, 2) }]);
  });

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 404'));
    const { client } = await createTestClient(registerFormUpdateTool);

    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        form: { components: [] },
        note: 'n',
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });

  it('has no publish, revert or version argument: those are form_publish and form_revert', async () => {
    const { client } = await createTestClient(registerFormUpdateTool);
    const { tools } = await client.listTools();
    const properties = Object.keys(
      tools.find((t) => t.name === 'form_update')!.inputSchema.properties ?? {}
    );
    expect(properties).not.toContain('publish');
    expect(properties).not.toContain('revert');
    expect(properties).not.toContain('version');
    expect(properties).toEqual(expect.arrayContaining(['cwd', 'formId', 'form', 'note', 'draft']));
  });

  it('draft merges caller form over existing draft and stamps _vnote', async () => {
    const formId = '67890abcdef012345678abcd';
    const existingDraft = {
      _vid: 'draft',
      components: [{ type: 'old' }],
      display: 'form',
    };
    mockFormioFetch.mockResolvedValue(existingDraft);
    const { client } = await createTestClient(registerFormUpdateTool);

    await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId,
        form: { components: [{ type: 'textfield' }] },
        draft: true,
        note: 'staged edits',
      },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}/draft`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: {
        _vid: 'draft',
        display: 'form',
        components: [{ type: 'textfield' }],
        _vnote: '@formio/mcp: staged edits',
      },
    });
  });

  // An agent edits what form_get returned and saves it back as a draft: the
  // server-owned fields ride along, and the draft takes only what a draft holds.
  it("draft saves only the allowlisted fields of form_get's output", async () => {
    const formId = '67890abcdef012345678abcd';
    const existingDraft = { _vid: 'draft', components: [{ type: 'old' }] };
    mockFormioFetch.mockResolvedValue(existingDraft);
    const { client } = await createTestClient(registerFormUpdateTool);

    const fromFormGet = {
      _id: formId,
      title: 'Contact',
      name: 'contact',
      path: 'contact',
      created: '2026-01-01T00:00:00.000Z',
      modified: '2026-01-02T00:00:00.000Z',
      owner: 'abcdef012345678901234567',
      access: [{ type: 'read_all', roles: [] }],
      submissionAccess: [],
      revisions: 'original',
      components: [{ type: 'phoneNumber', key: 'phone' }],
      settings: { theme: 'dark' },
      tags: ['common'],
      display: 'form',
    };
    const result = await client.callTool({
      name: 'form_update',
      arguments: { cwd: TEST_CWD, formId, form: fromFormGet, draft: true, note: 'Add phone' },
    });

    expect(result.isError).toBeFalsy();
    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}/draft`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: {
        _vid: 'draft',
        components: fromFormGet.components,
        settings: fromFormGet.settings,
        tags: fromFormGet.tags,
        display: fromFormGet.display,
        _vnote: '@formio/mcp: Add phone',
      },
    });
  });

  it('draft without any field a draft holds writes nothing', async () => {
    const { client } = await createTestClient(registerFormUpdateTool);
    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        form: { title: 'Renamed' },
        draft: true,
        note: 'n',
      },
    });
    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('draft refuses with LICENSE_REQUIRED on a deployment without the revisions licence', async () => {
    stubRevisionsLicence(false);
    const { client } = await createTestClient(registerFormUpdateTool, {
      projectUrl: freshProjectUrl(),
    });
    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        form: { components: [] },
        draft: true,
        note: 'n',
      },
    });
    expect(result.isError).toBe(true);
    expect((result._meta as Record<string, { code?: string }>)[ERROR_META_KEY]?.code).toBe(
      'LICENSE_REQUIRED'
    );
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  // Unknown is treated as licensed for the history checks, never as unlicensed: the
  // body is not stripped and the save is not refused on the licence's account, but a
  // stored form with history off still needs the caller's decision.
  it('checks the stored form and sends the body as written when the licence is unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const formId = '67890abcdef012345678abcd';
    mockFormioFetch.mockResolvedValue({ _id: formId, name: 'demo', revisions: 'original' });
    const { client } = await createTestClient(registerFormUpdateTool, {
      projectUrl: freshProjectUrl(),
    });

    const form = { title: 'Updated', components: [], revisions: 'current' };
    const result = await client.callTool({
      name: 'form_update',
      arguments: { cwd: TEST_CWD, formId, form: { title: 'Updated', components: [] }, note: 'n' },
    });
    expect(result.isError ?? false).toBe(false);
    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${formId}`,
      { select: 'revisions,name' },
      expect.anything()
    );

    mockFormioFetch.mockClear();
    await client.callTool({
      name: 'form_update',
      arguments: { cwd: TEST_CWD, formId, form, note: 'n' },
    });
    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}`, {}, expect.anything(), {
      method: 'PUT',
      body: { ...form, _vnote: '@formio/mcp: n' },
    });
  });
});
