import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { toMcpError, toMcpStructuredResult } from '../mcp-responses.js';
import { projectResolutionOutput } from '../output-schemas.js';
import { cwdSchema } from '../project-resolver.js';
import { local } from '../tool-annotations.js';
import {
  projectReportPayload,
  projectReportText,
  reportProjectForTool,
} from './project-resolution.js';

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
      outputSchema: projectResolutionOutput,
      annotations: local('Report the project this directory resolves to', true),
    },
    async ({ cwd }) => {
      const notes: string[] = [];
      try {
        const report = reportProjectForTool({ cwd, serverCwd: getServerCwd, config, notes });
        return toMcpStructuredResult(projectReportPayload(report), projectReportText(report));
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
