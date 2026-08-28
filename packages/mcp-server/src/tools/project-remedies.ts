import { COMMITTED_CONFIG_FILE } from '../committed-config.js';
import { ProjectRemedies, environmentRecordName } from '../project-report.js';

/**
 * The tool vocabulary for every remedy a project report can carry, shared by the reader
 * and the writer.
 *
 * Both tools answer the same question about the same directory — project_get before a
 * call, project_set after a write — so they have to name the same next step in the same
 * words. Two copies drifted the moment one was edited.
 */
// Named once: the remedies below read it as prose AND hand it to
// environmentRecordName, and two spellings of the same place would have the report
// name one environment and its remedy another.
const ENVIRONMENT_LOCATION = "the MCP server's own environment";

// The tool vocabulary for every remedy this report can carry.
//
// A caller reading these already holds an open connection to this server, so
// every fix is a tool call. The CLI subcommand answering the same question names
// runnable shell commands instead — see cli/project-command.ts — because its
// reader is a shell. Naming a command here would tell an agent to spawn a second
// copy of the server that just answered it.
export const TOOL_REMEDIES: ProjectRemedies = {
  setProject: (cwd) => [
    `Ask the user for the Project URL, then call project_set with projectUrl set to it and cwd set to ${cwd}.`,
    `To record it with the code instead — versioned in the repository and shared with everyone who clones it — write a committed ${COMMITTED_CONFIG_FILE} in the application's own folder holding {"projectUrl": "<url>"}. This server reads that file and never writes it.`,
  ],
  setBaseUrl: ({ cwd, projectUrlSource, projectUrl, committedFilePath }) => {
    // The deployment goes in the record that holds the project, so which remedy this
    // is depends on where that project is. Naming the mapping call for a project held
    // elsewhere named a call that fails — and a committed file is a record this
    // server reads and never writes, so its remedy is the edit, named file and key.
    if (projectUrlSource === 'mapping') {
      return [
        `Ask the user for the Base URL alone, then call project_set with baseUrl set to it and cwd set to ${cwd}. Leave projectUrl out: this directory's own record already holds ${projectUrl}.`,
      ];
    }
    if (projectUrlSource === 'committed') {
      return [
        `Ask the user for the Base URL alone, then add "baseUrl": "<their answer>" beside "projectUrl" in ${committedFilePath ?? `the committed ${COMMITTED_CONFIG_FILE}`} — the committed file that holds this project, versioned with the code, so everyone who clones the repository resolves the same pair. Edit that file directly: project_set writes only this machine's mapping, and a mapping under that file does not take effect.`,
      ];
    }
    return [
      `Ask the user for the Base URL alone, then call project_set with cwd set to ${cwd}, projectUrl set to ${projectUrl}, and baseUrl set to what they gave you. ${projectUrl} comes from ${environmentRecordName(ENVIRONMENT_LOCATION)}, which project_set cannot write, so the pair is recorded in this directory's mapping — which then governs it. You are not asking the user for the project: you already have it.`,
    ];
  },
  // Nothing to disclaim. The CLI has to warn that the server's own environment is
  // invisible from the shell it runs in; this answer comes from inside that
  // server, resolved exactly as the next tool call will resolve it.
  environmentCaveat: () => [],
  // And when a value DID come from the environment, it is that block it came
  // from — not the reader's shell, which has no such variable. Named "this
  // shell's environment" here, the report told an agent to go looking for a
  // FORMIO_PROJECT_URL that only the server's launch configuration holds.
  environmentLocation: ENVIRONMENT_LOCATION,
};
