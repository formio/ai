import path from 'path';
import { z } from 'zod';
import {
  BASE_URL_UNRESOLVED_GUIDANCE,
  FormioConfig,
  ResolvedFormioConfig,
  PROJECT_URL_GUIDANCE,
  normalizeHttpUrl,
  stripTrailingSlashes,
} from './config.js';
import {
  ProjectEntry,
  ProjectMapUnreadableError,
  projectMapPath,
  readProjectEntry,
} from './project-map.js';
import { projectCommand } from './cli-launch.js';
import {
  API_ROOT_NOT_A_PROJECT,
  ENTERPRISE_ONLY,
  API_ROOT_IS_NOT_YOUR_DEPLOYMENT,
  DEPLOYMENT_IS_DERIVED,
  HOSTED_CLOUD_DEPLOYMENT,
  NOT_A_HOSTED_PROJECT,
  PairValidity,
  classifyPair,
  deriveBaseUrl,
  faultedHalf,
} from './pair-rule.js';
import {
  COMMITTED_CONFIG_FILE,
  CommittedConfigUnusableError,
  CommittedProjectConfig,
  findCommittedConfig,
} from './committed-config.js';

const CWD_DESCRIPTION =
  "User's current working directory as an absolute path. Selects the Form.io project that directory resolves to, by scope, narrowest first: a committed formio.json found by walking up from it, then the working-directory mapping project_set writes, then FORMIO_PROJECT_URL in the environment, which is the weakest of the three. Pass it on EVERY call whenever you know it: omitting it resolves against the MCP server's own working directory, which is fixed at spawn and may resolve to a different project. No environment variable removes the need for it — the environment is the source a file or a mapping overrides, not the one that overrides them.";

// One schema for every client. Requiredness cannot live here: whether a cwd is
// needed depends on the environment the server was launched with, and this
// schema is built once at module load. resolveProjectConfig raises the error
// instead, where both the environment and the map are known.
export const cwdSchema = z
  .string()
  .min(1, 'cwd must not be empty')
  .refine((value) => path.isAbsolute(value), {
    message: 'cwd must be an absolute path',
  })
  .optional()
  .describe(CWD_DESCRIPTION);

// The only configuration guidance a stand-alone server can give for the value it
// is missing. It names the project URL alone: the base URL that will be needed
// depends on which project URL the user supplies, and requireBaseUrl raises the
// second half if and when that becomes real.
interface MissingProject {
  cwd: string | undefined;
  mapCwd: string;
  /** Deployments found with no project beside them, named so nothing is overwritten unseen. */
  unpaired: string[];
}

// The one throw that means "nothing is configured here" rather than "this could not be
// answered". Given a class so a reporting caller can catch exactly it: catching by
// exclusion turned every OTHER error — including ones added later — into a false
// "nothing configured", whose remedy is an interview that writes a record the real
// problem still shadows.
export class ProjectNotConfiguredError extends Error {
  /**
   * Values the resolver set aside on the way to "nothing is configured".
   *
   * A directory can hold a deployment with no project beside it — the shape an
   * earlier release wrote — and that record answers for nothing, so resolution ends
   * here. Reported so the caller can say what is there: the remedy for this status
   * REPLACES that entry, and a value overwritten without ever being named is a value
   * the user cannot get back or account for.
   */
  readonly unpaired: string[];

  constructor(message: string, unpaired: string[] = []) {
    super(message);
    this.name = 'ProjectNotConfiguredError';
    this.unpaired = unpaired;
  }
}

