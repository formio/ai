import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

const DEFAULT_SELECT = '_id,title,name,path,type,tags';
const DEFAULT_LIMIT = 20;

export function registerFormListTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_list',
    "List forms from the Form.io project mapped to the user's current working directory with optional filtering and pagination.",
    {
      cwd: cwdSchema,
      type: z.enum(['form', 'resource']).optional().describe('Filter by form type'),
      limit: z.number().optional().describe('Maximum number of forms to return (default: 20)'),
      skip: z.number().optional().describe('Number of forms to skip for pagination'),
      sort: z.string().optional().describe('Sort field and direction (e.g. "-created")'),
      select: z
        .string()
        .optional()
        .describe('Comma-separated fields to return (default: _id,title,name,path,type,tags)'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
    },
    async ({ cwd, type, limit, skip, sort, select, tags }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const params: Record<string, string | undefined> = {
          select: select ?? DEFAULT_SELECT,
          limit: String(limit ?? DEFAULT_LIMIT),
          skip: skip !== undefined ? String(skip) : undefined,
          sort,
          type,
          tags: tags?.join(','),
        };
        const forms = await formioFetch('form', params, cfg);
        return toMcpTextResult(forms);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
