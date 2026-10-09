import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_NAME, SERVER_VERSION } from '../cli-launch.js';
import { FormioConfig } from '../config.js';
import { toMcpError, toMcpStructuredResult } from '../mcp-responses.js';
import { serverStatusOutput } from '../output-schemas.js';
import { cwdSchema } from '../project-resolver.js';
import { local } from '../tool-annotations.js';
import {
  projectReportPayload,
  projectReportText,
  reportProjectForTool,
} from './project-resolution.js';

export interface ServerStatusOptions {
  cwd?: () => string;
}

export function registerServerStatusTool(
  server: McpServer,
  config: FormioConfig,
  options: ServerStatusOptions = {}
) {
  const getServerCwd = options.cwd ?? (() => process.cwd());
  server.registerTool(
    'server_status',
    {
      description:
        "Report this server's name and version and how the given working directory resolves to a Form.io project (the same answer project_get gives). Makes no Form.io request and needs no project or credentials, so it is the first thing to call when other tools fail.",
      inputSchema: { cwd: cwdSchema },
      outputSchema: serverStatusOutput,
      annotations: local('Report server status', true),
    },
    async ({ cwd }) => {
      const notes: string[] = [];
      const heading = `${SERVER_NAME} ${SERVER_VERSION}`;
      try {
        const report = reportProjectForTool({ cwd, serverCwd: getServerCwd, config, notes });
        return toMcpStructuredResult(
          { name: SERVER_NAME, version: SERVER_VERSION, ...projectReportPayload(report) },
          [heading, projectReportText(report)].join('\n')
        );
      } catch (error) {
        // A record that cannot be read is not "nothing configured"; it fails as
        // project_get does, naming the server that answered.
        return toMcpError(error, [heading, ...notes]);
      }
    }
  );
}
