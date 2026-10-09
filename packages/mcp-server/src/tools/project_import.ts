import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpError, toMcpStructuredResult } from '../mcp-responses.js';
import { acknowledgementOutput } from '../output-schemas.js';
import { overwrites } from '../tool-annotations.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';

export function registerProjectImportTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'project_import',
    {
      description:
        "Merge a template's roles, resources, forms and actions into the existing project `cwd` resolves to, in one call. Build the template with the formio-resource-planner skill, and snapshot first with project_export: the import merges, it does not replace.",
      inputSchema: {
        cwd: cwdSchema,
        template: z.looseObject({}).describe('The template JSON object to import'),
      },
      outputSchema: acknowledgementOutput,
      annotations: overwrites('Import a project template'),
    },
    async ({ cwd, template }) => {
      try {
        const cfg = await resolveToolConfig({ server, cwd, config });
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
