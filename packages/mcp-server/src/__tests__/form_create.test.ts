import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', () => ({
  formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
}));

// Force the license gate to a no-op pass-through so the revisions consent
// prompt stays silent in tests.
vi.mock('../revisions/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../revisions/index.js')>()),
  gateRevisionsLicense: vi
    .fn()
    .mockImplementation(async (_s, _c, { form }: { form: Record<string, unknown> }) => ({
      licensed: true,
      form,
    })),
}));

const { registerFormCreateTool } = await import('../tools/form_create.js');

describe('form_create tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with skill-referencing description', async () => {
    mockFormioFetch.mockResolvedValue({});
    const { client } = await createTestClient(registerFormCreateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_create');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain('formio-form');
  });

  it('sends form definition via POST to /form', async () => {
    const created = {
      _id: '123',
      title: 'My Form',
      name: 'myForm',
      path: 'myform',
      components: [],
    };
    mockFormioFetch.mockResolvedValue(created);
    const { client } = await createTestClient(registerFormCreateTool);

    const form = { title: 'My Form', name: 'myForm', path: 'myform', components: [] };
    await client.callTool({ name: 'form_create', arguments: { cwd: TEST_CWD, form } });

    expect(mockFormioFetch).toHaveBeenCalledWith('form', {}, TEST_CONFIG, {
      method: 'POST',
      body: { revisions: 'original', ...form },
    });
  });

  it('passes optional fields in the form definition', async () => {
    mockFormioFetch.mockResolvedValue({ _id: '123' });
    const { client } = await createTestClient(registerFormCreateTool);

    const form = {
      title: 'Wizard Form',
      name: 'wizardForm',
      path: 'wizard',
      type: 'form',
      display: 'wizard',
      tags: ['test'],
      components: [],
    };
    await client.callTool({ name: 'form_create', arguments: { cwd: TEST_CWD, form } });

    expect(mockFormioFetch).toHaveBeenCalledWith('form', {}, TEST_CONFIG, {
      method: 'POST',
      body: { revisions: 'original', ...form },
    });
  });

  it('returns created form JSON as MCP text content', async () => {
    const created = {
      _id: '123',
      title: 'My Form',
      name: 'myForm',
      path: 'myform',
      components: [],
    };
    mockFormioFetch.mockResolvedValue(created);
    const { client } = await createTestClient(registerFormCreateTool);

    const form = { title: 'My Form', name: 'myForm', path: 'myform', components: [] };
    const result = await client.callTool({
      name: 'form_create',
      arguments: { cwd: TEST_CWD, form },
    });

    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(created, null, 2) }]);
  });

  it('returns isError true on API error', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 400'));
    const { client } = await createTestClient(registerFormCreateTool);

    const form = { title: 'Bad', name: 'bad', path: 'bad', components: [] };
    const result = await client.callTool({
      name: 'form_create',
      arguments: { cwd: TEST_CWD, form },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('400') }),
    ]);
  });

  it('caller-supplied revisions overrides the default', async () => {
    mockFormioFetch.mockResolvedValue({ _id: '123' });
    const { client } = await createTestClient(registerFormCreateTool);

    const form = {
      title: 'Pinned',
      name: 'pinned',
      path: 'pinned',
      components: [],
      revisions: 'current' as const,
    };
    await client.callTool({ name: 'form_create', arguments: { cwd: TEST_CWD, form } });

    expect(mockFormioFetch).toHaveBeenCalledWith('form', {}, TEST_CONFIG, {
      method: 'POST',
      body: form,
    });
  });

  it('stamps _vnote with @formio/mcp: prefix when note is provided', async () => {
    mockFormioFetch.mockResolvedValue({ _id: '123' });
    const { client } = await createTestClient(registerFormCreateTool);

    const form = { title: 'NF', name: 'nf', path: 'nf', components: [] };
    await client.callTool({
      name: 'form_create',
      arguments: { cwd: TEST_CWD, form, note: 'initial' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith('form', {}, TEST_CONFIG, {
      method: 'POST',
      body: { revisions: 'original', ...form, _vnote: '@formio/mcp: initial' },
    });
  });
});
