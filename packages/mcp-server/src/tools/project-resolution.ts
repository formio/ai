import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig, ResolvedFormioConfig } from '../config.js';
import { ProjectReport, reportProject } from '../project-report.js';
import { resolveProjectConfig } from '../project-resolver.js';
import {
  WorkingDirectory,
  guessedDirectory,
  isNamedDirectory,
  workspaceDirectory,
} from '../workspace-directory.js';
import { TOOL_REMEDIES } from './project-remedies.js';

export interface ToolDirectoryRequest {
  server: McpServer;
  /** The cwd the caller passed, if any. */
  cwd: string | undefined;
  /** The server's own process directory, the last source tried. */
  serverCwd?: () => string;
}

/**
 * The directory a tool call resolves against: the caller's cwd, else the client's
 * workspace root, else CLAUDE_PROJECT_DIR, else the server's own directory.
 */
export function toolDirectory({
  server,
  cwd,
  serverCwd,
}: ToolDirectoryRequest): Promise<WorkingDirectory> {
  return workspaceDirectory(server).resolve({ cwd, serverCwd });
}

export interface ToolConfigRequest {
  server: McpServer;
  cwd: string | undefined;
  config: FormioConfig;
}

/** The project a project-scoped tool targets, for the directory its call resolves against. */
export async function resolveToolConfig({
  server,
  cwd,
  config,
}: ToolConfigRequest): Promise<ResolvedFormioConfig> {
  const directory = await toolDirectory({ server, cwd });
  return resolveProjectConfig(directory.dir, config, {
    cwdWasNamed: isNamedDirectory(directory),
    guessedDirectory: guessedDirectory(directory),
  });
}

export interface ToolProjectReportRequest {
  /** The directory the call resolves against, and which source supplied it. */
  directory: WorkingDirectory;
  config: FormioConfig;
  /**
   * Caller-owned and appended to in place, so a note survives a report that cannot
   * answer: an "Ignoring <path>" note emitted while walking is often the first half
   * of the story a later throw finishes, and the caller renders both.
   */
  notes: string[];
}

/**
 * The resolution a tool reports for a caller's directory — the one answer
 * project_get and server_status both give, from the resolver every other tool uses.
 */
export function reportProjectForTool({
  directory,
  config,
  notes,
}: ToolProjectReportRequest): ProjectReport {
  return reportProject({
    notes,
    cwd: directory.dir,
    baseConfig: config,
    remedies: TOOL_REMEDIES,
    // A guessed directory — the server's own, fixed at spawn, or a launch default —
    // makes the answer say so and withhold a remedy keyed to it. A directory the
    // caller or the client named is where the user is working.
    cwdWasNamed: isNamedDirectory(directory),
    guessedDirectory: guessedDirectory(directory),
  });
}

/** The report as a structured payload, omitting the halves it does not have. */
export function projectReportPayload(
  report: ProjectReport,
  directory: WorkingDirectory
): Record<string, unknown> {
  return {
    status: report.status,
    cwd: report.cwd,
    cwdSource: directory.source,
    ...(report.projectUrl ? { projectUrl: report.projectUrl } : {}),
    ...(report.baseUrl ? { baseUrl: report.baseUrl } : {}),
    ...(report.projectUrlSource ? { projectUrlSource: report.projectUrlSource } : {}),
    ...(report.baseUrlSource ? { baseUrlSource: report.baseUrlSource } : {}),
    ...(report.forced ? { forced: true } : {}),
    shadowed: report.shadowed,
    unpaired: report.unpaired,
    ...(report.remedy ? { remedy: report.remedy } : {}),
    message: report.message,
    notes: report.notes,
  };
}

/**
 * The report as text. Notes lead the message, exactly as the CLI prints them. They
 * are not colour: an "Ignoring FORMIO_BASE_URL: …" note is the CAUSE of a
 * base-url-unresolved answer, and the server's-own-directory note is the reason an
 * `ok` answer may be about the wrong project. Left in structuredContent alone they
 * vanish in every client that surfaces only text.
 */
export function projectReportText(report: ProjectReport): string {
  return [...report.notes, report.message].filter(Boolean).join('\n');
}
