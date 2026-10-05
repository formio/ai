import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD, TEST_PROJECT_URL } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerSubmissionCreateTool } = await import('../tools/submission_create.js');
const { FormioApiError } = await import('../formio-client.js');
const { getOrCreateKey } = await import('../submission-keys.js');
const { verifyRecord } = await import('../agent-scope.js');

const FORM_ID = '65f000000000000000000001';
const SUB_ID = '65f0000000000000000000b1';
const OWNER = '65f0000000000000000000aa';

const ACTIONS = [
  { title: 'Save Submission', name: 'save', method: ['create', 'update'] },
  { title: 'Notify support', name: 'email', method: ['create'] },
  { title: 'Audit delete', name: 'webhook', method: ['delete'] },
];

interface Call {
  path: string;
  params: Record<string, string>;
  options?: {
    method?: string;
    body?: { data?: unknown; metadata?: { agent?: Record<string, unknown> } };
  };
}

function calls(): Call[] {
  return mockFormioFetch.mock.calls.map(([path, params, , options]) => ({ path, params, options }));
}

/**
 * A fake Form.io that normalizes like the real one: the dry run adds a default, and the
 * real POST stores the body it was sent (or, with `drift`, a different value).
 */
function fakeServer({ drift = false } = {}) {
  mockFormioFetch.mockImplementation(
    async (path: string, params: Record<string, string>, _cfg, options) => {
      if (path === `form/${FORM_ID}/action`) return ACTIONS;
      if (path === `form/${FORM_ID}/submission` && options?.method === 'POST') {
        const data = { ...(options.body.data as object), status: 'open' };
        if (params.dryrun === '1') return { data, owner: OWNER, form: FORM_ID };
        return {
          _id: SUB_ID,
          form: FORM_ID,
          owner: OWNER,
          created: '2026-09-29T00:00:00.000Z',
          modified: '2026-09-29T00:00:00.000Z',
          data: drift ? { ...(options.body.data as object), stamp: 'later' } : options.body.data,
          metadata: options.body.metadata,
        };
      }
      throw new Error(`unexpected call ${path}`);
    }
  );
}

describe('submission_create', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is registered with creates annotations and a description naming the scope and the rules', async () => {
    const { client } = await createTestClient(registerSubmissionCreateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'submission_create');
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    });
    expect(tool?.description).toMatch(/created and signed/);
    expect(tool?.description).toContain('agent-submissions.md');
    expect(tool?.description).toContain('action_list');
    expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual(
      expect.arrayContaining(['cwd', 'formIdOrPath', 'data', 'purpose'])
    );
    expect(tool?.inputSchema.required).toEqual(
      expect.arrayContaining(['formIdOrPath', 'data', 'purpose'])
    );
  });

  it('refuses input carrying metadata without making a request', async () => {
    const { client } = await createTestClient(registerSubmissionCreateTool);
    const result = await client.callTool({
      name: 'submission_create',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        data: { name: 'x' },
        purpose: 'test',
        metadata: { agent: { source: 'agent' } },
      },
    });
    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('dry-runs, then writes the dry-run data with a tag that verifies against it', async () => {
    fakeServer();
    const { client } = await createTestClient(registerSubmissionCreateTool);

    const result = await client.callTool({
      name: 'submission_create',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        data: { name: 'Hardware' },
        purpose: 'reference-data',
      },
    });

    expect(result.isError).toBeFalsy();
    const posts = calls().filter((c) => c.options?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0].params).toEqual({ dryrun: '1' });
    expect(posts[0].options?.body).toEqual({ data: { name: 'Hardware' } });
    expect(posts[1].params).toEqual({});
    expect(posts[1].options?.body?.data).toEqual({ name: 'Hardware', status: 'open' });

    const stored = {
      _id: SUB_ID,
      form: FORM_ID,
      owner: OWNER,
      data: posts[1].options?.body?.data,
      metadata: posts[1].options?.body?.metadata,
    };
    const key = getOrCreateKey({ cwd: TEST_CWD });
    expect(
      verifyRecord(stored, { key, projectUrl: TEST_PROJECT_URL, formId: FORM_ID })
    ).not.toBeNull();
    expect(posts[1].options?.body?.metadata?.agent?.purpose).toBe('reference-data');
  });

  it('returns the projected record and the create actions the write triggered', async () => {
    fakeServer();
    const { client } = await createTestClient(registerSubmissionCreateTool);

    const result = await client.callTool({
      name: 'submission_create',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        data: { name: 'Hardware' },
        purpose: 'test',
      },
    });

    expect(result.structuredContent).toEqual({
      _id: SUB_ID,
      form: FORM_ID,
      created: '2026-09-29T00:00:00.000Z',
      modified: '2026-09-29T00:00:00.000Z',
      data: { name: 'Hardware', status: 'open' },
      purpose: 'test',
      triggeredActions: ['Save Submission', 'Notify support'],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('"sig"');
    expect(serialized).not.toContain('nonce');
    expect(serialized).not.toContain(OWNER);
  });

  it('reports a dry-run validation failure and sends no real write', async () => {
    mockFormioFetch.mockImplementation(async (path: string, params: Record<string, string>) => {
      if (path === `form/${FORM_ID}/action`) return ACTIONS;
      if (params.dryrun === '1') {
        throw new FormioApiError(
          400,
          new URL(`${TEST_PROJECT_URL}/form/${FORM_ID}/submission`),
          JSON.stringify({
            name: 'ValidationError',
            details: [{ message: 'Name is required', path: ['name'] }],
          })
        );
      }
      throw new Error('real write must not happen');
    });
    const { client } = await createTestClient(registerSubmissionCreateTool);

    const result = await client.callTool({
      name: 'submission_create',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, data: {}, purpose: 'test' },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('Name is required');
    expect(calls().filter((c) => c.options?.method === 'POST')).toHaveLength(1);
  });

  it('fails closed when the stored data differs from the dry run: names fields and _id, not values', async () => {
    fakeServer({ drift: true });
    const { client } = await createTestClient(registerSubmissionCreateTool);

    const result = await client.callTool({
      name: 'submission_create',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        data: { name: 'Hardware' },
        purpose: 'test',
      },
    });

    expect(result.isError).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).toContain('stamp');
    expect(serialized).toContain(SUB_ID);
    expect(serialized).not.toContain('later');
    expect(serialized).toMatch(/portal/);
  });

  it('resolves a form path to its id', async () => {
    fakeServer();
    const inner = mockFormioFetch.getMockImplementation()!;
    mockFormioFetch.mockImplementation(async (path: string, ...rest: unknown[]) =>
      path === 'category' ? { _id: FORM_ID } : inner(path, ...(rest as [never, never, never]))
    );
    const { client } = await createTestClient(registerSubmissionCreateTool);

    await client.callTool({
      name: 'submission_create',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'category', data: { name: 'x' }, purpose: 'test' },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith('category', { select: '_id' }, TEST_CONFIG);
  });
});
