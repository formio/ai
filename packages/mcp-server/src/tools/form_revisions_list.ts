import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch, isMongoId } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

interface RawRevision {
  _vid?: number | string;
  _vnote?: string;
  _vuser?: string;
  modified?: string;
  [key: string]: unknown;
}

interface RevisionSummary {
  vid: number | string | undefined;
  modified: string | undefined;
  user: string | undefined;
  note: string | undefined;
}

function summarizeRevision(raw: RawRevision): RevisionSummary {
  return {
    vid: raw._vid,
    modified: raw.modified,
    user: raw._vuser,
    note: raw._vnote,
  };
}

export function registerFormRevisionsListTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'form_revisions_list',
    'List published revisions of a Form.io form. Returns a compact array of revision summaries: `vid` (sequential version), `modified` (ISO timestamp), `user` (publisher display name from `_vuser`), `note` (revision note from `_vnote`). Full form snapshots are intentionally omitted — use `form_revision_get` to fetch a specific revision\'s components and form definition. Does NOT include the active draft (drafts have `_vid: "draft"`); use `form_draft_get` to read the active draft.',
    {
      cwd: cwdSchema,
      formIdOrPath: z
        .string()
        .describe('Form _id (24-char Mongo ObjectId) or path (e.g. "user/login")'),
    },
    async ({ cwd, formIdOrPath }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        const formId = isMongoId(formIdOrPath)
          ? formIdOrPath
          : ((await formioFetch(formIdOrPath, {}, cfg)) as { _id: string })._id;
        const revisions = (await formioFetch(`form/${formId}/v`, {}, cfg)) as RawRevision[];
        const summaries = revisions.map(summarizeRevision);
        return toMcpTextResult(summaries);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
