/**
 * Realistic Form.io documents pass through the read and write tools intact.
 *
 * The client here lists the tools first, which is what makes the SDK client
 * validate every structuredContent against the published output schema — the
 * check a spec-compliant MCP client runs. The documents carry fields no schema
 * enumerates and the `null`s Form.io stores for its Mixed fields, so a closed or
 * over-narrow schema fails the call even though Form.io answered successfully.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, TEST_CWD, ToolRegister } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...actual,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

// The license gate is not under test; it passes the body through unchanged.
vi.mock('../revisions/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../revisions/index.js')>()),
  gateRevisionsLicense: vi
    .fn()
    .mockImplementation(async (_s, _c, { form }: { form: Record<string, unknown> }) => ({
      licensed: true,
      form,
    })),
}));

const { registerFormGetTool } = await import('../tools/form_get.js');
const { registerFormRevisionGetTool } = await import('../tools/form_revision_get.js');
const { registerFormUpdateTool } = await import('../tools/form_update.js');
const { registerActionGetTool } = await import('../tools/action_get.js');

const FORM_ID = '67890abcdef012345678abcd';
const ACTION_ID = 'abcdef012345678901234567';

// An Enterprise form as GET /form/{id} returns it: revision and PDF fields, a
// controller, e-signature settings, and the null Mixed fields a form saved
// without settings or properties carries.
const ENTERPRISE_FORM = {
  _id: FORM_ID,
  title: 'Intake',
  name: 'intake',
  path: 'intake',
  type: 'form',
  display: 'form',
  tags: [],
  components: [{ type: 'textfield', key: 'name', label: 'Name', input: true }],
  access: [{ type: 'read_all', roles: ['5f0000000000000000000001'] }],
  submissionAccess: [],
  owner: null,
  project: '5f0000000000000000000002',
  machineName: 'intake',
  created: '2026-01-01T00:00:00.000Z',
  modified: '2026-01-02T00:00:00.000Z',
  revisions: 'original',
  submissionRevisions: '',
  _vid: 4,
  pdfComponents: [],
  controller: '',
  esign: {},
  settings: null,
  properties: null,
  fieldMatchAccess: { read: [], write: [] },
};

const REVISION = {
  ...ENTERPRISE_FORM,
  _id: '5f0000000000000000000003',
  _rid: FORM_ID,
  _vid: 3,
  _vnote: '@formio/mcp: add name field',
  _vuser: 'admin@example.com',
  revisionId: '5f0000000000000000000004',
};

const ACTION = {
  _id: ACTION_ID,
  name: 'save',
  title: 'Save Submission',
  form: FORM_ID,
  handler: ['before'],
  method: ['create', 'update'],
  priority: 10,
  condition: null,
  settings: null,
  machineName: 'intake:save',
  deleted: null,
};

async function validatingClient(register: ToolRegister): Promise<Client> {
  const { client } = await createTestClient(register);
  // Listing caches each tool's output validator; every later call is checked.
  await client.listTools();
  return client;
}

describe('recorded Form.io documents through validating clients', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('form_get returns a form carrying unlisted fields and null Mixed fields', async () => {
    mockFormioFetch.mockResolvedValue(ENTERPRISE_FORM);
    const client = await validatingClient(registerFormGetTool);

    const result = await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(ENTERPRISE_FORM);
  });

  it('form_revision_get returns a revision carrying its revision fields', async () => {
    mockFormioFetch.mockResolvedValue(REVISION);
    const client = await validatingClient(registerFormRevisionGetTool);

    const result = await client.callTool({
      name: 'form_revision_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: FORM_ID, version: '3' },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(REVISION);
  });

  it('form_update returns the saved form carrying unlisted fields and null Mixed fields', async () => {
    mockFormioFetch.mockImplementation(
      async (_path: string, _params: unknown, _cfg: unknown, options?: { method?: string }) =>
        options?.method === 'PUT' ? ENTERPRISE_FORM : { ...ENTERPRISE_FORM }
    );
    const client = await validatingClient(registerFormUpdateTool);

    const result = await client.callTool({
      name: 'form_update',
      arguments: {
        cwd: TEST_CWD,
        formId: FORM_ID,
        form: { title: 'Intake', components: ENTERPRISE_FORM.components },
        note: 'retitle',
      },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(ENTERPRISE_FORM);
  });

  it('action_get returns an action whose condition and settings are null', async () => {
    mockFormioFetch.mockResolvedValue(ACTION);
    const client = await validatingClient(registerActionGetTool);

    const result = await client.callTool({
      name: 'action_get',
      arguments: { cwd: TEST_CWD, formId: FORM_ID, actionId: ACTION_ID },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(ACTION);
  });
});
