import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestClient,
  freshProjectUrl,
  stubRevisionsLicence,
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

const { registerFormPublishTool } = await import('../tools/form_publish.js');

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

async function publish(args: Record<string, unknown>, projectUrl?: string) {
  const { client } = await createTestClient(registerFormPublishTool, { projectUrl });
  return (await client.callTool({
    name: 'form_publish',
    arguments: { cwd: TEST_CWD, ...args },
  })) as ToolResult;
}

describe('form_publish tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    stubRevisionsLicence(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('takes the form, a note and the working directory, and no form body', async () => {
    const { client } = await createTestClient(registerFormPublishTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'form_publish');
    expect(tool).toBeDefined();
    expect(Object.keys(tool!.inputSchema.properties ?? {}).sort()).toEqual([
      'cwd',
      'formId',
      'note',
    ]);
    expect(tool!.inputSchema.required).toEqual(expect.arrayContaining(['formId', 'note']));
    expect(tool!.annotations?.readOnlyHint).toBe(false);
  });

  it("puts the live form overlaid with the draft's allowlisted fields and the note", async () => {
    const draft = {
      _vid: 'draft',
      components: [{ type: 'phoneNumber', key: 'phone' }],
      settings: { theme: 'dark' },
      title: 'NOT PUBLISHED',
      access: [{ type: 'NOT PUBLISHED' }],
    };
    const live = { _id: FORM_ID, title: 'Live', components: [], access: [{ type: 'read_all' }] };
    const published = { ...live, components: draft.components, settings: draft.settings };
    mockFormioFetch.mockImplementation(
      (path: string, _p: unknown, _c: unknown, options: FetchOptions) => {
        if (options?.method) return Promise.resolve({});
        if (path === `form/${FORM_ID}/draft`) return Promise.resolve(draft);
        return Promise.resolve(puts().length ? published : live);
      }
    );

    const result = await publish({ formId: FORM_ID, note: 'Add phone field' });

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
            components: draft.components,
            settings: draft.settings,
            _vnote: '@formio/mcp: Add phone field',
          },
        },
      ],
    ]);
    expect(result.structuredContent).toEqual(published);
  });

  it('refuses with NO_DRAFT and sends no PUT when the form has no draft', async () => {
    // GET /draft falls back to the live form when no draft exists.
    mockFormioFetch.mockResolvedValue({ _id: FORM_ID, _vid: 4, components: [] });

    const result = await publish({ formId: FORM_ID, note: 'n' });

    expect(result.isError).toBe(true);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('NO_DRAFT');
    expect(result.content[0].text).toMatch(/^\[NO_DRAFT\] /);
    expect(result.content[0].text).toMatch(/draft: true/);
    expect(puts()).toEqual([]);
  });

  it('refuses with LICENSE_REQUIRED on a deployment without the revisions licence', async () => {
    stubRevisionsLicence(false);

    const result = await publish({ formId: FORM_ID, note: 'n' }, freshProjectUrl());

    expect(result.isError).toBe(true);
    expect(result._meta?.[ERROR_META_KEY]?.code).toBe('LICENSE_REQUIRED');
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('refuses a formId that is not an ObjectId before any request', async () => {
    const result = await publish({ formId: 'user/login', note: 'n' });

    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });
});
