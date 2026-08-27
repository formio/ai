import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { toMcpError, toMcpStructuredResult } from '../mcp-responses.js';
import { projectResolutionShape } from '../output-schemas.js';
import { cwdSchema } from '../project-resolver.js';
import { reportProject } from '../project-report.js';
import { local } from '../tool-annotations.js';
import { TOOL_REMEDIES } from './project-remedies.js';

export interface ProjectGetOptions {
  cwd?: () => string;
}

export function registerProjectGetTool(
  server: McpServer,
  config: FormioConfig,
  options: ProjectGetOptions = {}
) {
  const getServerCwd = options.cwd ?? (() => process.cwd());
  server.registerTool(
    'project_get',
    {
      description: [
        'Report which Form.io project the given working directory resolves to, which deployment hosts it, and which layer supplied each — the preflight to run before the first tool call that reads from or writes to a deployment.',
        'Answers from inside this server, using the same resolver every other tool uses, so what it reports is what the next call targets. There is no need to run any shell command to ask this.',
        'Branch on `status`. "ok" means both URLs resolved and you may proceed. "not-configured" means nothing is mapped for this directory: relay the message, ask the user for the single value it names, record it with project_set, and call this again. "base-url-unresolved" means the project IS recorded and only its deployment is missing — ask for the Base URL alone and do NOT re-ask for the Project URL.',
        'Reads only. It resolves and reports; project_set is what records a choice.',
      ].join(' '),
      inputSchema: { cwd: cwdSchema },
      outputSchema: projectResolutionShape,
      annotations: local('Report the project this directory resolves to', true),
    },
    async ({ cwd }) => {
      // Owned here so a note survives a report that cannot answer: an "Ignoring
      // <path>" note emitted while walking is often the first half of the story a
      // later throw finishes, and the catch below renders both.
      const notes: string[] = [];
      try {
        const report = reportProject({
          notes,
          // The server's own process cwd is fixed at spawn and may be mapped to a
          // different project, which is why cwd is asked for on every call. It is
          // still the documented fallback: project_set writes under the same key.
          cwd: cwd ?? getServerCwd(),
          baseConfig: config,
          remedies: TOOL_REMEDIES,
          // So the unmapped answer can say which directory it actually searched.
          // Its remedy names a cwd to record the project under, and the server's
          // own is the one directory recording it under would not help.
          cwdWasNamed: cwd !== undefined,
        });
        return toMcpStructuredResult(
          {
            status: report.status,
            cwd: report.cwd,
            ...(report.projectUrl ? { projectUrl: report.projectUrl } : {}),
            ...(report.baseUrl ? { baseUrl: report.baseUrl } : {}),
            ...(report.projectUrlSource ? { projectUrlSource: report.projectUrlSource } : {}),
            ...(report.baseUrlSource ? { baseUrlSource: report.baseUrlSource } : {}),
            shadowed: report.shadowed,
            unpaired: report.unpaired,
            ...(report.remedy ? { remedy: report.remedy } : {}),
            message: report.message,
            notes: report.notes,
          },
          // Notes lead the message, exactly as the CLI prints them. They are not
          // colour: an "Ignoring FORMIO_BASE_URL: …" note is the CAUSE of a
          // base-url-unresolved answer, and the server's-own-directory note is the
          // reason an `ok` answer may be about the wrong project. Left in
          // structuredContent alone they vanish in every client that surfaces only
          // text, which showed the user a bare "could not be determined" about a
          // variable that had just been discarded unread.
          [...report.notes, report.message].filter(Boolean).join('\n')
        );
      } catch (error) {
        // "Could not answer at all" — an unreadable map, a formio.json that will
        // not parse. Deliberately NOT a "not-configured" status: that status
        // sends the caller to project_set, whose rewrite is what destroys the
        // other mappings in a file that is merely unreadable.
        //
        // The notes lead it, exactly as they lead a successful answer: reported
        // alone, the second problem hid the first.
        return toMcpError(error, notes);
      }
    }
  );
}
