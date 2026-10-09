import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { actionsListOutput } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { formIdArgument, requireFormId } from './form-id.js';
import { fetchListPage, listArguments, listResult } from './list-contract.js';

export function registerActionListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'action_list',
    {
      description:
        'List the actions configured on a form, one page at a time — the server-side handlers that run when a submission is saved, such as save-to-resource, email, login, and role assignment.',
      inputSchema: {
        cwd: cwdSchema,
        formId: formIdArgument(),
        ...listArguments(),
      },
      outputSchema: actionsListOutput,
      annotations: reads('List form actions'),
    },
    async ({ cwd, formId, ...query }) => {
      try {
        requireFormId(formId);
        const cfg = resolveProjectConfig(cwd, config);
        const page = await fetchListPage({ path: `form/${formId}/action`, query, config: cfg });
        return toMcpStructuredResult(listResult('actions', page));
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
