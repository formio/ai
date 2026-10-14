import { reportProject } from '../project-report.js';
import { resolveProjectConfig } from '../project-resolver.js';
import { guessedDirectory, isNamedDirectory, workspaceDirectory, } from '../workspace-directory.js';
import { TOOL_REMEDIES } from './project-remedies.js';
/**
 * The directory a tool call resolves against: the caller's cwd, else the client's
 * workspace root, else CLAUDE_PROJECT_DIR, else the server's own directory.
 */
export function toolDirectory({ server, cwd, serverCwd, }) {
    return workspaceDirectory(server).resolve({ cwd, serverCwd });
}
/** The project a project-scoped tool targets, for the directory its call resolves against. */
export async function resolveToolConfig({ server, cwd, config, }) {
    const directory = await toolDirectory({ server, cwd });
    return resolveProjectConfig(directory.dir, config, {
        cwdWasNamed: isNamedDirectory(directory),
        guessedDirectory: guessedDirectory(directory),
    });
}
/**
 * The resolution a tool reports for a caller's directory — the one answer
 * project_get and server_status both give, from the resolver every other tool uses.
 */
export function reportProjectForTool({ directory, config, notes, }) {
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
export function projectReportPayload(report, directory) {
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
export function projectReportText(report) {
    return [...report.notes, report.message].filter(Boolean).join('\n');
}
