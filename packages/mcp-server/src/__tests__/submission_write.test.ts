import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CWD, TEST_PROJECT_URL } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerSubmissionUpdateTool } = await import('../tools/submission_update.js');
const { registerSubmissionDeleteTool } = await import('../tools/submission_delete.js');
const { getOrCreateKey } = await import('../submission-keys.js');
const { signTag, verifyRecord } = await import('../agent-scope.js');

const FORM_ID = '65f000000000000000000001';
const SUB_ID = '65f0000000000000000000b1';
const OWNER = '65f0000000000000000000aa';
const SUB_PATH = `form/${FORM_ID}/submission/${SUB_ID}`;

const ACTIONS = [
  { title: 'Notify on change', method: ['update'] },
  { title: 'Audit delete', method: ['delete'] },
  { title: 'Welcome email', method: ['create'] },
];

function signedRecord(data: Record<string, unknown>) {
  const key = getOrCreateKey({ cwd: TEST_CWD });
  const tag = signTag({
    key,
    projectUrl: TEST_PROJECT_URL,
    formId: FORM_ID,
    owner: OWNER,
    purpose: 'test',
    data,
  });
  return {
    _id: SUB_ID,
    form: FORM_ID,
    owner: OWNER,
    created: '2026-09-29T00:00:00.000Z',
    modified: '2026-09-29T00:00:00.000Z',
    data,
    metadata: { jwtIssuedAfter: 1, agent: tag },
  };
}

function humanRecord() {
  return {
    _id: SUB_ID,
    form: FORM_ID,
    owner: '65f0000000000000000000ff',
    data: { name: 'a person' },
    metadata: {},
  };
}

type Options = { method?: string; body?: { data?: unknown; metadata?: Record<string, unknown> } };

function fakeServer(existing: Record<string, unknown>) {
  mockFormioFetch.mockImplementation(
    async (path: string, params: Record<string, string>, _cfg: unknown, options?: Options) => {
      if (path === `form/${FORM_ID}/action`) return ACTIONS;
      if (path === SUB_PATH && !options?.method) return existing;
      if (path === SUB_PATH && options?.method === 'PUT') {
        const data = { ...(options.body?.data as object), status: 'open' };
        if (params.dryrun === '1') return { data, owner: OWNER, form: FORM_ID };
        return {
          ...existing,
          data: options.body?.data,
          metadata: options.body?.metadata,
          modified: 'later',
        };
      }
      if (path === SUB_PATH && options?.method === 'DELETE') return 'OK';
      throw new Error(`unexpected call ${options?.method ?? 'GET'} ${path}`);
    }
  );
}

function methods(): string[] {
  return mockFormioFetch.mock.calls
    .filter(([path]) => path === SUB_PATH)
    .map(
      ([, params, , options]) =>
        `${(options as Options | undefined)?.method ?? 'GET'}${(params as Record<string, string>).dryrun ? '?dryrun' : ''}`
    );
}

describe('submission_update', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('carries the overwrites annotations and refuses metadata in its input', async () => {
    const { client } = await createTestClient(registerSubmissionUpdateTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'submission_update');
    expect(tool?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tool?.description).toMatch(/created and signed/);

    const result = await client.callTool({
      name: 'submission_update',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        submissionId: SUB_ID,
        data: {},
        metadata: {},
      },
    });
    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('sends no PUT for a submission this directory did not sign', async () => {
    fakeServer(humanRecord());
    const { client } = await createTestClient(registerSubmissionUpdateTool);

    const result = await client.callTool({
      name: 'submission_update',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        submissionId: SUB_ID,
        data: { name: 'x' },
      },
    });

    expect(result.isError).toBe(true);
    expect(methods()).toEqual(['GET']);
    expect(JSON.stringify(result)).not.toContain('a person');
  });

  it('verifies, dry-runs, then PUTs a tag that keeps its identity and verifies against the new data', async () => {
    const existing = signedRecord({ name: 'Hardware' });
    fakeServer(existing);
    const { client } = await createTestClient(registerSubmissionUpdateTool);

    const result = await client.callTool({
      name: 'submission_update',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        submissionId: SUB_ID,
        data: { name: 'Software' },
      },
    });

    expect(result.isError).toBeFalsy();
    expect(methods()).toEqual(['GET', 'PUT?dryrun', 'PUT']);
    const put = mockFormioFetch.mock.calls.find(
      ([path, params, , options]) =>
        path === SUB_PATH &&
        (options as Options)?.method === 'PUT' &&
        !(params as Record<string, string>).dryrun
    )!;
    const body = (put[3] as Options).body!;
    expect(body.data).toEqual({ name: 'Software', status: 'open' });
    const tag = body.metadata?.agent as Record<string, unknown>;
    expect(tag.session).toBe(existing.metadata.agent.session);
    expect(tag.purpose).toBe('test');
    expect(tag.nonce).toBe(existing.metadata.agent.nonce);
    expect(body.metadata?.jwtIssuedAfter).toBe(1);

    const key = getOrCreateKey({ cwd: TEST_CWD });
    const stored = { ...existing, data: body.data, metadata: body.metadata };
    expect(
      verifyRecord(stored, { key, projectUrl: TEST_PROJECT_URL, formId: FORM_ID })
    ).not.toBeNull();
    expect(result.structuredContent).toMatchObject({
      _id: SUB_ID,
      data: { name: 'Software', status: 'open' },
      purpose: 'test',
      triggeredActions: ['Notify on change'],
    });
  });
});

describe('submission_delete', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('carries the removes annotations', async () => {
    const { client } = await createTestClient(registerSubmissionDeleteTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'submission_delete');
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    });
    expect(tool?.description).toMatch(/created and signed/);
  });

  it('verifies then deletes, naming the delete actions it ran', async () => {
    fakeServer(signedRecord({ name: 'Hardware' }));
    const { client } = await createTestClient(registerSubmissionDeleteTool);

    const result = await client.callTool({
      name: 'submission_delete',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, submissionId: SUB_ID },
    });

    expect(result.isError).toBeFalsy();
    expect(methods()).toEqual(['GET', 'DELETE']);
    expect(result.structuredContent).toEqual({
      deleted: SUB_ID,
      triggeredActions: ['Audit delete'],
    });
  });

  it('sends no DELETE for a submission this directory did not sign', async () => {
    fakeServer(humanRecord());
    const { client } = await createTestClient(registerSubmissionDeleteTool);

    const result = await client.callTool({
      name: 'submission_delete',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, submissionId: SUB_ID },
    });

    expect(result.isError).toBe(true);
    expect(methods()).toEqual(['GET']);
  });
});
