import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { templateShape } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerProjectExportTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'project_export',
    {
      description:
        "Export the complete template (roles, resources, forms, actions) of the Form.io project mapped to the user's current working directory as a portable JSON document. Use this to snapshot a project before importing changes.",
      inputSchema: {
        cwd: cwdSchema,
      },
      outputSchema: templateShape,
      annotations: reads('Export the project template'),
    },
    async ({ cwd }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const template = (await formioFetch('export', {}, cfg)) as Record<string, unknown>;
        return toMcpStructuredResult(template);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
