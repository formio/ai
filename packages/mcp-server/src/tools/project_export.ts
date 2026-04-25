import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerProjectExportTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'project_export',
    "Export the complete template (roles, resources, forms, actions) of the Form.io project mapped to the user's current working directory as a portable JSON document. Use this to snapshot a project before importing changes.",
    {
      cwd: cwdSchema,
    },
    async ({ cwd }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const template = await formioFetch('export', {}, cfg);
        return toMcpTextResult(template);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
