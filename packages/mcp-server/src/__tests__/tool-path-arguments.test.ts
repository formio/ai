import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CWD, ToolRegister } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...original,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { registerFormGetTool } = await import('../tools/form_get.js');
const { registerFormRevisionsListTool } = await import('../tools/form_revisions_list.js');
const { registerFormRevisionGetTool } = await import('../tools/form_revision_get.js');
const { registerActionListTool } = await import('../tools/action_list.js');
const { registerActionCreateTool } = await import('../tools/action_create.js');
const { registerActionGetTool } = await import('../tools/action_get.js');
const { registerActionUpdateTool } = await import('../tools/action_update.js');
const { registerActionDeleteTool } = await import('../tools/action_delete.js');
const { registerActionTypesListTool } = await import('../tools/action_types_list.js');
const { registerActionTypeGetTool } = await import('../tools/action_type_get.js');

const FORM_ID = '65a1b2c3d4e5f60718293a4b';
const ACTION_ID = '65a1b2c3d4e5f60718293a4c';
const ACTION = { name: 'email', title: 'Email', handler: ['after'], method: ['create'] };

interface ToolCase {
  tool: string;
  register: ToolRegister;
  // Valid values for every argument, so a refusal is about the argument under test alone.
  valid: Record<string, unknown>;
  // The arguments the tool-path-arguments spec names for this tool, and their rule.
  pathArguments: Record<string, 'project-path' | 'resource-segment'>;
}

const CASES: ToolCase[] = [
  {
    tool: 'form_get',
    register: registerFormGetTool,
    valid: { formIdOrPath: 'user/login' },
    pathArguments: { formIdOrPath: 'project-path' },
  },
  {
    tool: 'form_revisions_list',
    register: registerFormRevisionsListTool,
    valid: { formIdOrPath: 'user/login' },
    pathArguments: { formIdOrPath: 'project-path' },
  },
  {
    tool: 'form_revision_get',
    register: registerFormRevisionGetTool,
    valid: { formIdOrPath: 'user/login', version: '3' },
    pathArguments: { formIdOrPath: 'project-path', version: 'resource-segment' },
  },
  {
    tool: 'action_list',
    register: registerActionListTool,
    valid: { formId: FORM_ID },
    pathArguments: { formId: 'resource-segment' },
  },
  {
    tool: 'action_create',
    register: registerActionCreateTool,
    valid: { formId: FORM_ID, action: ACTION },
    pathArguments: { formId: 'resource-segment' },
  },
  {
    tool: 'action_get',
    register: registerActionGetTool,
    valid: { formId: FORM_ID, actionId: ACTION_ID },
    pathArguments: { formId: 'resource-segment', actionId: 'resource-segment' },
  },
  {
    tool: 'action_update',
    register: registerActionUpdateTool,
    valid: { formId: FORM_ID, actionId: ACTION_ID, action: ACTION },
    pathArguments: { formId: 'resource-segment', actionId: 'resource-segment' },
  },
  {
    tool: 'action_delete',
    register: registerActionDeleteTool,
    valid: { formId: FORM_ID, actionId: ACTION_ID },
    pathArguments: { formId: 'resource-segment', actionId: 'resource-segment' },
  },
  {
    tool: 'action_types_list',
    register: registerActionTypesListTool,
    valid: { formId: FORM_ID },
    pathArguments: { formId: 'resource-segment' },
  },
  {
    tool: 'action_type_get',
    register: registerActionTypeGetTool,
    valid: { formId: FORM_ID, actionName: 'email' },
    pathArguments: { formId: 'resource-segment', actionName: 'resource-segment' },
  },
];

// Refused by both rules.
const REFUSED_EVERYWHERE = ['https://example.com/x', '//example.com/x', 'x/../../other', '..'];
// Refused only where an argument names one resource.
const REFUSED_AS_SEGMENT = ['abc/def'];

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content ?? [];
  return content.map((item) => item.text ?? '').join('\n');
}

const refusals = CASES.flatMap(({ tool, register, valid, pathArguments }) =>
  Object.entries(pathArguments).flatMap(([argument, rule]) =>
    [...REFUSED_EVERYWHERE, ...(rule === 'resource-segment' ? REFUSED_AS_SEGMENT : [])].map(
      (value) => ({ tool, register, valid, argument, value })
    )
  )
);

describe('tool arguments that become request paths', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    mockFormioFetch.mockResolvedValue({});
  });

  it.each(refusals)(
    '$tool refuses $argument = $value without making a request',
    async ({ tool, register, valid, argument, value }) => {
      const { client } = await createTestClient(register);
      const result = await client.callTool({
        name: tool,
        arguments: { cwd: TEST_CWD, ...valid, [argument]: value },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain(argument);
      expect(mockFormioFetch).not.toHaveBeenCalled();
    }
  );

  it.each(CASES)('$tool still declares every path argument it is checked on', async (entry) => {
    const { client } = await createTestClient(entry.register);
    const { tools } = await client.listTools();
    const listed = tools.find((t) => t.name === entry.tool);
    expect(Object.keys(listed?.inputSchema.properties ?? {})).toEqual(
      expect.arrayContaining(Object.keys(entry.pathArguments))
    );
  });

  it('form_get still requests a multi-segment form path as given', async () => {
    const { client } = await createTestClient(registerFormGetTool);
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
    const { client } = await createTestClient(registerFormRevisionGetTool);
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
