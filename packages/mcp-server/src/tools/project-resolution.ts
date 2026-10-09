import { FormioConfig } from '../config.js';
import { ProjectReport, reportProject } from '../project-report.js';
import { TOOL_REMEDIES } from './project-remedies.js';

export interface ToolProjectReportRequest {
  /** The cwd the caller passed, if any. */
  cwd: string | undefined;
  /** The server's own process directory, used when the caller passed none. */
  serverCwd: () => string;
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
  cwd,
  serverCwd,
  config,
  notes,
}: ToolProjectReportRequest): ProjectReport {
  return reportProject({
    notes,
    // The server's own process cwd is fixed at spawn and may be mapped to a
    // different project, which is why cwd is asked for on every call. It is
    // still the documented fallback: project_set writes under the same key.
    cwd: cwd ?? serverCwd(),
    baseConfig: config,
    remedies: TOOL_REMEDIES,
    // So the unmapped answer can say which directory it actually searched.
    // Its remedy names a cwd to record the project under, and the server's
    // own is the one directory recording it under would not help.
    cwdWasNamed: cwd !== undefined,
  });
}

/** The report as a structured payload, omitting the halves it does not have. */
export function projectReportPayload(report: ProjectReport): Record<string, unknown> {
  return {
    status: report.status,
    cwd: report.cwd,
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
