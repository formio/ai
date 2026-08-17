import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { FormioConfig } from '../config.js';
import { registerAllTools } from '../tools/index.js';

// Every project-scoped tool must fail the same way when no project can be
// resolved: an actionable message rather than an HTTP attempt against an
// undefined URL. The config here deliberately carries no projectUrl and the cwd
// is deliberately unmapped.
const UNCONFIGURED: FormioConfig = { baseUrl: 'https://api.form.io' };
const UNMAPPED_CWD = '/workspace/unmapped-project';

// Valid-but-fictional inputs: resolution fails before any of these values are
// used, and they exist only to get past input validation.
const OBJECT_ID = '0123456789abcdef01234567';
const ANOTHER_OBJECT_ID = 'fedcba98765432100fedcba9';
const FORM = { title: 'X', name: 'x', path: 'x', components: [] };
const ACTION = { name: 'save', title: 'Save', handler: ['before'], method: ['create'] };

const PROJECT_SCOPED_CALLS: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: 'form_list', args: {} },
  { name: 'form_get', args: { formIdOrPath: 'contact' } },
  { name: 'form_create', args: { form: FORM } },
  { name: 'form_update', args: { formId: OBJECT_ID, note: 'n', form: FORM } },
  { name: 'form_revisions_list', args: { formIdOrPath: 'contact' } },
  { name: 'form_revision_get', args: { formIdOrPath: 'contact', version: '1' } },
  { name: 'role_list', args: {} },
  { name: 'role_create', args: { title: 'Manager' } },
  { name: 'role_update', args: { roleId: OBJECT_ID, role: { title: 'Manager' } } },
  { name: 'action_types_list', args: { formId: OBJECT_ID } },
  { name: 'action_type_get', args: { formId: OBJECT_ID, actionName: 'save' } },
  { name: 'action_create', args: { formId: OBJECT_ID, action: ACTION } },
  { name: 'action_list', args: { formId: OBJECT_ID } },
  { name: 'action_get', args: { formId: OBJECT_ID, actionId: ANOTHER_OBJECT_ID } },
  {
    name: 'action_update',
    args: { formId: OBJECT_ID, actionId: ANOTHER_OBJECT_ID, action: ACTION },
  },
  { name: 'action_delete', args: { formId: OBJECT_ID, actionId: ANOTHER_OBJECT_ID } },
  { name: 'project_export', args: {} },
  { name: 'project_import', args: { template: { title: 'T' } } },
];

async function connectAllTools() {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerAllTools(server, UNCONFIGURED);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

function resultText(result: unknown): string {
  const { content } = (result ?? {}) as { content?: Array<{ type: string; text?: string }> };
  return (content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n');
}

describe('project-scoped tools with no resolvable project', () => {
  it.each(PROJECT_SCOPED_CALLS)(
    '$name returns the actionable resolution error',
    async ({ name, args }) => {
      const client = await connectAllTools();

      const result = await client.callTool({
        name,
        arguments: { cwd: UNMAPPED_CWD, ...args },
      });

      expect(result.isError, `${name} should have returned an error`).toBe(true);
      const text = resultText(result);
      expect(text).toMatch(/project_set/);
      expect(text).toMatch(/FORMIO_PROJECT_URL/);
    }
  );

  it('hello succeeds without any project configuration', async () => {
    const client = await connectAllTools();

    const result = await client.callTool({ name: 'hello', arguments: {} });

    expect(result.isError).toBeFalsy();
  });
});
