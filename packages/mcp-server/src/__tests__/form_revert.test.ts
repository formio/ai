import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestClient,
  freshProjectUrl,
  stubRevisionsLicence,
  TEST_CWD,
} from './test-helpers.js';
import { ERROR_META_KEY } from '../mcp-responses.js';
import { FormioApiError } from '../tool-errors.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...actual,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerFormRevertTool } = await import('../tools/form_revert.js');

const FORM_ID = '67890abcdef012345678abcd';

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, { code?: string } | undefined>;
}

type FetchOptions = { method?: string; body?: unknown } | undefined;

function puts() {
  return mockFormioFetch.mock.calls.filter(([, , , options]) => (options as FetchOptions)?.method);
}

async function revert(args: Record<string, unknown>, projectUrl?: string) {
  const { client } = await createTestClient(registerFormRevertTool, { projectUrl });
  return (await client.callTool({
    name: 'form_revert',
    arguments: { cwd: TEST_CWD, ...args },
  })) as ToolResult;
}

describe('form_revert tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    stubRevisionsLicence(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('takes the form, the revision, a note and the working directory, and no form body', async () => {
    const { client } = await createTestClient(registerFormRevertTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_revert');
    expect(tool).toBeDefined();
    expect(Object.keys(tool!.inputSchema.properties ?? {}).sort()).toEqual([
      'cwd',
      'formId',
      'note',
      'version',
    ]);
    expect(tool!.inputSchema.required).toEqual(
      expect.arrayContaining(['formId', 'version', 'note'])
    );
    expect(tool!.annotations?.readOnlyHint).toBe(false);
  });

  it("puts the live form overlaid with the revision's allowlisted fields and the note", async () => {
    const revision = {
      _vid: 3,
      components: [{ type: 'v3' }],
      tags: ['t'],
      display: 'wizard',
      properties: { a: 'b' },
      title: 'NOT RESTORED',
      settings: { NOT: 'RESTORED' },
    };
    const live = { _id: FORM_ID, title: 'Live', components: [{ type: 'current' }] };
    mockFormioFetch.mockImplementation(
      (path: string, _p: unknown, _c: unknown, options: FetchOptions) => {
        if (options?.method) return Promise.resolve({});
        if (path === `form/${FORM_ID}/v/3`) return Promise.resolve(revision);
        return Promise.resolve(live);
      }
    );

    const result = await revert({ formId: FORM_ID, version: '3', note: 'Reverted to version 3' });

    expect(result.isError).toBeFalsy();
    expect(puts()).toEqual([
      [
        `form/${FORM_ID}`,
        {},
        expect.anything(),
        {
          method: 'PUT',
          body: {
            ...live,
            components: revision.components,
            tags: revision.tags,
            display: revision.display,
            properties: revision.properties,
            _vnote: '@formio/mcp: Reverted to version 3',
          },
        },
      ],
    ]);
  });

  it('reports an unknown revision as NOT_FOUND and sends no PUT', async () => {
    mockFormioFetch.mockImplementation((path: string) =>
      path === `form/${FORM_ID}/v/99`
        ? Promise.reject(
            new FormioApiError({
              status: 404,
              url: `https://formio.invalid/sub/example/form/${FORM_ID}/v/99`,
              body: 'Resource not found',
            })
          )
        : Promise.resolve({ _id: FORM_ID })
    );

    const result = await revert({ formId: FORM_ID, version: '99', note: 'n' });

    expect(result.isError).toBe(true);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('NOT_FOUND');
    expect(puts()).toEqual([]);
  });

  it.each(['../3', '3/../../x', 'https://example.com/x', '3?x'])(
    'refuses version %j by the path-argument rule before any request',
    async (version) => {
      const result = await revert({ formId: FORM_ID, version, note: 'n' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/version/);
      expect(mockFormioFetch).not.toHaveBeenCalled();
    }
  );

  it('refuses with LICENSE_REQUIRED on a deployment without the revisions licence', async () => {
    stubRevisionsLicence(false);

    const result = await revert({ formId: FORM_ID, version: '3', note: 'n' }, freshProjectUrl());

    expect(result.isError).toBe(true);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('LICENSE_REQUIRED');
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });
});
