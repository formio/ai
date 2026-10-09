import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { rolesListOutput } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { fetchListPage, listArguments, listResult } from './list-contract.js';

export function registerRoleListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'role_list',
    {
      description:
        "List the roles defined in the Form.io project mapped to the user's current working directory, one page at a time.",
      inputSchema: {
        cwd: cwdSchema,
        ...listArguments(),
      },
      outputSchema: rolesListOutput,
      annotations: reads('List roles'),
    },
    async ({ cwd, ...query }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const page = await fetchListPage({ path: 'role', query, config: cfg });
        return toMcpStructuredResult(listResult('roles', page));
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
