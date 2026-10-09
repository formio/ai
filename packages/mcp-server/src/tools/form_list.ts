import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { formsListOutput } from '../output-schemas.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { fetchListPage, listArguments, listResult } from './list-contract.js';
import { ToolError } from '../tool-errors.js';

// Summary fields only: a page of full form definitions floods the context.
const DEFAULTS = { select: '_id,title,name,path,type,tags' };

// Form.io splits `tags__all` on commas, so a tag holding one would be read as several
// and match forms carrying all of those instead of the one the caller named.
function requireCommaFreeTags(tags: readonly string[] = []): void {
  const split = tags.filter((tag) => tag.includes(','));
  if (split.length > 0) {
    throw new ToolError({
      code: 'INVALID_ARGUMENT',
      message: `tags cannot contain a comma: ${split.map((tag) => JSON.stringify(tag)).join(', ')}. Form.io splits the tag filter on commas, so such a tag cannot be matched as one; pass separate tags as separate array entries.`,
    });
  }
}

export function registerFormListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'form_list',
    {
      description:
        'List forms from the project `cwd` resolves to, one page at a time, optionally filtered by type and tags.',
      inputSchema: {
        cwd: cwdSchema,
        type: z.enum(['form', 'resource']).optional().describe('Filter by form type'),
        tags: z
          .array(z.string())
          .optional()
          .describe('Return only forms carrying every one of these tags'),
        ...listArguments(DEFAULTS),
      },
      outputSchema: formsListOutput,
      annotations: reads('List forms'),
    },
    async ({ cwd, type, tags, ...query }) => {
      try {
        requireCommaFreeTags(tags);
        const cfg = resolveProjectConfig(cwd, config);
        // `tags=a,b` matches the literal string "a,b"; `tags__all` is all-of.
        const filters = { type, tags__all: tags?.length ? tags.join(',') : undefined };
        const page = await fetchListPage({
          path: 'form',
          query,
          config: cfg,
          defaults: DEFAULTS,
          filters,
        });
        return toMcpStructuredResult(listResult('forms', page));
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
