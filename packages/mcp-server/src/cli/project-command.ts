import path from 'path';
import { InvalidRequestedUrlError, readHttpUrlEnv } from '../config.js';
import { COMMITTED_CONFIG_FILE, findCommittedConfig } from '../committed-config.js';
import {
  readProjectEntryForWrite,
  unusableRecordProjectUrl,
  writeProjectEntry,
} from '../project-map.js';
import { planProjectEntry } from '../project-entry-plan.js';
import {
  API_ROOT_IS_NOT_YOUR_DEPLOYMENT,
  DEPLOYMENT_IS_DERIVED,
  NOT_A_HOSTED_PROJECT,
  API_ROOT_NOT_A_PROJECT,
  ENTERPRISE_ONLY,
  HOSTED_CLOUD_DEPLOYMENT,
} from '../pair-rule.js';
import {
  BASE_URL_UNDERIVABLE,
  COMMITTED_IS_HAND_AUTHORED,
  strandedBaseUrlClause,
} from '../write-refusals.js';
import {
  BASE_URL_NOT_DETERMINED,
  ProjectRemedies,
  environmentRecordName,
  reportProject,
} from '../project-report.js';
import { PROJECT_CLI, projectCommand } from '../cli-launch.js';

export interface ProjectCommandOptions {
  cacheDir?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface ProjectCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// Four outcomes, four codes. "Nothing is mapped for this directory" is an
// answer to the question asked; "this command could not run" is not, and a
// caller that cannot tell them apart interviews the user and then calls
// project_set, which fails again for the same unreported reason. Documented for
// the skills, which branch on the code rather than on a substring of the
// message.
//
// EXIT_BASE_URL_UNRESOLVED is the half-configured answer, and it needs its own
// code precisely because the skills branch on these. It used to report as a 2 —
// the code every preflight answers by relaying and stopping — so the one
// deployment shape this whole surface exists to serve, a path-less project URL on
// a customer domain, dead-ended on guidance written for an unreadable file. It is
// not a 1 either: a 1 asks for the project, and this directory already has one.
export const EXIT_OK = 0;
export const EXIT_NOT_CONFIGURED = 1;
export const EXIT_FAILED = 2;
export const EXIT_BASE_URL_UNRESOLVED = 3;

// Spelled the way the documented install route can actually run it. `formio-mcp`
// is this package's bin and nothing puts it on PATH — the plugin and every skill
// launch the server through npx — so a usage line naming the bare bin printed a
// command that answers `command not found`.
const USAGE = [
  'Usage:',
  `  ${PROJECT_CLI} set [--project-url <url>] [--base-url <url>] [--cwd <absolute path>]`,
  `  ${PROJECT_CLI} get [--cwd <absolute path>]`,
  '',
  `set writes the machine-local mapping in ~/.formio/projects.json. To record the project`,
  `with the code instead — versioned, and shared with everyone who clones it — write a`,
  `committed ${COMMITTED_CONFIG_FILE} in the application's own folder: a JSON object holding`,
  `{"projectUrl": "..."}, plus "baseUrl" only when it cannot be derived. This command`,
  `reads that file and never writes it.`,
].join('\n');

// The environment, the working directory, and the cache directory are all
// injected rather than read at the point of use, so every case is testable
// without touching the real ~/.formio or the real process environment.
interface CommandContext {
  env: NodeJS.ProcessEnv;
  cwd: string;
  cacheDir?: string;
  /**
   * Owned by runProjectCommand rather than by the subcommand, so a note survives a
   * THROW.
   *
   * A note is usually the CAUSE of the failure printed beside it — a formio.json passed
   * over unread, a FORMIO_PROJECT_URL discarded — and collected inside the subcommand it
   * reached the caller only on that subcommand's own return paths. Every throw printed
   * the failure alone, which is the run where the explanation matters most.
   */
  notes: string[];
}

export function isProjectCommand(args: string[]): boolean {
  return args[0] === 'project';
}

// Only KNOWN `--flag value` pairs are recognized; anything else is a usage error
// rather than a silently ignored token. An unknown flag must fail, not fall away:
// a caller passing a flag this command no longer takes — `--scope repo`, from a
// release that had a committed-file writer — would otherwise have its write land
// in a record it did not choose, and be told it succeeded.
function parseFlags(args: string[], known: ReadonlyArray<string>): Record<string, string> {
  return args.reduce<Record<string, string>>((flags, token, index) => {
    if (!token.startsWith('--')) {
      const flagBefore = args[index - 1];
      if (flagBefore?.startsWith('--') && known.includes(flagBefore.slice(2))) {
        return flags;
      }
      throw new Error(`Unexpected argument: ${token}`);
    }
    if (!known.includes(token.slice(2))) {
      throw new Error(`Unknown flag: ${token}\n\n${USAGE}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${token} requires a value.`);
    }
    return { ...flags, [token.slice(2)]: value };
  }, {});
}

function resolveCwd(flag: string | undefined, fallback: string): string {
  const value = flag ?? fallback;
  if (!path.isAbsolute(value)) {
    throw new Error(`--cwd must be an absolute path (received: ${value}).`);
  }
  return value;
}

// Notes travel in the result like everything else. Writing them straight to
// process.stderr would leave the one part of this command's outcome that no
// caller and no test can see — and this module injects env, cwd and cacheDir
// precisely so every outcome is observable from the returned object.
function ok(stdout: string, notes: readonly string[] = []): ProjectCommandResult {
  return { exitCode: EXIT_OK, stdout, stderr: notes.join('\n') };
}

// The command ran and the answer is "nothing here" — the one non-zero outcome a
// caller should respond to by interviewing the user.
//
// Notes collected on the way here belong in it, for the same reason
// baseUrlUnresolved keeps them: an "Ignoring FORMIO_PROJECT_URL: ..." note is
// often the CAUSE of this branch — a host that never expanded its manifest
// variable — and dropping it left the user reading "nothing is configured" about
// a directory whose configuration had just been discarded unread.
function notConfigured(stderr: string, notes: readonly string[] = []): ProjectCommandResult {
  return {
    exitCode: EXIT_NOT_CONFIGURED,
    stdout: '',
    stderr: [...notes, stderr].filter(Boolean).join('\n'),
  };
}

// The project resolved and its deployment did not. One named value is missing and
// the message names the command that records it, so this is an answer a caller
// acts on — which is what separates it from EXIT_FAILED.
//
// Notes collected on the way here belong in it. An "Ignoring FORMIO_BASE_URL: ..."
// note is the CAUSE of this branch, so dropping it hid the explanation of the very
// state being reported.
function baseUrlUnresolved(stderr: string, notes: readonly string[]): ProjectCommandResult {
  return {
    exitCode: EXIT_BASE_URL_UNRESOLVED,
    stdout: '',
    stderr: [...notes, stderr].filter(Boolean).join('\n'),
  };
}

// The command could not answer: a usage error, a malformed URL, a relative
// --cwd, an unreadable map. Interviewing on this hides the cause and repeats the
// failure through project_set.
//
// Notes travel with it for the same reason the other two outcomes keep them: an
// "Ignoring FORMIO_PROJECT_URL: ..." note is the CAUSE of the required-project
// failure below — a host that never expanded its manifest variable — so dropping
// it here printed "no project mapped yet" about a directory whose project had
// just been discarded unread.
function fail(stderr: string, notes: readonly string[] = []): ProjectCommandResult {
  return {
    exitCode: EXIT_FAILED,
    stdout: '',
    stderr: [...notes, stderr].filter(Boolean).join('\n'),
  };
}

function runSet(flags: Record<string, string>, context: CommandContext): ProjectCommandResult {
  if (!flags['project-url'] && !flags['base-url']) {
    return fail(`Pass at least one of --project-url or --base-url.\n\n${USAGE}`);
  }

  const cwd = resolveCwd(flags.cwd, context.cwd);

  const notes = context.notes;
  const onIgnored = (message: string) => notes.push(message);
  const mapped = readProjectEntryForWrite(cwd, context.cacheDir);
  // See project_set: an entry that EXISTS and cannot be honoured is not an absent one,
  // and treating it as absent made this command diagnose the environment as holding a
  // project this directory's own record governs.
  const unusableEntry = unusableRecordProjectUrl(mapped, cwd);
  // Walked ONCE, for both the plan and the note below. A file too broken to read
  // throws out of here into runProjectCommand's catch, which is right: that is a
  // command that could not answer, not a directory with no project.
  const committed = findCommittedConfig(cwd, { onNote: onIgnored });
  const plan = planProjectEntry({
    cwd,
    requested: { projectUrl: flags['project-url'], baseUrl: flags['base-url'] },
    record: {
      projectUrl: mapped.status === 'usable' ? mapped.entry.env.FORMIO_PROJECT_URL : undefined,
      baseUrl: mapped.status === 'usable' ? mapped.entry.env.FORMIO_BASE_URL : undefined,
    },
    elsewhere: {
      // Where the project lives when this mapping has none. A file too broken to read
      // throws out of here into runProjectCommand's catch, which is right: that is a
      // command that could not answer, not a directory with no project.
      committed,
      // Read tolerantly — an unusable value is not a project, and failing here would
      // block the call that records a usable one.
      environment: readHttpUrlEnv({
        raw: context.env.FORMIO_PROJECT_URL,
        name: 'FORMIO_PROJECT_URL',
        onIgnored,
      }),
    },
  });

  // Only where the mapping is the record that WOULD govern. A committed formio.json
  // outranks it, so a broken entry beneath one decides nothing — and naming the
  // mapping as "the record that governs this directory" there is the same
  // wrong-record diagnosis this guard exists to stop, one layer up. The plan's own
  // wrong-record branch answers that case, in the committed file's vocabulary.
  if (unusableEntry !== undefined && !flags['project-url'] && !committed?.projectUrl) {
    return notConfigured(
      `The mapping for ${cwd} holds an unusable value, so it is the record that governs this directory and it cannot answer with a project: ${unusableEntry} Nothing else supplies the project while that entry is on record. Run: ${projectCommand(`set --project-url <project_url> --cwd ${cwd}`)}\n\n${USAGE}`,
      notes
    );
  }

  if (plan.outcome === 'no-values') {
    return fail(`Pass at least one of --project-url or --base-url.\n\n${USAGE}`, notes);
  }
  // Exit 1, not 2. A named value is missing and the message says which — the same
  // answer `project get` gives for an unconfigured directory, and callers branch on the
  // code: 1 means act on this message, 2 means relay it and stop. Reporting a missing
  // value as 2 told every skill to abandon the step it was in the middle of.
  if (plan.outcome === 'project-required') {
    return notConfigured(
      `--project-url is required for ${cwd}, which has no project mapped yet.\n\n${USAGE}`,
      notes
    );
  }
  // A record holds a project and its deployment together, so the one project URL that
  // names no deployment cannot be recorded alone.
  if (plan.outcome === 'base-url-required') {
    return notConfigured(
      `--base-url is required alongside ${plan.projectUrl}: ${BASE_URL_UNDERIVABLE}.${strandedBaseUrlClause(plan)} Ask the user for it and run: ${projectCommand(`set --project-url ${plan.projectUrl} --base-url <base_url> --cwd ${cwd}`)}\n\n${USAGE}`,
      notes
    );
  }
  // The deployment goes where the project is. Writing it into the mapping while the
  // project lives elsewhere would split one configuration across two records. The
  // committed file is a record this command reads and never writes, so the remedy
  // there is the edit, named file and key.
  if (plan.outcome === 'wrong-record') {
    return notConfigured(
      plan.record === 'committed'
        ? `${plan.projectUrl} is recorded in the committed ${COMMITTED_CONFIG_FILE} at ${plan.filePath}, not in this directory's mapping, so a base URL alone has no project to be recorded beside. Add "baseUrl": "${flags['base-url']}" beside "projectUrl" in that file — ${COMMITTED_IS_HAND_AUTHORED}.\n\n${USAGE}`
        : `${plan.projectUrl} is recorded in FORMIO_PROJECT_URL in the environment, not in this directory's mapping, so a base URL alone has no project to be recorded beside. Record the pair where the project is: ${projectCommand(
            `set --project-url ${plan.projectUrl} --base-url ${flags['base-url']} --cwd ${cwd}`
          )}\n\n${USAGE}`,
      notes
    );
  }

  // Not a shape this toolset serves. Refused before anything is written, because the
  // failure it prevents is a string of unexplained 404s much later. Exit 1, like every
  // refusal that names the value it needs: the caller is mid-interview, and the remedy
  // is to ask the user which project and run this command again.
  if (plan.outcome === 'not-a-hosted-project') {
    return notConfigured(
      `${plan.url} is not a Form.io project URL. ${NOT_A_HOSTED_PROJECT}`,
      notes
    );
  }
  if (plan.outcome === 'not-a-project-url') {
    return notConfigured(`${plan.url} is ${API_ROOT_NOT_A_PROJECT}`, notes);
  }
  // Refused at the point a user typed it. The reader, meeting the same pair already on
  // disk, uses the derived deployment instead and says which value it set aside.
  if (plan.outcome === 'underivable-mismatch') {
    return notConfigured(
      `${plan.baseUrl} is not the deployment for ${plan.projectUrl}. ${DEPLOYMENT_IS_DERIVED} Run: ${projectCommand(`set --project-url ${plan.projectUrl} --cwd ${cwd}`)}\n\n${USAGE}`,
      notes
    );
  }
  if (plan.outcome === 'api-root-deployment') {
    return notConfigured(
      `${plan.baseUrl} is not the deployment for ${plan.projectUrl}. ${API_ROOT_IS_NOT_YOUR_DEPLOYMENT}\n\n${USAGE}`,
      notes
    );
  }
  if (plan.outcome === 'hosted-project-foreign-deployment') {
    return notConfigured(
      `${plan.baseUrl} is not the deployment for ${plan.projectUrl}. ${HOSTED_CLOUD_DEPLOYMENT} Run: ${projectCommand(`set --project-url ${plan.projectUrl} --cwd ${cwd}`)}\n\n${USAGE}`,
      notes
    );
  }
  // Exit 1 for the same reason: this is the user typing the wrong URL back, and the
  // remedy is to re-ask — reporting it as 2 told every caller to relay and stop, which
  // abandoned the very interview the refusal exists to redirect.
  if (plan.outcome === 'open-source-deployment') {
    return notConfigured(
      `${plan.url} is both the Project URL and the Base URL. ${ENTERPRISE_ONLY}`,
      notes
    );
  }

  if (plan.outcome === 'write') {
    writeProjectEntry({ cwd, env: plan.entry.env, cacheDir: context.cacheDir });
  }

  // A committed file GOVERNS this directory, whether or not it names the same project:
  // it supplies the pair that resolves, so a mapping written under one is the fallback
  // if it goes away and not what takes effect now. Silence here reads as "your project
  // is now X".
  const shadowedByCommitted = committed?.projectUrl;

  // What resolves is ASKED OF THE READER — the same reportProject that answers
  // `project get`, over the state this write just produced. Printed from the plan
  // instead, this command exited 0 naming a Base URL that the very next `project get`
  // reported as "could not be determined": the two halves of one tool disagreeing about
  // one directory, in the channel a user reads.
  const settled = reportProject({
    cwd,
    baseConfig: {
      projectUrl: readHttpUrlEnv({
        raw: context.env.FORMIO_PROJECT_URL,
        name: 'FORMIO_PROJECT_URL',
      }),
    },
    cacheDir: context.cacheDir,
    remedies: CLI_REMEDIES,
    notes,
  });
  // Emitted twice — once on this command's own walk and once on the report's — and a
  // user told twice that the same file was passed over reads it as two files.
  const deduped = notes.filter((note, index) => notes.indexOf(note) === index);
  notes.length = 0;
  notes.push(...deduped);

  const block = [
    plan.outcome === 'unchanged'
      ? `No change for ${cwd}`
      : // A record that does not take effect is described as RECORDED, never as set.
        shadowedByCommitted
        ? `Recorded for ${cwd}`
        : plan.setAProject
          ? `Project set for ${cwd}`
          : `Base URL set for ${cwd}`,
    // The stale value is gone, and silence about it would leave the user thinking
    // their recorded deployment survived this write.
    ...(plan.droppedBaseUrl
      ? [
          `Replaced ${plan.droppedBaseUrl}, which was recorded as this project's deployment and cannot serve it.`,
        ]
      : []),
    `Project URL: ${settled.projectUrl}`,
    `Base URL:    ${settled.baseUrl ?? BASE_URL_NOT_DETERMINED}`,
    // A committed file governs this directory whether or not it names the same project,
    // so a mapping write under one does not take effect — the pair the resolver
    // reports comes from that file, not from what was just written. Said for every
    // such write, because a caller cannot be left to discover it from a later report,
    // and said whether or not this call changed anything.
    ...(shadowedByCommitted
      ? [
          ``,
          shadowedByCommitted !== plan.projectUrl
            ? `Note: the committed ${COMMITTED_CONFIG_FILE} names ${shadowedByCommitted}, which outranks this directory's mapping (${plan.projectUrl}). ${shadowedByCommitted} is the active project until that file changes; what was recorded here is the fallback if it goes away.`
            : `Note: the committed ${COMMITTED_CONFIG_FILE} governs this directory, so it supplies the pair that resolves — this mapping does not take effect while that file is there, and is the fallback if it goes away. To change what resolves, edit that file directly; this command reads a committed file and never writes one.`,
        ]
      : []),
  ].join('\n');

  // The write landed and the directory still cannot serve a call: the committed file
  // that governs it supplies no deployment, and nothing this command can write will.
  // Exit 0 sent the caller onward, so `project set` succeeded and the very next
  // `project get` reported the same directory as unserviceable. 3 is the code that
  // already means exactly this — the project resolved and its deployment did not — and
  // it is the only non-ok status reachable here, since the write itself put a project
  // on record. The block above still prints: the record is half the answer, and the
  // reader's message, which names the file and the key to edit, is the other half.
  if (settled.status !== 'ok') {
    return {
      exitCode: EXIT_BASE_URL_UNRESOLVED,
      stdout: block,
      stderr: [...notes, settled.message].filter(Boolean).join('\n'),
    };
  }

  return ok(block, notes);
}

// Named once, for the same reason the tool names its own: the remedies read it
// as prose and hand it to environmentRecordName.
const ENVIRONMENT_LOCATION = 'this shell’s environment';

// The CLI vocabulary for every remedy this report can carry: runnable commands,
// because the reader is a shell. The tool that answers the same question from
// inside the server names `project_set` instead — see tools/project_get.ts.
const CLI_REMEDIES: ProjectRemedies = {
  setProject: (cwd) => [
    `Run: ${projectCommand(`set --project-url <url> --cwd ${cwd}`)}`,
    `Or record it with the code, versioned and shared with everyone who clones the repository: write a committed ${COMMITTED_CONFIG_FILE} in the application's own folder holding {"projectUrl": "<url>"} — this command reads that file and never writes it.`,
  ],
  setBaseUrl: ({ cwd, projectUrlSource, projectUrl, committedFilePath }) => {
    // The deployment goes in the record that holds the project, so which remedy this
    // is depends on where that project is. Printing the mapping's command for a
    // project held elsewhere named a call that fails — and a committed file is a
    // record this command reads and never writes, so its remedy is the edit, named
    // file and key.
    if (projectUrlSource === 'mapping') {
      return [
        `Run: ${projectCommand(`set --base-url <base_url> --cwd ${cwd}`)}`,
        `That updates this directory's own record, which already holds ${projectUrl}.`,
      ];
    }
    if (projectUrlSource === 'committed') {
      return [
        `Add "baseUrl": "<base_url>" beside "projectUrl" in ${committedFilePath ?? `the committed ${COMMITTED_CONFIG_FILE}`} — the committed file that holds this project, versioned with the code, so everyone who clones the repository resolves the same pair. Edit it directly: this command reads a committed file and never writes one, and a mapping written under it does not take effect.`,
      ];
    }
    return [
      `Run: ${projectCommand(`set --project-url ${projectUrl} --base-url <base_url> --cwd ${cwd}`)}`,
      `${projectUrl} comes from ${environmentRecordName(ENVIRONMENT_LOCATION)}, which this command cannot write, so the pair is recorded in this directory's mapping — which then governs it.`,
    ];
  },
  // This command runs in the caller's shell, not in the MCP server's process. A
  // plugin- or bundle-launched server carries its own env block, so what it
  // resolves can differ from what is printed here — and the difference is
  // invisible from this side. Say so rather than let the output be read as the
  // server's answer.
  environmentCaveat: () => [
    `Note:        the MCP server’s own environment is not visible from this shell, so a FORMIO_PROJECT_URL or FORMIO_BASE_URL set there is not listed above. Neither can override this mapping — the environment is the weakest source — so what resolves here is what the server resolves.`,
  ],
  // This reader's own variables, which is why it can be told to look at them.
  environmentLocation: ENVIRONMENT_LOCATION,
};

function runGet(flags: Record<string, string>, context: CommandContext): ProjectCommandResult {
  const cwd = resolveCwd(flags.cwd, context.cwd);
  // Read exactly as getConfig reads it, or this command answers a question about
  // a server that does not exist: the server drops an unusable FORMIO_PROJECT_URL
  // and resolves from the mapping, so printing the literal here and naming the
  // environment as the winning source contradicts what the next tool call does.
  // The whole point of `project get` is to report what resolves and which source
  // won, so the two readings must not diverge.
  const notes = context.notes;
  const onIgnored = (message: string) => notes.push(message);
  const envProjectUrl = readHttpUrlEnv({
    raw: context.env.FORMIO_PROJECT_URL,
    name: 'FORMIO_PROJECT_URL',
    onIgnored,
  });
  const envBaseUrl = readHttpUrlEnv({
    raw: context.env.FORMIO_BASE_URL,
    name: 'FORMIO_BASE_URL',
    onIgnored,
  });

  // Caught here rather than in runProjectCommand's catch, which cannot see the notes
  // this function collected. A could-not-answer failure keeps them for the same
  // reason the other three outcomes do: an "Ignoring FORMIO_PROJECT_URL: ..." note is
  // often the CAUSE, and a launch whose host never expanded that variable is exactly
  // the one likely to also have an unreadable map — reported alone, the second
  // problem hid the first.
  let report;
  try {
    report = reportProject({
      cwd,
      baseConfig: { baseUrl: envBaseUrl, projectUrl: envProjectUrl },
      cacheDir: context.cacheDir,
      remedies: CLI_REMEDIES,
      notes,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error), notes);
  }

  if (report.status === 'not-configured') {
    return notConfigured(report.message, report.notes);
  }
  if (report.status === 'base-url-unresolved') {
    return baseUrlUnresolved(report.message, report.notes);
  }
  return ok(report.message, report.notes);
}

export function runProjectCommand(
  args: string[],
  options: ProjectCommandOptions = {}
): ProjectCommandResult {
  const notes: string[] = [];
  const context: CommandContext = {
    env: options.env ?? process.env,
    cwd: options.cwd ?? process.cwd(),
    cacheDir: options.cacheDir,
    notes,
  };
  const subcommand = args[1];

  try {
    if (subcommand === 'set') {
      return runSet(parseFlags(args.slice(2), ['project-url', 'base-url', 'cwd']), context);
    }
    if (subcommand === 'get') {
      return runGet(parseFlags(args.slice(2), ['cwd']), context);
    }
    return fail(`Unknown project subcommand: ${subcommand ?? '(none)'}\n\n${USAGE}`);
  } catch (error) {
    // A URL the caller typed wrong is an answer to act on: ask the user again. It is
    // the same situation as the API-root and Open Source refusals, which are exit 1
    // for exactly this reason — reporting it as 2 tells every caller to relay and
    // stop, abandoning the round that was about to supply the right value.
    if (error instanceof InvalidRequestedUrlError) {
      return notConfigured(
        `${error.message}. Ask the user for the URL again and run the command with the corrected value.\n\n${USAGE}`,
        notes
      );
    }
    // Everything else that throws is a failure to answer, never an answer of
    // "nothing is mapped": an unreadable map, a relative --cwd, a malformed
    // stored URL. EXIT_FAILED keeps them out of the interview path.
    return fail(error instanceof Error ? error.message : String(error), notes);
  }
}
