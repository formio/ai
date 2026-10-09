import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerAllTools } = await import('../tools/index.js');

const FORM_ID = '65a1b2c3d4e5f60718293a4b';
const ACTION_ID = '65a1b2c3d4e5f60718293a4c';
const ACTION = { name: 'email', title: 'Email', handler: ['after'], method: ['create'] };

// Every argument name that a tool joins into a request path. A registered tool that
// declares one of these must have a fixture below, so a tool added later — or an
// argument added to an existing one — is checked without anyone remembering to list it.
const PATH_ARGUMENTS = ['formIdOrPath', 'formId', 'actionId', 'actionName', 'version', 'roleId'];

// Valid values for every required argument, so a refusal is about the argument under test alone.
const VALID_ARGUMENTS: Record<string, Record<string, unknown>> = {
  form_get: { formIdOrPath: 'user/login' },
  form_revisions_list: { formIdOrPath: 'user/login' },
  form_revision_get: { formIdOrPath: 'user/login', version: '3' },
  form_update: {
    formId: FORM_ID,
    form: { components: [] },
    note: 'Reverted to version 3',
    revert: true,
    version: '3',
  },
  role_update: { roleId: FORM_ID, role: { title: 'Admin' } },
  action_list: { formId: FORM_ID },
  action_create: { formId: FORM_ID, action: ACTION },
  action_get: { formId: FORM_ID, actionId: ACTION_ID },
  action_update: { formId: FORM_ID, actionId: ACTION_ID, action: ACTION },
  action_delete: { formId: FORM_ID, actionId: ACTION_ID },
  action_types_list: { formId: FORM_ID },
  action_type_get: { formId: FORM_ID, actionName: 'email' },
};

// Each value the URL parser would reinterpret: another origin, a walk up the path
// (plain or percent-encoded), or a query or fragment that cuts the templated path off.
const REFUSED = [
  'https://example.com/x',
  '//example.com/x',
  'x/../../other',
  '%2e%2e',
  'x?y',
  'x#y',
];

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content ?? [];
  return content.map((item) => item.text ?? '').join('\n');
}

async function registeredPathArguments() {
  const { client } = await createTestClient(registerAllTools);
  const { tools } = await client.listTools();
  return tools.flatMap((tool) =>
    Object.keys(tool.inputSchema.properties ?? {})
      .filter((argument) => PATH_ARGUMENTS.includes(argument))
      .map((argument) => ({ tool: tool.name, argument }))
  );
}

describe('tool arguments that become request paths', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    mockFormioFetch.mockResolvedValue({});
  });

  it('every registered tool with a path argument has a fixture', async () => {
    const uncovered = (await registeredPathArguments())
      .map(({ tool }) => tool)
      .filter((tool) => !VALID_ARGUMENTS[tool]);
    expect(uncovered).toEqual([]);
  });

  it('every registered path argument refuses every reinterpreted value without a request', async () => {
    const { client } = await createTestClient(registerAllTools);
    const accepted: string[] = [];
    for (const { tool, argument } of await registeredPathArguments()) {
      for (const value of REFUSED) {
        mockFormioFetch.mockClear();
        const result = await client.callTool({
          name: tool,
          arguments: { cwd: TEST_CWD, ...VALID_ARGUMENTS[tool], [argument]: value },
        });
        if (
          !result.isError ||
          !textOf(result).includes(argument) ||
          mockFormioFetch.mock.calls.length > 0
        ) {
          accepted.push(`${tool}.${argument} = ${value}`);
        }
      }
    }
    expect(accepted).toEqual([]);
  });

  it('form_get still requests a multi-segment form path as given', async () => {
    const { client } = await createTestClient(registerAllTools);
    await client.callTool({
      name: 'form_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'user/login' },
    });
    expect(mockFormioFetch).toHaveBeenCalledWith(
      'user/login',
      expect.anything(),
      expect.anything()
    );
  });

  it('form_revision_get still requests a revision under a form path', async () => {
    const { client } = await createTestClient(registerAllTools);
    await client.callTool({
      name: 'form_revision_get',
      arguments: { cwd: TEST_CWD, formIdOrPath: 'user/login', version: '3' },
    });
    expect(mockFormioFetch).toHaveBeenCalledWith(
      'user/login/v/3',
      expect.anything(),
      expect.anything()
    );
  });
});
