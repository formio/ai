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

const { registerSubmissionGetTool } = await import('../tools/submission_get.js');
const { registerSubmissionListTool } = await import('../tools/submission_list.js');
const { FormioApiError } = await import('../formio-client.js');
const { getOrCreateKey, sessionLabel } = await import('../submission-keys.js');
const { signTag } = await import('../agent-scope.js');

const FORM_ID = '65f000000000000000000001';
const SUB_ID = '65f0000000000000000000b1';
const OWNER = '65f0000000000000000000aa';
const SENTINEL = 'OUTSIDER-SENTINEL-7f3a';

function signedRecord(data: Record<string, unknown>, id = SUB_ID) {
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
    _id: id,
    form: FORM_ID,
    owner: OWNER,
    created: '2026-09-29T00:00:00.000Z',
    modified: '2026-09-29T00:00:00.000Z',
    data,
    access: [{ type: 'read', resources: [OWNER] }],
    metadata: { timezone: 'UTC', agent: tag },
  };
}

function humanRecord(id = '65f0000000000000000000c1') {
  return {
    _id: id,
    form: FORM_ID,
    owner: '65f0000000000000000000ff',
    data: { name: SENTINEL },
    metadata: { timezone: 'America/Chicago' },
  };
}

function text(result: unknown): string {
  return JSON.stringify(result);
}

describe('submission_get', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is registered with read-only annotations and a description naming the scope', async () => {
    const { client } = await createTestClient(registerSubmissionGetTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'submission_get');
    expect(tool).toBeDefined();
    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toMatch(/created and signed/);
    expect(tool?.description).toContain('agent-submissions.md');
    expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual(
      expect.arrayContaining(['cwd', 'formIdOrPath', 'submissionId'])
    );
  });

  it('returns the projected record for a submission this directory signed', async () => {
    const { client } = await createTestClient(registerSubmissionGetTool);
    const record = signedRecord({ name: 'Hardware' });
    mockFormioFetch.mockResolvedValueOnce(record);

    const result = await client.callTool({
      name: 'submission_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, submissionId: SUB_ID },
    });

    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${FORM_ID}/submission/${SUB_ID}`,
      {},
      TEST_CONFIG
    );
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      _id: SUB_ID,
      form: FORM_ID,
      created: record.created,
      modified: record.modified,
      data: { name: 'Hardware' },
      purpose: 'test',
    });
    expect(text(result)).not.toContain(record.metadata.agent.sig);
    expect(text(result)).not.toContain(OWNER);
  });

  it('resolves a form path to its id before fetching', async () => {
    const { client } = await createTestClient(registerSubmissionGetTool);
    mockFormioFetch
      .mockResolvedValueOnce({ _id: FORM_ID })
      .mockResolvedValueOnce(signedRecord({ name: 'x' }));

    await client.callTool({
      name: 'submission_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'category', submissionId: SUB_ID },
    });

    expect(mockFormioFetch).toHaveBeenNthCalledWith(1, 'category', { select: '_id' }, TEST_CONFIG);
    expect(mockFormioFetch).toHaveBeenNthCalledWith(
      2,
      `form/${FORM_ID}/submission/${SUB_ID}`,
      {},
      TEST_CONFIG
    );
  });

  it('returns not-found with none of its content for a submission this directory did not sign', async () => {
    const { client } = await createTestClient(registerSubmissionGetTool);
    mockFormioFetch.mockResolvedValueOnce(humanRecord(SUB_ID));

    const result = await client.callTool({
      name: 'submission_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, submissionId: SUB_ID },
    });

    expect(result.isError).toBe(true);
    expect(text(result)).not.toContain(SENTINEL);
    expect(text(result)).not.toContain('America/Chicago');
  });

  it('returns the same not-found result for a Form.io 404 as for a failed verification', async () => {
    const { client } = await createTestClient(registerSubmissionGetTool);
    mockFormioFetch.mockResolvedValueOnce(humanRecord(SUB_ID));
    const unverified = await client.callTool({
      name: 'submission_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, submissionId: SUB_ID },
    });

    mockFormioFetch.mockRejectedValueOnce(
      new FormioApiError(404, new URL(`${TEST_PROJECT_URL}/x`))
    );
    const missing = await client.callTool({
      name: 'submission_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, submissionId: SUB_ID },
    });

    expect(missing).toEqual(unverified);
  });

  it('refuses a submission id that is not a Mongo id without making a request', async () => {
    const { client } = await createTestClient(registerSubmissionGetTool);
    const result = await client.callTool({
      name: 'submission_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, submissionId: '../../admin' },
    });
    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });
});

describe('submission_list', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is registered with read-only annotations', async () => {
    const { client } = await createTestClient(registerSubmissionListTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'submission_list');
    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toMatch(/created and signed/);
  });

  it('sends the server-built query for this directory', async () => {
    const { client } = await createTestClient(registerSubmissionListTool);
    mockFormioFetch.mockResolvedValueOnce([]);

    await client.callTool({
      name: 'submission_list',
      arguments: {
        cwd: TEST_CWD,
        formIdOrPath: FORM_ID,
        purpose: 'test',
        filters: { 'data.name': 'Hardware' },
      },
    });

    const session = sessionLabel(getOrCreateKey({ cwd: TEST_CWD }));
    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${FORM_ID}/submission`,
      {
        'data.name': 'Hardware',
        'metadata.agent.source': 'agent',
        'metadata.agent.session': session,
        'metadata.agent.purpose': 'test',
        select: '_id,form,owner,data,metadata,created,modified',
        limit: '25',
      },
      TEST_CONFIG
    );
  });

  it.each([{ 'metadata.agent.session': 'x' }, { $or: 'x' }, { 'data.x[$ne]': 'y' }])(
    'refuses filters %j without making a request',
    async (filters) => {
      const { client } = await createTestClient(registerSubmissionListTool);
      const result = await client.callTool({
        name: 'submission_list',
        arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, filters },
      });
      expect(result.isError).toBe(true);
      expect(mockFormioFetch).not.toHaveBeenCalled();
    }
  );

  it('rejects a limit outside 1–100', async () => {
    const { client } = await createTestClient(registerSubmissionListTool);
    const result = await client.callTool({
      name: 'submission_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, limit: 500 },
    });
    expect(result.isError).toBe(true);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('drops forged and human records, counts them, and returns none of their content', async () => {
    const { client } = await createTestClient(registerSubmissionListTool);
    const genuine = signedRecord({ name: 'Hardware' });
    const forged = { ...humanRecord('65f0000000000000000000c2'), metadata: genuine.metadata };
    mockFormioFetch.mockResolvedValueOnce([genuine, forged, humanRecord()]);

    const result = await client.callTool({
      name: 'submission_list',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      submissions: { _id: string }[];
      returned: number;
      dropped: number;
    };
    expect(structured.submissions.map((s) => s._id)).toEqual([SUB_ID]);
    expect(structured.returned).toBe(1);
    expect(structured.dropped).toBe(2);
    expect(text(result)).not.toContain(SENTINEL);
  });
});
