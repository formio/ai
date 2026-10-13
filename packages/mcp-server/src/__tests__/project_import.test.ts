import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';
import { ERROR_META_KEY } from '../mcp-responses.js';
import { FormioNetworkError } from '../tool-errors.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerProjectImportTool } = await import('../tools/project_import.js');

describe('project_import tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is registered with a description referencing the formio-resource-planner skill', async () => {
    const { client } = await createTestClient(registerProjectImportTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'project_import');
    expect(tool).toBeDefined();
    expect(tool!.description).toMatch(/formio-resource-planner/);
  });

  // Import updates each form it names in place, deleting and recreating its actions,
  // and a template's access replaces the project's — not a merge that keeps them.
  it('states what the import replaces and that it is for a first build', async () => {
    const { client } = await createTestClient(registerProjectImportTool);
    const { tools } = await client.listTools();
    const description = tools.find((t) => t.name === 'project_import')!.description!;
    expect(description).not.toMatch(/merges, it does not replace/);
    expect(description).toMatch(/actions/);
    expect(description).toMatch(/access/);
    expect(description).toMatch(/first build/);
  });

  it('wraps the template in { template: ... } and calls POST /import', async () => {
    const template = {
      title: 'My App',
      name: 'myApp',
      version: '2.0.0',
      roles: {},
      resources: {},
      forms: {},
      actions: {},
    };
    mockFormioFetch.mockResolvedValue('Ok');
    const { client } = await createTestClient(registerProjectImportTool);

    await client.callTool({ name: 'project_import', arguments: { cwd: TEST_CWD, template } });

    // A large template legitimately takes minutes, so the import waits at least 300
    // seconds, however short FORMIO_REQUEST_TIMEOUT makes everyday calls.
    expect(mockFormioFetch).toHaveBeenCalledWith('import', {}, TEST_CONFIG, {
      method: 'POST',
      body: { template },
      responseType: 'text',
      timeoutMs: 300_000,
    });
  });

  it('returns "Ok" on successful import', async () => {
    mockFormioFetch.mockResolvedValue('Ok');
    const { client } = await createTestClient(registerProjectImportTool);

    const result = await client.callTool({
      name: 'project_import',
      arguments: {
        cwd: TEST_CWD,
        template: {
          title: 'App',
          name: 'app',
          version: '1.0.0',
          roles: {},
          resources: {},
          forms: {},
          actions: {},
        },
      },
    });

    expect(result.content).toEqual([{ type: 'text', text: 'Ok' }]);
  });

  it('returns error response on API failure', async () => {
    mockFormioFetch.mockRejectedValue(new Error('Form.io API error: 400'));
    const { client } = await createTestClient(registerProjectImportTool);

    const result = await client.callTool({
      name: 'project_import',
      arguments: {
        cwd: TEST_CWD,
        template: {
          title: 'Bad',
          name: 'bad',
          version: '1.0.0',
          roles: {},
          resources: {},
          forms: {},
          actions: {},
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('400') }),
    ]);
  });

  // Form.io's importer reads `template.forms` and `template.resources` unconditionally
  // and `roles` / `actions` when present, so a template it would answer with a 500 is
  // refused here, naming the key, before any request.
  describe('checks the template shape before sending it', () => {
    interface ToolResult {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
      _meta?: Record<string, { code?: string } | undefined>;
    }

    const CONTACT = { title: 'Contact', name: 'contact', path: 'contact', components: [] };

    async function importTemplate(template: Record<string, unknown>): Promise<ToolResult> {
      mockFormioFetch.mockResolvedValue('Ok');
      const { client } = await createTestClient(registerProjectImportTool);
      return (await client.callTool({
        name: 'project_import',
        arguments: { cwd: TEST_CWD, template },
      })) as ToolResult;
    }

    const text = (result: ToolResult) => result.content.map((part) => part.text ?? '').join('\n');

    function expectRefusal(result: ToolResult, key: string): void {
      expect(result.isError).toBe(true);
      expect(result._meta?.[ERROR_META_KEY]?.code).toBe('INVALID_ARGUMENT');
      expect(text(result)).toContain(`\`${key}\``);
      expect(text(result)).toMatch(/machine name/);
      expect(mockFormioFetch).not.toHaveBeenCalled();
    }

    it('refuses a template with no resources, naming the key', async () => {
      expectRefusal(await importTemplate({ forms: { contact: CONTACT } }), 'resources');
    });

    it('refuses a template with no forms, naming the key', async () => {
      expectRefusal(await importTemplate({ resources: {} }), 'forms');
    });

    it.each([
      ['forms', { forms: [CONTACT], resources: {} }],
      ['resources', { forms: {}, resources: [] }],
      ['forms', { forms: null, resources: {} }],
      ['resources', { forms: {}, resources: 'user' }],
      ['roles', { forms: {}, resources: {}, roles: [] }],
      ['actions', { forms: {}, resources: {}, actions: [] }],
      ['roles', { forms: {}, resources: {}, roles: null }],
    ])('refuses a template whose %s is not a plain object', async (key, template) => {
      expectRefusal(await importTemplate(template), key);
    });

    it('sends a template with empty objects, absent roles and actions, and extra keys', async () => {
      const template = {
        name: 'app',
        forms: { contact: CONTACT },
        resources: {},
        reports: [],
        revisions: {},
      };

      const result = await importTemplate(template);

      expect(result.isError).toBeFalsy();
      expect(mockFormioFetch).toHaveBeenCalledWith(
        'import',
        {},
        TEST_CONFIG,
        expect.objectContaining({ body: { template } })
      );
    });

    it('sends a template whose every section is an empty object', async () => {
      const result = await importTemplate({ roles: {}, resources: {}, forms: {}, actions: {} });

      expect(result.isError).toBeFalsy();
      expect(mockFormioFetch).toHaveBeenCalledOnce();
    });
  });

  // FORMIO_REQUEST_TIMEOUT can lengthen a template transfer, never shorten it.
  it.each([
    [5_000, 300_000],
    [600_000, 600_000],
  ])('with FORMIO_REQUEST_TIMEOUT at %i ms, waits %i ms', async (requestTimeoutMs, expected) => {
    mockFormioFetch.mockResolvedValue('Ok');
    const { client } = await createTestClient((server) =>
      registerProjectImportTool(server, { ...TEST_CONFIG, requestTimeoutMs })
    );

    await client.callTool({
      name: 'project_import',
      arguments: { cwd: TEST_CWD, template: { forms: {}, resources: {} } },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      'import',
      {},
      expect.anything(),
      expect.objectContaining({ timeoutMs: expected })
    );
  });

  // The server may still be working through a template the client stopped waiting for,
  // so a blind retry imports on top of it.
  it('says a timed-out import may still complete, and to check with project_export first', async () => {
    mockFormioFetch.mockRejectedValue(
      new FormioNetworkError({
        url: 'https://formio.invalid/sub/example/import',
        cause: new DOMException('The operation timed out.', 'TimeoutError'),
        timeoutMs: 300_000,
      })
    );
    const { client } = await createTestClient(registerProjectImportTool);

    const result = (await client.callTool({
      name: 'project_import',
      arguments: { cwd: TEST_CWD, template: { forms: {}, resources: {} } },
    })) as {
      isError?: boolean;
      content: Array<{ text?: string }>;
      _meta?: Record<string, unknown>;
    };

    const text = result.content.map((part) => part.text ?? '').join('\n');
    expect(result.isError).toBe(true);
    expect(result._meta?.[ERROR_META_KEY]).toEqual({ code: 'NETWORK_ERROR' });
    expect(text).toContain('timed out after 300 seconds');
    expect(text).toMatch(/may still complete/i);
    expect(text).toContain('project_export');
  });

  it('adds nothing to a network failure that was not a timeout', async () => {
    mockFormioFetch.mockRejectedValue(
      new FormioNetworkError({
        url: 'https://formio.invalid/sub/example/import',
        cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
      })
    );
    const { client } = await createTestClient(registerProjectImportTool);

    const result = (await client.callTool({
      name: 'project_import',
      arguments: { cwd: TEST_CWD, template: { forms: {}, resources: {} } },
    })) as { content: Array<{ text?: string }> };

    const text = result.content.map((part) => part.text ?? '').join('\n');
    expect(text).toContain('ECONNREFUSED');
    expect(text).not.toMatch(/may still complete/i);
  });
});
