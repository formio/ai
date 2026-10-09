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
  toolDirectory,
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
        'Report which Form.io project the working directory resolves to, which deployment hosts it, and which layer supplied each — the preflight before the first call that reads from or writes to a deployment. It uses the resolver every tool uses, so no shell command is needed.',
        'Branch on `status`: "ok" — proceed. "not-configured" — relay the message, ask the user for the one value it names, record it with project_set, and call this again. "base-url-unresolved" — the project IS recorded: ask for the Base URL alone, never the Project URL again.',
        'Reads only; project_set records a choice.',
      ].join(' '),
      inputSchema: { cwd: cwdSchema },
      outputSchema: projectResolutionOutput,
      annotations: local('Report the active project', true),
    },
    async ({ cwd }) => {
      const notes: string[] = [];
      try {
        const directory = await toolDirectory({ server, cwd, serverCwd: getServerCwd });
        const report = reportProjectForTool({ directory, config, notes });
        return toMcpStructuredResult(
          projectReportPayload(report, directory),
          projectReportText(report)
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
