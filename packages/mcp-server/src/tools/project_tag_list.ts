import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { tagListOutput } from '../output-schemas.js';
import { compareTemplates } from '../project-versions/template-compare.js';
import {
  currentVersion,
  exportProject,
  listTagEntries,
  readCurrentTag,
  summaryOf,
  templateOfEntry,
} from '../project-versions/tags.js';
import { reads } from '../tool-annotations.js';
import { cwdSchema } from '../project-resolver.js';
import { resolveToolConfig } from './project-resolution.js';

export function registerProjectTagListTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'project_tag_list',
    {
      description:
        'Report the version the project `cwd` resolves to is at (`current`) and its version tags, newest first. With `compare: true`, also report the roles, resources, forms and actions changed since `current` — changes made outside the agent.',
      inputSchema: {
        cwd: cwdSchema,
        compare: z
          .boolean()
          .optional()
          .describe('Compare the project with its current tag (two template transfers)'),
      },
      outputSchema: tagListOutput,
      annotations: reads('List project versions'),
    },
    async ({ cwd, compare }) => {
      try {
        const cfg = await resolveToolConfig({ server, cwd, config });
        const [entries, reported] = await Promise.all([listTagEntries(cfg), readCurrentTag(cfg)]);
        const tags = entries.map(summaryOf);
        const current = currentVersion(reported, tags);
        const listing = { ...(current ? { current } : {}), tags };
        if (!compare) {
          return toMcpStructuredResult(listing);
        }
        if (!current) {
          return toMcpStructuredResult({
            ...listing,
            comparison: { message: 'The project has no version to compare against.' },
          });
        }
        // A deploy from a template, or a deleted tag, can leave `current` naming a
        // version with no stored template.
        const entry = entries.find((candidate) => candidate.tag === current && candidate.id);
        if (!entry) {
          return toMcpStructuredResult({
            ...listing,
            comparison: {
              message: `The project is at ${current}, which has no stored tag to compare against.`,
            },
          });
        }
        const [exported, tagged] = await Promise.all([
          exportProject(cfg),
          templateOfEntry(cfg, entry),
        ]);
        return toMcpStructuredResult({
          ...listing,
          comparison: { against: current, ...compareTemplates({ current: exported, tagged }) },
        });
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