function missingProjectError({ cwd, mapCwd, unpaired }: MissingProject): ProjectNotConfiguredError {
  // Which directory was searched is the whole answer when no cwd was passed: the
  // server's own is not the user's, so "nothing is configured" without it sends
  // the caller to project_set, which writes a mapping the next cwd-passing call
  // will not find — and the loop repeats with the cause never named.
  const where = cwd
    ? ` for cwd=${cwd}`
    : ` for ${mapCwd}, the MCP server's own working directory, which is the only directory searched because no cwd argument was passed`;
  const how = cwd
    ? `project_set with cwd=${cwd} and the project URL`
    : "project_set with cwd set to the user's current working directory and the project URL — and pass that same cwd on every Form.io tool call";
  // Names the remedy in BOTH vocabularies, because the same string reaches an
  // agent holding MCP tools and a caller holding a shell, and neither can act on
  // the other's form. Carries the shape guidance for the same reason: no skill
  // document restates it any more, so an agent that never read the server's
  // instructions has this message and nothing else.
  //
  // Asks for the project URL ALONE. The base URL that will be needed depends on
  // the answer — a hosted-cloud project needs none, and a sub-directory one is
  // derived — so demanding both here presents a compound task and asks for a
  // value that is usually never required. requireBaseUrl raises the second half
  // if and when it becomes real.
  // Named in the message as well as carried structurally: this status's remedy
  // replaces the entry that strands it.
  const stranded = unpaired.length ? `${unpaired.join(' ')} ` : '';
  return new ProjectNotConfiguredError(
    `No Form.io project is configured${where}, and no ${COMMITTED_CONFIG_FILE} was found by walking up from it. ` +
      stranded +
      `Ask the user for their Project URL, then call ${how}, or run: ${projectCommand(`set --project-url <project_url> --cwd ${cwd ?? mapCwd}`)}. ` +
      `To record the target with the code instead — versioned, and shared with everyone who clones it — add a ${COMMITTED_CONFIG_FILE} holding {"projectUrl": "..."} in the application's own folder. ` +
      `${PROJECT_URL_GUIDANCE} FORMIO_PROJECT_URL in the server environment supplies one too, but it is the weakest source: a ${COMMITTED_CONFIG_FILE} or a mapping overrides it.`,
    // Carried structurally as well as in the prose: the reporting caller renders its
    // own message and would otherwise have to parse this one back out.
    unpaired
  );
}

// The base URL is required only to authenticate, so the demand for one is raised
// here rather than during resolution: an API-key deployment never reads the
// value, and failing its calls over a URL it does not use would break a working
// configuration. Callers on the auth path funnel their reads through this.
//
// Deliberately NOT the unset-project wording. The project URL is configured and
// correct; only its deployment is missing, so sending the agent to interview both
// URLs from scratch is the wrong remedy — and project_set's own base-URL fallback
// would then re-persist whatever the environment holds.
// The write that records a deployment beside the project, per record that project_set
// can write. A deployment belongs in the record that holds its project, so one command
// cannot answer for both — printed for an environment project, the mapping's own
// `--base-url` call is refused, and a refused remedy costs more than none. The
// committed file is not here at all: this server never writes one, so its remedy is an
// edit the caller makes to the file itself.
//
// Shared by every message that names this write: the report's two vocabularies and the
// authentication error below, which is raised nowhere near a report.
export function baseUrlWriteCommand({
  source,
  cwd,
  projectUrl,
}: {
  source: Exclude<ProjectUrlSource, 'committed'>;
  cwd: string;
  projectUrl: string;
}): string {
  if (source === 'mapping') {
    return projectCommand(`set --base-url <base_url> --cwd ${cwd}`);
  }
  return projectCommand(`set --project-url ${projectUrl} --base-url <base_url> --cwd ${cwd}`);
}

