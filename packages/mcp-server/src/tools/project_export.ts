import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, templateTransferTimeoutMs } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { templateDocument } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema } from '../project-resolver.js';
import { taggedTemplate } from '../project-versions/tags.js';
import { resolveToolConfig } from './project-resolution.js';

export function registerProjectExportTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'project_export',
    {
      description:
        "Export the project `cwd` resolves to as a template (roles, resources, forms, actions). With `tag`, export the template that version tag stored instead — how a workspace's template.json is refreshed.",
      inputSchema: {
        cwd: cwdSchema,
        tag: z.string().optional().describe('A version tag from project_tag_list'),
      },
      outputSchema: templateDocument,
      annotations: reads('Export the project template'),
    },
    async ({ cwd, tag }) => {
      try {
        const cfg = await resolveToolConfig({ server, cwd, config });
        if (tag !== undefined) {
          return toMcpStructuredResult(await taggedTemplate(cfg, tag));
        }
        const template = (await formioFetch('export', {}, cfg, {
          timeoutMs: templateTransferTimeoutMs(cfg),
        })) as Record<string, unknown>;
        return toMcpStructuredResult(template);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
