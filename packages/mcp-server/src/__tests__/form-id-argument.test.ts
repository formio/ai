import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestClient, stubRevisionsLicence, TEST_CWD } from './test-helpers.js';
import { ERROR_META_KEY } from '../mcp-responses.js';

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

// Every tool whose `formId` names a form by its _id, with valid values for its other
// required arguments, so a refusal is about `formId` alone.
const FORM_ID_TOOLS: Record<string, Record<string, unknown>> = {
  action_list: {},
  action_get: { actionId: ACTION_ID },
  action_create: { action: ACTION },
  action_update: { actionId: ACTION_ID, action: ACTION },
  action_delete: { actionId: ACTION_ID },
  action_type_list: {},
  action_type_get: { actionName: 'email' },
  form_update: { form: { components: [] }, note: 'n', acceptNoHistory: true },
  form_publish: { note: 'n' },
  form_revert: { version: '3', note: 'n' },
};

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  _meta?: Record<string, { code?: string } | undefined>;
}

function textOf(result: ToolResult): string {
  return result.content.map((item) => item.text ?? '').join('\n');
}

describe('formId takes a form _id on every tool that has it', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
    mockFormioFetch.mockResolvedValue({});
    stubRevisionsLicence(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('every registered formId argument is covered here', async () => {
    const { client } = await createTestClient(registerAllTools);
    const { tools } = await client.listTools();
    const withFormId = tools
      .filter((tool) => Object.keys(tool.inputSchema.properties ?? {}).includes('formId'))
      .map((tool) => tool.name)
      .sort();
    expect(withFormId).toEqual(Object.keys(FORM_ID_TOOLS).sort());
  });

  it.each(['user/login', 'user', '67890abc', 'zzzzzzzzzzzzzzzzzzzzzzzz'])(
    'refuses formId %j with INVALID_ARGUMENT and the form_get remedy, before any request',
    async (formId) => {
      const { client } = await createTestClient(registerAllTools);
      const failures: string[] = [];
      for (const [tool, args] of Object.entries(FORM_ID_TOOLS)) {
        mockFormioFetch.mockClear();
        const result = (await client.callTool({
          name: tool,
          arguments: { cwd: TEST_CWD, ...args, formId },
        })) as ToolResult;
        const text = textOf(result);
        const refusedWithRemedy =
          result.isError === true &&
          result._meta?.[ERROR_META_KEY]?.code === 'INVALID_ARGUMENT' &&
          text.startsWith('[INVALID_ARGUMENT] ') &&
          text.includes('formId') &&
          text.includes('form_get') &&
          text.includes('formIdOrPath') &&
          mockFormioFetch.mock.calls.length === 0;
        if (!refusedWithRemedy) {
          failures.push(`${tool}: ${text}`);
        }
      }
      expect(failures).toEqual([]);
    }
  );

  it('accepts an upper-case ObjectId', async () => {
    const { client } = await createTestClient(registerAllTools);
    await client.callTool({
      name: 'action_get',
      arguments: { cwd: TEST_CWD, formId: FORM_ID.toUpperCase(), actionId: ACTION_ID },
    });
    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${FORM_ID.toUpperCase()}/action/${ACTION_ID}`,
      expect.anything(),
      expect.anything()
    );
  });
});
