#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { isProjectCommand, runProjectCommand } from './cli/project-command.js';
import { getConfig } from './config.js';
import { createServer } from './server.js';

const args = process.argv.slice(2);

// A project can be configured before any client has connected. Only an explicit
// `project` invocation takes this path; with no arguments the stdio transport
// starts exactly as it always has.
if (isProjectCommand(args)) {
  const result = runProjectCommand(args);
  if (result.stdout) {
    process.stdout.write(`${result.stdout}\n`);
  }
  if (result.stderr) {
    process.stderr.write(`${result.stderr}\n`);
  }
  // Not process.exit: every documented invocation of this command is through a
  // pipe (an agent's shell tool), and a piped stdout is asynchronous on macOS.
  // Exiting here can truncate or drop the output the caller is parsing, which
  // reads as "no project configured". Setting the code lets Node flush and exit
  // on its own once the write completes.
  process.exitCode = result.exitCode;
} else {
  const config = getConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
