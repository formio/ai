import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { templateDocument } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerProjectExportTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'project_export',
    {
      description:
        'Export the project `cwd` resolves to as a template (roles, resources, forms, actions) — the snapshot to take before project_import.',
      inputSchema: {
        cwd: cwdSchema,
      },
      outputSchema: templateDocument,
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