export function requireBaseUrl(config: ResolvedFormioConfig): string {
  if (config.baseUrl) {
    return config.baseUrl;
  }
  // Named for the record that holds this project, exactly as the report names it. One
  // command for every record is a command that fails for two of the three, and this
  // error reaches a caller who has no report in front of them.
  const cwd = config.cwd ?? process.cwd();
  const source = config.projectUrlSource ?? 'mapping';
  const write =
    source === 'mapping'
      ? `Set it with project_set (pass baseUrl alongside the cwd), or run: ${baseUrlWriteCommand({ source, cwd, projectUrl: config.projectUrl })}`
      : source === 'committed'
        ? `Record it beside the project, in the committed ${COMMITTED_CONFIG_FILE} that holds it: add "baseUrl": "<base_url>" beside "projectUrl" in ${config.committedFilePath ?? `that file`} — edit it directly; this server reads a committed file and never writes one, and a mapping written under it does not take effect`
        : `${config.projectUrl} comes from FORMIO_PROJECT_URL in the environment, which project_set cannot write, so record the pair for this directory: call project_set with cwd ${cwd}, projectUrl ${config.projectUrl} and that baseUrl, or run: ${baseUrlWriteCommand({ source, cwd, projectUrl: config.projectUrl })}`;
  throw new Error(
    `The Base URL for ${config.projectUrl} cannot be determined, so JWT authentication cannot proceed. ` +
      `${BASE_URL_UNRESOLVED_GUIDANCE} ` +
      `Guessing one would build the portal-login URL and key the cached token against a deployment you do not use. ` +
      `${write}. ` +
      `The project itself is configured — only its Base URL is missing, so do not ask the user for the Project URL again. ` +
      `An API key needs no Base URL and is unaffected.`
  );
}

// Where each half of the answer came from. Derived here because this is the only
// code that knows: a reader comparing the resolved value against the mapping
// cannot tell "the mapping supplied it" from "the mapping happened to hold the
// same string", and https://api.form.io is the value most likely to collide.
export type ProjectUrlSource = 'committed' | 'mapping' | 'environment';
export type BaseUrlSource = 'committed' | 'mapping' | 'environment' | 'derived' | 'unresolved';

export interface ProjectResolution {
  config: ResolvedFormioConfig;
  sources: {
    projectUrl: ProjectUrlSource;
    baseUrl: BaseUrlSource;
  };
  // The file that supplied a committed value, by path. Reported rather than
  // inferred because the upward walk means the governing file is usually not in
  // the directory the caller passed.
  committedFilePath?: string;
  // Every layer that COULD have supplied the project URL, whether or not it won.
  // A reporting caller needs the losers to say what was shadowed — without them,
  // "my project_set did nothing" has no answer in the output.
  candidates: {
    committed?: string;
    mapping?: string;
    environment?: string;
  };
  // The same losers for the base URL. Reported separately rather than folded into
  // `candidates` because a record can hold a deployment and no project — an entry an
  // earlier release wrote — so one shared list would have nothing to hang that value
  // on, and a reader asking "why is my recorded base URL not in effect?" would get no
  // answer. A losing record's deployment belongs to that record's project; it is
  // never paired with the winner's.
  baseUrlCandidates: {
    committed?: string;
    mapping?: string;
    environment?: string;
  };
}

// cacheDir is an injection seam, not a runtime knob: tool handlers always use
// the default location, while the bin's `project get` and the tests point at an
// isolated directory. onNote is the same idea for output — a caller that returns
// its whole outcome in a result object cannot have notes written to the process
// streams behind its back.
export interface ResolveProjectOptions {
  cacheDir?: string;
  onNote?: (message: string) => void;
}

interface MappedEntryRead {
  mapCwd: string;
  cacheDir?: string;
  tolerateUnreadable: boolean;
  onNote: (message: string) => void;
}

