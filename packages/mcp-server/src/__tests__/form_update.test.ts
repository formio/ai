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

// Force the license gate to a no-op pass-through so it stays silent. Each
// test's mocked stored form sets revisions: 'original' so the real per-form
// tracking gate (preserved via spread) stays silent too.
vi.mock('../revisions/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../revisions/index.js')>()),
  gateRevisionsLicense: vi
    .fn()
    .mockImplementation(async (_s, _c, { form }: { form: Record<string, unknown> }) => ({
      licensed: true,
      form,
    })),
}));

const { registerFormUpdateTool } = await import('../tools/form_update.js');

describe('form_update tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
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

  it('throws when more than one of draft/publish/revert is passed', async () => {
    const { client } = await createTestClient(registerFormUpdateTool);
    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        form: { components: [] },
        note: 'n',
        draft: true,
        publish: true,
      },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ text: expect.stringMatching(/mutually exclusive/) }),
    ]);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('throws when revert is true without version', async () => {
    const { client } = await createTestClient(registerFormUpdateTool);
    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        form: { components: [] },
        note: 'n',
        revert: true,
      },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ text: expect.stringMatching(/requires `version`/) }),
    ]);
    expect(mockFormioFetch).not.toHaveBeenCalled();
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

  it('draft rejects bodies with non-allowlisted fields', async () => {
    const { client } = await createTestClient(registerFormUpdateTool);
    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        form: { components: [], title: 'X' },
        draft: true,
        note: 'n',
      },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ text: expect.stringMatching(/cannot be staged/) }),
    ]);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('publish throws when no draft exists', async () => {
    mockFormioFetch.mockResolvedValueOnce({ _vid: 5, components: [] });
    const { client } = await createTestClient(registerFormUpdateTool);
    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId: '67890abcdef012345678abcd',
        form: { components: [] },
        publish: true,
        note: 'n',
      },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ text: expect.stringMatching(/No draft exists/) }),
    ]);
  });

  it('publish ignores caller form, overlays draft allowlist on live, stamps _vnote', async () => {
    const formId = '67890abcdef012345678abcd';
    const draft = { _vid: 'draft', components: [{ type: 'staged' }], title: 'IGNORED' };
    const live = {
      _id: formId,
      title: 'Live',
      components: [{ type: 'old' }],
      access: [{ role: 'admin' }],
    };
    mockFormioFetch.mockImplementation(
      (path: string, _p: unknown, _c: unknown, opts?: { method?: string }) => {
        const isGet = !opts?.method;
        if (isGet && path === `form/${formId}/draft`) return Promise.resolve(draft);
        if (isGet && path === `form/${formId}`) return Promise.resolve(live);
        return Promise.resolve({});
      }
    );

    const { client } = await createTestClient(registerFormUpdateTool);
    await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId,
        // draft publish flow ignores mcp tool caller form
        form: { components: [{ type: 'IGNORED' }] },
        publish: true,
        note: 'ship it',
      },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: {
        ...live,
        components: [{ type: 'staged' }],
        _vnote: '@formio/mcp: ship it',
      },
    });
  });

  it('revert PUTs live overlaid with revision revert allowlist and stamps _vnote', async () => {
    const formId = '67890abcdef012345678abcd';
    const revision = {
      _vid: '3',
      components: [{ type: 'v3' }],
      tags: ['t'],
      display: 'wizard',
      title: 'IGNORED',
    };
    const live = { _id: formId, title: 'Live', components: [{ type: 'current' }] };
    mockFormioFetch.mockImplementation(
      (path: string, _p: unknown, _c: unknown, opts?: { method?: string }) => {
        const isGet = !opts?.method;
        if (isGet && path === `form/${formId}/v/3`) return Promise.resolve(revision);
        if (isGet && path === `form/${formId}`) return Promise.resolve(live);
        return Promise.resolve({});
      }
    );

    const { client } = await createTestClient(registerFormUpdateTool);
    await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId,
        // revert flow ignores mcp tool caller form
        form: { components: [{ type: 'IGNORED' }] },
        revert: true,
        version: '3',
        note: 'Reverted to version 3',
      },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${formId}`, {}, TEST_CONFIG, {
      method: 'PUT',
      body: {
        ...live,
        components: [{ type: 'v3' }],
        tags: ['t'],
        display: 'wizard',
        _vnote: '@formio/mcp: Reverted to version 3',
      },
    });
  });
});
