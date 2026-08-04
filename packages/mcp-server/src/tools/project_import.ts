import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpError, toMcpStructuredResult } from '../mcp-responses.js';
import { acknowledgementShape } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerProjectImportTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'project_import',
    {
      description:
        "Import a template JSON into the existing Form.io project mapped to the user's current working directory, merging roles, resources, forms, and actions in one call. Use the formio-resource-planner skill to construct the template before calling this tool. WARNING: import merges into the existing project — use project_export first to snapshot.",
      inputSchema: {
        cwd: cwdSchema,
        template: z.looseObject({}).describe('The template JSON object to import'),
      },
      outputSchema: acknowledgementShape,
      annotations: overwrites('Import a project template'),
    },
    async ({ cwd, template }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const result = await formioFetch('import', {}, cfg, {
          method: 'POST',
          body: { template },
          responseType: 'text',
        });
        // The endpoint answers with a short status string rather than a document,
        // so it is passed through as the text view unchanged.
        const message = String(result);
        return toMcpStructuredResult({ ok: true, message }, message);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