// An unreadable project map is a real problem the caller has to hear about —
// reporting it as "nothing configured" sends them to project_set, whose rewrite
// is what destroys the surviving mappings. But that is only true where the map
// is the source of the project. When a committed file names the project, an
// unreadable map cannot change the answer, so resolution continues rather than
// failing a call that never needed the file. The reason is still said out loud,
// because a broken map that nothing depends on today breaks every unpinned
// directory tomorrow.
//
// The VALUES in an entry are deliberately not validated here. A record's URLs are
// checked only where that record wins precedence — see validateWinningRecord —
// because an unusable value in a record that can never win must not fail a
// resolution it takes no part in.
function readMappedEntry({
  mapCwd,
  cacheDir,
  tolerateUnreadable,
  onNote,
}: MappedEntryRead): ProjectEntry | undefined {
  try {
    return readProjectEntry(mapCwd, cacheDir) ?? undefined;
  } catch (error) {
    if (!tolerateUnreadable || !(error instanceof ProjectMapUnreadableError)) {
      throw error;
    }
    // Its OWN sentence, not the fatal message. That one says "repair or delete that
    // file FIRST — nothing below will run until it is" and names a project_set write:
    // here nothing needs repairing for this answer to be right, that write cannot run
    // while the file is unreadable, and it would not take effect if it could, because
    // the committed file governs. A remedy that is impossible, ineffective, and aimed
    // at a record this report calls shadowed is worse than no remedy.
    onNote(
      `Ignoring the unreadable Form.io project map at ${error.filePath}: ${error.reason}. ` +
        `The committed ${COMMITTED_CONFIG_FILE} names the project for this directory and supplies the pair that resolves, so the map cannot change this answer and nothing needs repairing for it. ` +
        `Repair or remove that file when you next need a mapping for a directory this one does not govern.`
    );
    return undefined;
  }
}

// Which record a note or a refusal is about, by the name its reader can act on: a
// committed file by path (the upward walk means it is usually not the directory the
// caller named), the mapping by the directory it is keyed to, the environment by the
// variables themselves.
function recordName({
  source,
  mapCwd,
  committedFilePath,
}: {
  source: ProjectUrlSource;
  mapCwd: string;
  committedFilePath?: string;
}): string {
  if (source === 'committed') {
    return `the committed ${COMMITTED_CONFIG_FILE} at ${committedFilePath ?? '(unknown path)'}`;
  }
  if (source === 'mapping') {
    return `the mapping for ${mapCwd}`;
  }
  return 'FORMIO_BASE_URL in the environment';
}

interface WinningRecordCheck {
  source: ProjectUrlSource;
  record: { projectUrl: string; baseUrl?: string };
  mapCwd: string;
  cacheDir?: string;
  committedFilePath?: string;
  onNote: (message: string) => void;
}

