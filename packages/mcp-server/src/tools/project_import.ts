import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerProjectImportTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'project_import',
    "Import a template JSON into the existing Form.io project mapped to the user's current working directory, merging roles, resources, forms, and actions in one call. Use the formio-resource-planner skill to construct the template before calling this tool. WARNING: import merges into the existing project — use project_export first to snapshot.",
    {
      cwd: cwdSchema,
      template: z.looseObject({}).describe('The template JSON object to import'),
    },
    async ({ cwd, template }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const result = await formioFetch('import', {}, cfg, {
          method: 'POST',
          body: { template },
          responseType: 'text',
        });
        return { content: [{ type: 'text' as const, text: String(result) }] };
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