// The record precedence picked, held to the pair rule at the point of USE. Both
// writers refuse an API-root project URL and a pair that collapses onto one server,
// but a hand-written formio.json, a hand-edited mapping entry, and the environment
// never pass through a writer — and the collapse is about the EFFECTIVE deployment,
// so a derived one (https://api.form.io derives itself) collapses exactly as a
// recorded one does.
//
// Returns undefined only for the environment, whose unusable pair is a suggestion to
// ignore with a note rather than configuration to fail on; the caller then falls
// through, and the environment is the last record, so what follows is the interview.
function validateWinningRecord({
  source,
  record,
  mapCwd,
  cacheDir,
  committedFilePath,
  onNote,
}: WinningRecordCheck):
  | { source: ProjectUrlSource; projectUrl: string; baseUrl?: string; derived?: string }
  | undefined {
  // The mapping is the one record whose URLs reach here unvalidated: committed values
  // are normalized by the file's own reader, and environment values by getConfig /
  // the CLI's own read. Reported as an unusable ENTRY, not as an unmapped directory:
  // the value is there and it is wrong, so answering "nothing is configured" sends
  // the caller to interview the user — hiding the cause the note names.
  const normalize = (value: string, key: string): string => {
    try {
      return normalizeHttpUrl(value, key);
    } catch (error) {
      throw new ProjectMapUnreadableError(
        projectMapPath(cacheDir),
        new Error(
          `the entry for ${mapCwd} holds an unusable ${key}: ${error instanceof Error ? error.message : String(error)}`
        ),
        mapCwd,
        'entry'
      );
    }
  };
  const projectUrl =
    source === 'mapping'
      ? normalize(record.projectUrl, 'FORMIO_PROJECT_URL')
      : stripTrailingSlashes(record.projectUrl);
  const recordBaseUrl =
    source === 'mapping' && record.baseUrl
      ? normalize(record.baseUrl, 'FORMIO_BASE_URL')
      : record.baseUrl && stripTrailingSlashes(record.baseUrl);

  const derived = deriveBaseUrl(projectUrl);
  const validity: PairValidity = classifyPair(projectUrl, recordBaseUrl || derived);
  if (validity === 'ok') {
    return {
      source,
      projectUrl,
      ...(recordBaseUrl ? { baseUrl: recordBaseUrl } : {}),
      ...(recordBaseUrl ? {} : derived ? { derived } : {}),
    };
  }

  // A deployment that cannot serve this project leaves a usable PROJECT behind, and
  // for a hosted-cloud project the right deployment is knowable — it is the derived
  // one — so the reader supplies it rather than failing every tool call over a value
  // it can work out itself. The writers refuse this pair at the point a user types
  // it; here it is already on disk or in the environment, so the answer is to set it
  // aside and say which value was ignored, in which record. Silent, the same stale
  // value goes on being invisible; fatal, a directory whose correct target is certain
  // stops working.
  if (faultedHalf(validity) === 'deployment') {
    onNote(
      `Ignoring the Base URL recorded in ${recordName({ source, mapCwd, committedFilePath })} (${recordBaseUrl}): ${
        validity === 'api-root-deployment'
          ? API_ROOT_IS_NOT_YOUR_DEPLOYMENT
          : validity === 'underivable-mismatch'
            ? DEPLOYMENT_IS_DERIVED
            : HOSTED_CLOUD_DEPLOYMENT
      }${
        derived
          ? ` Resolving ${projectUrl} on ${derived} instead.`
          : ` This project's deployment cannot be derived, so it is now unresolved and has to be supplied.`
      } Remove that value to stop this notice.`
    );
    return { source, projectUrl, ...(derived ? { derived } : {}) };
  }

  if (source === 'committed') {
    throw new CommittedConfigUnusableError(
      committedFilePath ?? COMMITTED_CONFIG_FILE,
      validity === 'not-a-hosted-project'
        ? `its projectUrl is ${projectUrl}, which is not a Form.io project URL. ${NOT_A_HOSTED_PROJECT}`
        : validity === 'not-a-project-url'
          ? `its projectUrl is ${projectUrl}, which is ${API_ROOT_NOT_A_PROJECT}`
          : `it records ${projectUrl} as both the projectUrl and the baseUrl. ${ENTERPRISE_ONLY}`
    );
  }
  if (source === 'mapping') {
    throw new ProjectMapUnreadableError(
      projectMapPath(cacheDir),
      new Error(
        validity === 'not-a-hosted-project'
          ? `the entry for ${mapCwd} records ${projectUrl} as FORMIO_PROJECT_URL, which is not a Form.io project URL. ${NOT_A_HOSTED_PROJECT}`
          : validity === 'not-a-project-url'
            ? `the entry for ${mapCwd} records ${projectUrl} as FORMIO_PROJECT_URL, which is ${API_ROOT_NOT_A_PROJECT}`
            : `the entry for ${mapCwd} records ${projectUrl} as both FORMIO_PROJECT_URL and FORMIO_BASE_URL. ${ENTERPRISE_ONLY}`
      ),
      mapCwd,
      'entry'
    );
  }
  // Names every variable the record loses, not just the offending one: the whole
  // record is discarded, so a FORMIO_BASE_URL set beside a rejected project URL is
  // discarded with it and would otherwise be reported nowhere at all.
  onNote(
    validity === 'not-a-hosted-project'
      ? `Ignoring FORMIO_PROJECT_URL (${projectUrl}): it is not a Form.io project URL. ${NOT_A_HOSTED_PROJECT}`
      : validity === 'not-a-project-url'
        ? `Ignoring FORMIO_PROJECT_URL (${projectUrl}): it is ${API_ROOT_NOT_A_PROJECT}${
            recordBaseUrl
              ? ` FORMIO_BASE_URL (${recordBaseUrl}) is part of the same record and is ignored with it.`
              : ''
          }`
        : `Ignoring FORMIO_PROJECT_URL and FORMIO_BASE_URL: both name ${projectUrl}, which makes the project its own deployment. ${ENTERPRISE_ONLY}`
  );
  return undefined;
}

// What every tool handler needs. `project get` needs the provenance too, and
// takes resolveProject below.
export function resolveProjectConfig(
  cwd: string | undefined,
  baseConfig: FormioConfig,
  options: ResolveProjectOptions = {}
): ResolvedFormioConfig {
  return resolveProject(cwd, baseConfig, options).config;
}

// Precedence, by SCOPE and narrowest first: the nearest committed formio.json,
// then the per-cwd mapping, then FORMIO_PROJECT_URL from the environment, then an
// actionable error. The environment is the WEAKEST source on purpose — a
// deployment that must target one project deterministically supplies only the
// source it wants used, rather than relying on a variable to outrank the file
// sitting next to the code. Precedence stays defined here for every caller.
export function resolveProject(
  cwd: string | undefined,
  baseConfig: FormioConfig,
  {
    cacheDir,
    onNote = (message) => process.stderr.write(`${message}\n`),
  }: ResolveProjectOptions = {}
): ProjectResolution {
  if (cwd && !path.isAbsolute(cwd)) {
    throw new Error(`cwd must be an absolute path (received: ${cwd}).`);
  }

  const envProjectUrl = baseConfig.projectUrl;
  // The same key project_set writes under. A client that cannot supply a cwd
  // gets the server's own process cwd on the write side, so reading only when a
  // cwd was passed produced a mapping that reported success and could never be
  // read back.
  const mapCwd = cwd || process.cwd();

  // Ordered narrowest-scope-first, and read unconditionally rather than only
  // where they can change the answer: with the committed file outranking both
  // other sources, a pin no longer short-circuits the lookup.
  //
  // A broken committed file throws out of here on purpose. It is not an absent
  // file, and answering "nothing configured" would send the caller to project_set
  // to write a mapping this file then shadows.
  const committed: CommittedProjectConfig | undefined = findCommittedConfig(mapCwd, { onNote });
  // An unreadable map is tolerated exactly where it cannot change the answer, which
  // under the pairing rule is wherever a committed file names a project: precedence
  // picks one WHOLE record, so a committed project takes its deployment from its own
  // file or from derivation and never consults the map. Asking for both halves was the
  // pre-pairing question, and it failed every call for the shape the docs recommend
  // most — a committed file naming a project whose deployment derives.
  //
  // The reason is still said out loud, because a broken map that nothing depends on
  // today breaks every unpinned directory tomorrow.
  const committedIsComplete = Boolean(committed?.projectUrl);
  const mappedEntry = readMappedEntry({
    mapCwd,
    cacheDir,
    tolerateUnreadable: committedIsComplete,
    onNote,
  });
  const mappedEnv = mappedEntry?.env;

  // One record supplies BOTH halves. Precedence picks the record, narrowest scope
  // first; the base URL is that record's own, or derived from that record's project
  // URL when it names none.
  //
  // Halves are never combined across records. A base URL in a losing record belongs to
  // that record's project, and pairing it with a winning record's project is what made
  // "which project is this deployment for?" a question at read time — a question that
  // needed a stored pairing to answer and produced, across three reviews, a deployment
  // carried onto the wrong project, a writer reporting a value the reader refused, and
  // a remedy that looped. Keeping each record whole removes the question.
  //
  // Falsy, not nullish: an empty FORMIO_PROJECT_URL is an unanswered prompt, not a
  // pinned project.
  const records: ReadonlyArray<
    readonly [ProjectUrlSource, { projectUrl?: string; baseUrl?: string }]
  > = [
    ['committed', { projectUrl: committed?.projectUrl, baseUrl: committed?.baseUrl }],
    ['mapping', { projectUrl: mappedEnv?.FORMIO_PROJECT_URL, baseUrl: mappedEnv?.FORMIO_BASE_URL }],
    ['environment', { projectUrl: envProjectUrl || undefined, baseUrl: baseConfig.baseUrl }],
  ];
  // Validity is asked only of the record that WINS, in that record's own repair
  // vocabulary. A committed file or a mapping entry holding a pair the writers refuse
  // is configuration that exists and cannot be honoured, so it fails loudly, naming
  // the record — falling through would silently target whatever weaker source is
  // around, which for these two records is exactly the wrong-project failure the
  // precedence order exists to prevent. The environment is different in kind: it is a
  // suggestion, read tolerantly everywhere else, so an unusable pair there is ignored
  // with a note and resolution falls through to the interview.
  let winner:
    | { source: ProjectUrlSource; projectUrl: string; baseUrl?: string; derived?: string }
    | undefined;
  for (const [source, record] of records) {
    if (!record.projectUrl) {
      continue;
    }
    const validated = validateWinningRecord({
      source,
      record: record as { projectUrl: string; baseUrl?: string },
      mapCwd,
      cacheDir,
      committedFilePath: committed?.filePath,
      onNote,
    });
    if (validated) {
      winner = validated;
      break;
    }
  }
  if (!winner) {
    throw missingProjectError({
      cwd: cwd || undefined,
      mapCwd,
      // Each value carries its own consequence. A blanket "the write below replaces
      // that entry" was appended to the joined list, which is true of the mapping and
      // false of the environment — a variable no write can touch, reported as
      // replaced and then reported again, unchanged, forever.
      unpaired: [
        ...(mappedEnv?.FORMIO_BASE_URL
          ? [
              `${mapCwd} has ${mappedEnv.FORMIO_BASE_URL} mapped as a deployment with no project beside it, so nothing says which project it serves. Recording a project for this directory replaces that entry.`,
            ]
          : []),
        ...(baseConfig.baseUrl
          ? [
              `FORMIO_BASE_URL in the environment names ${baseConfig.baseUrl} with no usable FORMIO_PROJECT_URL beside it, so nothing says which project it serves. No write can change an environment variable: unset it, or set FORMIO_PROJECT_URL beside it, to stop this notice.`,
            ]
          : []),
      ],
    });
  }
  const { source: projectUrlSource, projectUrl: normalizedProjectUrl } = winner;

  // Said out loud for the same reason project_set warns on the write side: the
  // server's process cwd is fixed at spawn and, for a plugin- or desktop-launched
  // server, is not where the user is.
  if (!cwd && projectUrlSource !== 'environment') {
    onNote(
      `No cwd argument was passed, so the project was resolved from ${mapCwd}, the MCP server's own working directory. Pass cwd on every Form.io tool call to target the user's directory.`
    );
  }

  const baseUrl = winner.baseUrl ?? winner.derived;
  const baseUrlSource: BaseUrlSource = winner.baseUrl
    ? projectUrlSource
    : winner.derived
      ? 'derived'
      : 'unresolved';

  return {
    config: {
      ...baseConfig,
      baseUrl: baseUrl && stripTrailingSlashes(baseUrl),
      projectUrl: normalizedProjectUrl,
      cwd: mapCwd,
      projectUrlSource,
      ...(projectUrlSource === 'committed' && committed?.filePath
        ? { committedFilePath: committed.filePath }
        : {}),
    },
    sources: {
      projectUrl: projectUrlSource,
      baseUrl: baseUrlSource,
    },
    ...(committed?.filePath ? { committedFilePath: committed.filePath } : {}),
    candidates: {
      ...(committed?.projectUrl ? { committed: committed.projectUrl } : {}),
      ...(mappedEnv?.FORMIO_PROJECT_URL ? { mapping: mappedEnv.FORMIO_PROJECT_URL } : {}),
      ...(envProjectUrl ? { environment: envProjectUrl } : {}),
    },
    baseUrlCandidates: {
      ...(committed?.baseUrl ? { committed: committed.baseUrl } : {}),
      ...(mappedEnv?.FORMIO_BASE_URL ? { mapping: mappedEnv.FORMIO_BASE_URL } : {}),
      ...(baseConfig.baseUrl ? { environment: baseConfig.baseUrl } : {}),
    },
  };
}
