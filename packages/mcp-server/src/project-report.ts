import { COMMITTED_CONFIG_FILE } from './committed-config.js';
import {
  BASE_URL_UNDERIVABLE,
  FormioConfig,
  PROJECT_URL_GUIDANCE,
  normalizeHttpUrl,
} from './config.js';
import {
  BaseUrlSource,
  ProjectNotConfiguredError,
  ProjectResolution,
  ProjectUrlSource,
  resolveProject,
} from './project-resolver.js';

/**
 * What resolves for a working directory, and where each half of it came from.
 *
 * Two callers ask that question and they ask it from different places: the
 * `project get` CLI subcommand, which runs in the user's shell, and the
 * `project_get` tool, which runs inside the server the answer is about. The
 * resolution and the report have to be identical — a preflight that disagrees
 * with the tools it precedes is worse than no preflight — so both come from here
 * and only the vocabulary of the remedies differs.
 */

// The three answers this report can carry, matching the CLI's exit codes 0, 1
// and 3. "Could not answer at all" is not one of them: it throws, and each
// caller renders it in its own failure shape (the CLI's exit 2, the tool's
// isError).
export type ProjectReportStatus = 'ok' | 'not-configured' | 'base-url-unresolved';

/**
 * How a caller tells its reader to fix what the report found.
 *
 * The facts are the same either way; the instruction is not. A shell caller is
 * told to run a command, and an agent holding an open connection to this server
 * is told to call `project_set` — sending it to npx instead would spawn a second
 * copy of the very server that just answered.
 */
export interface ProjectRemedies {
  /** Nothing is mapped for this directory: how to record a project URL. */
  setProject: (cwd: string) => string[];
  /**
   * The project resolved and its deployment did not: how to record a base URL.
   *
   * Takes the project's SOURCE as well as the directory, because the remedy is
   * about a record that has to exist. "Add a baseUrl key beside projectUrl in the
   * committed formio.json" is only an instruction where a committed file names
   * the project; said to a directory whose project comes from the environment it
   * describes a file with nothing to add the key beside, and the file it produces
   * is not half-configured but UNUSABLE — findCommittedConfig claims any file
   * naming either key and then throws on one with no projectUrl. That turned the
   * one answer with a named remedy into the one every skill relays and stops on.
   */
  setBaseUrl: (options: {
    cwd: string;
    projectUrlSource: ProjectUrlSource;
    projectUrl: string;
    /**
     * The committed file holding the project, when that is the record. The remedy
     * there is an edit to that exact file — this server never writes a committed
     * file — so the instruction has to name its path: the upward walk means the
     * governing file is usually not in the directory the caller is standing in.
     */
    committedFilePath?: string;
  }) => string[];
  /**
   * What to say about the environment the answer was NOT read from. The CLI runs
   * in a shell that cannot see the server's environment block; the tool IS the
   * server, so it has nothing to disclaim.
   */
  environmentCaveat: (cwd: string) => string[];
  /**
   * How to NAME the environment a value DID come from, as a noun phrase.
   *
   * Not the same question as the caveat above, and getting it from there was
   * wrong in one direction: the two readers stand in different processes. A shell
   * caller reads its own variables, so "this shell's environment" tells it exactly
   * where to look. An agent calling the tool does not — the server's env block is
   * written in a launch configuration, and telling that agent its project came
   * from "this shell" sends it hunting for a variable no shell it can reach has.
   */
  environmentLocation: string;
}

/**
 * How to NAME the environment as the record that holds the project, as a noun phrase.
 *
 * Only the environment needs naming this way: both readers answer the committed and
 * mapping records with their own wording and return before reaching here. It exists
 * because the environment clause differs per reader — the two stand in different
 * processes, so telling an agent its project came from "this shell" sends it hunting
 * for a variable no shell it can reach holds (see `environmentLocation`).
 *
 * Typed to the one source it serves rather than accepting all three and branching:
 * the other two branches were unreachable, and an unreachable branch is a wording
 * nobody reads and nobody updates.
 */
export function environmentRecordName(environmentLocation: string): string {
  return `FORMIO_PROJECT_URL in ${environmentLocation}`;
}

/**
 * How every report spells "this directory has a project and no deployment".
 *
 * Named because two readers print it and a writer now prints it too, and a caller
 * matching on the line has one string to match rather than three spellings of it.
 */
export const BASE_URL_NOT_DETERMINED = 'could not be determined.';

export interface ProjectReportRequest {
  cwd: string;
  baseConfig: FormioConfig;
  cacheDir?: string;
  remedies: ProjectRemedies;
  /**
   * The caller's own notes array, appended to IN PLACE — an ignored environment
   * variable the caller already collected, plus everything resolution emits.
   *
   * Caller-owned rather than returned, because resolution can throw after emitting a
   * note and the caller has to render both: the note is often the cause of the very
   * failure it accompanies.
   */
  notes: string[];
  /**
   * Whether `cwd` above is the directory the CALLER named, or a fallback.
   *
   * It changes what the unmapped answer has to say, because that answer's remedy
   * names a directory to record the project under. The CLI's fallback is the shell
   * it runs in, which IS the user's directory, so it defaults to true. The tool's
   * fallback is the server's own process cwd — fixed at spawn, and for a plugin-
   * or desktop-launched server nowhere near the user — so recording a project
   * there leaves every later call, which does pass a cwd, resolving nothing. Said
   * out loud for the same reason missingProjectError says it.
   */
  cwdWasNamed?: boolean;
}

/**
 * The next call, as a call rather than as a sentence.
 *
 * Both readers already name the write in their own vocabulary, and a shell reader can
 * paste theirs. An agent cannot: it had to parse an English clause back into arguments,
 * which is a step that can go wrong silently and that no test could execute. Carried
 * structurally, the report's own remedy is runnable — and therefore testable — by the
 * caller it is written for.
 *
 * `supply` names the arguments the USER answers; everything in `arguments` the report
 * already knows.
 *
 * Absent where no call fixes the state: a deployment missing from a committed
 * formio.json is recorded by editing that file — this server never writes one — and
 * the message names the exact file and key instead.
 */
export interface RemedyCall {
  tool: 'project_set';
  arguments: Record<string, string>;
  supply: string[];
}

export interface ProjectReport {
  status: ProjectReportStatus;
  cwd: string;
  projectUrl?: string;
  baseUrl?: string;
  projectUrlSource?: ProjectUrlSource;
  baseUrlSource?: BaseUrlSource;
  /** Layers that could have supplied a URL and lost to a higher one, in precedence order. */
  shadowed: string[];
  /**
   * Values that lost to nothing: a deployment recorded with no project beside it, so
   * nothing says which project it serves and it cannot be read. Reported apart from
   * `shadowed` because the reader's next move differs — a shadowed value sits in the
   * wrong record, an unpaired one sits in an incomplete one.
   */
  unpaired: string[];
  /** The full human-readable report, remedies included. */
  message: string;
  /** The same remedy as a call, for a caller that acts rather than reads. */
  remedy?: RemedyCall;
  notes: string[];
}

// A losing record's values are never validated — a record that cannot win takes no
// part in the answer, so failing the whole resolution over one would fail a directory
// for a value nothing reads. But they are ECHOED here, so an unusable one is labelled
// rather than printed as though it were a URL somebody could act on.
function describeCandidate(value: string): string {
  try {
    normalizeHttpUrl(value, 'value');
    return value;
  } catch {
    return `${value} (not a usable URL)`;
  }
}

// The resolver signals "nothing configured" by throwing, which is the right
// shape for a tool handler and the wrong one for a reporting command. An
// unreadable map is a different answer than an unmapped directory, though:
// reporting it as "nothing configured" sends the caller to `project set`, whose
// rewrite is what destroys the other mappings. It travels to the caller instead,
// which turns it into that caller's own failure shape.
function resolveOrNull(
  cwd: string,
  baseConfig: FormioConfig,
  {
    cacheDir,
    onNote,
    onUnpaired,
  }: {
    cacheDir?: string;
    onNote: (message: string) => void;
    onUnpaired: (values: string[]) => void;
  }
): ProjectResolution | null {
  // A relative cwd is rejected by resolveProject itself, with a plain Error that the
  // catch below passes straight through — "nothing is mapped" is only ever the
  // ProjectNotConfiguredError. A second copy of that check here said the same thing
  // in a second place, which is the shape every defect on this surface has had.
  try {
    return resolveProject(cwd, baseConfig, { cacheDir, onNote });
  } catch (error) {
    // ONLY "nothing is configured here" becomes a report. Everything else travels to
    // the caller, which turns it into that caller's own failure shape.
    //
    // Catching by exclusion — "anything that is not one of these two record errors means
    // nothing is mapped" — made every error added afterwards silently become an
    // interview, which writes a record the real problem still shadows. Naming the one
    // answer instead means a new failure surfaces as a failure by default.
    if (error instanceof ProjectNotConfiguredError) {
      // A deployment found with no project beside it is reported on this status too.
      // Hardcoding an empty list here was the one answer that accounted for it
      // nowhere — and its own remedy overwrites the entry holding it.
      onUnpaired(error.unpaired);
      return null;
    }
    throw error;
  }
}

export function reportProject({
  cwd,
  baseConfig,
  cacheDir,
  remedies,
  notes,
  cwdWasNamed = true,
}: ProjectReportRequest): ProjectReport {
  // The caller's own array, appended to in place. A note is often the CAUSE of the
  // failure it accompanies, and resolution can THROW after emitting one — an ignored
  // formio.json on the walk, then an unreadable map — so a private copy here left the
  // caller rendering the second problem with no sight of the first.
  const unconfiguredUnpaired: string[] = [];
  const resolution = resolveOrNull(cwd, baseConfig, {
    cacheDir,
    onNote: (message) => notes.push(message),
    onUnpaired: (values) => unconfiguredUnpaired.push(...values),
  });

  if (!resolution) {
    return {
      status: 'not-configured',
      cwd,
      // No call is offered for a directory the caller did not name: this answer is
      // about the server's own working directory, the message says to call again with
      // the user's cwd BEFORE recording anything, and a remedy carrying this directory
      // as an argument contradicts that — the write succeeds, and every later call,
      // which does pass the user's cwd, resolves nothing. The schema tells agents to
      // act on `remedy` rather than parse the message, so the warning has to be
      // structural rather than prose.
      ...(cwdWasNamed
        ? { remedy: { tool: 'project_set' as const, arguments: { cwd }, supply: ['projectUrl'] } }
        : {}),
      shadowed: [],
      unpaired: unconfiguredUnpaired,
      notes: [...notes],
      message: [
        `No Form.io project is configured for ${cwd}, and no ${COMMITTED_CONFIG_FILE} was found by walking up from it.`,
        // Which directory was searched is the whole answer when the caller named
        // none: the remedy below records the project under it, and recording it
        // under the wrong one is invisible — the write succeeds, and the next
        // call, which does name a directory, resolves nothing again.
        ...(cwdWasNamed
          ? []
          : [
              `That is the MCP server's own working directory, and it is the only directory searched because no cwd argument was passed. If it is not where the user is, call this again with cwd set to their directory BEFORE recording anything — a project recorded here would not be found from theirs.`,
            ]),
        // Named only where the caller chose the directory. Otherwise the one next
        // step is the warning above — call again with the user's own cwd — and a
        // fully-specified call naming THIS directory contradicts it in the channel
        // the skills actually relay.
        // Named before the remedy, because that remedy REPLACES the entry holding
        // it: a value overwritten without ever being shown is one the user cannot
        // get back or account for.
        ...(unconfiguredUnpaired.length
          ? [``, `Unpaired:    ${unconfiguredUnpaired.join(' ')}`, ``]
          : []),
        ...(cwdWasNamed ? remedies.setProject(cwd) : []),
        ``,
        PROJECT_URL_GUIDANCE,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  const { config: resolved, sources } = resolution;
  const committedPath = resolution.committedFilePath;

  // The caller named no directory, so this answer is about the fallback one. The
  // unmapped branch above already says it as part of its remedy; a RESOLVED
  // answer needs it just as much, because the tool's fallback is the server's own
  // process cwd — fixed at spawn, and for a plugin- or desktop-launched server
  // nowhere near the user. Reported confidently and silently, it names a project
  // for a directory nobody asked about, and the next call, which does pass a cwd,
  // targets a different one.
  //
  // Except where the directory decided nothing. A project from the environment
  // resolves identically for EVERY directory, so the fallback is not part of that
  // answer — which is why resolveProject suppresses its own copy of this note on
  // the same condition. Said anyway, it hangs a caution on an answer that is
  // correct everywhere, and the skills relay notes to the user as causes.
  //
  // A HALF-configured answer is the exception to that exception, whatever supplied
  // the project: its remedy records a base URL as a per-directory mapping, so the
  // directory is part of that answer even when the project is not. Silent, the
  // remedy named the server's own directory as though the caller had chosen it, and
  // the next call — which does pass a cwd — reaches the same status again with the
  // mapping stranded where nothing reads it.
  const baseUrlIsUnresolved = sources.baseUrl === 'unresolved';
  if (!cwdWasNamed && (sources.projectUrl !== 'environment' || baseUrlIsUnresolved)) {
    notes.push(
      `No cwd argument was passed, so this answer is about ${cwd}, the MCP server's own working directory. Pass cwd on every Form.io tool call to target the user's directory.`
    );
  }

  // Every layer that COULD have supplied the project, in precedence order, so a
  // losing one can be reported rather than silently omitted. "My project_set did
  // nothing" is otherwise unanswerable from this output.
  const shadowed: string[] = [];
  if (sources.projectUrl !== 'committed' && resolution.candidates.committed) {
    shadowed.push(
      `a committed ${COMMITTED_CONFIG_FILE} naming ${describeCandidate(resolution.candidates.committed)}`
    );
  }
  // The mapping's project URL is the one echoed value that is raw, hand-editable disk
  // content — committed and environment values are normalized before they reach
  // here — so it is the one most likely to need the label, and it was the one value
  // not getting it: an unusable project URL read as a real alternative target beside
  // a labelled sibling.
  if (sources.projectUrl !== 'mapping' && resolution.candidates.mapping) {
    shadowed.push(
      `the working-directory mapping naming ${describeCandidate(resolution.candidates.mapping)}`
    );
  }
  if (sources.projectUrl !== 'environment' && resolution.candidates.environment) {
    shadowed.push(
      `FORMIO_PROJECT_URL in ${remedies.environmentLocation} naming ${describeCandidate(resolution.candidates.environment)}`
    );
  }
  // A deployment recorded with NO project beside it is a different thing from a
  // shadowed one, and saying "overridden by the record above" about it is simply
  // false: nothing outranked it, and nothing could — it names no project, so nothing
  // says which project it serves and it cannot be read at all. Reported on its own
  // line, because the reader's next move differs: a shadowed value is in the wrong
  // RECORD, an unpaired one is an incomplete record.
  const unpaired: string[] = [];
  // A base URL in the WINNING record that went unused was not outranked — nothing
  // outranks the record that won. It was rejected by the pair rule, and the note the
  // resolver emitted says so, names the record, and names the value. Listing it here
  // as "overridden by the source above" told a second, false story — and only for the
  // committed record, since a winning mapping or environment record is excluded by
  // the project-source gates below. The note is the one account, for all three.
  //
  // A base URL in a LOSING record is a different thing: it belongs to that record's
  // project, so it is reported as shadowed along with it rather than as a competing
  // value of its own — unless that record holds no project, which makes it unpaired.
  if (sources.projectUrl !== 'mapping' && resolution.baseUrlCandidates.mapping) {
    (resolution.candidates.mapping ? shadowed : unpaired).push(
      resolution.candidates.mapping
        ? `the mapped base URL naming ${describeCandidate(resolution.baseUrlCandidates.mapping)}`
        : `${cwd} has ${describeCandidate(resolution.baseUrlCandidates.mapping)} mapped as a deployment with no project beside it`
    );
  }
  if (sources.projectUrl !== 'environment' && resolution.baseUrlCandidates.environment) {
    (resolution.candidates.environment ? shadowed : unpaired).push(
      resolution.candidates.environment
        ? `FORMIO_BASE_URL in ${remedies.environmentLocation} naming ${describeCandidate(resolution.baseUrlCandidates.environment)}`
        : `FORMIO_BASE_URL in ${remedies.environmentLocation} names ${describeCandidate(resolution.baseUrlCandidates.environment)} with no FORMIO_PROJECT_URL beside it`
    );
  }

  // Half-configured is its own answer, and its own status. The project URL
  // resolved and its deployment did not — a path-less customer project names no
  // host to derive one from — so reporting the api.form.io default here would
  // present a guess as configuration. Not "not-configured": the remedy is the
  // base URL alone, not the project interview that status sends the caller into.
  if (baseUrlIsUnresolved) {
    return {
      status: 'base-url-unresolved',
      cwd,
      // The same write the prose names, as arguments. A deployment goes beside its
      // project, so which remedy this is depends on the record that holds it — and
      // for a committed file there is no call to carry: the fix is an edit to that
      // file, which the message names by path and key. project_set writes only the
      // machine-local mapping.
      // Omitted for a committed project (no call performs a file edit) and for a
      // directory the caller did not name (the message says to call again with the
      // user's cwd first, and a remedy naming this one contradicts it).
      ...(sources.projectUrl !== 'committed' && cwdWasNamed
        ? {
            remedy: {
              tool: 'project_set' as const,
              arguments:
                sources.projectUrl === 'mapping'
                  ? { cwd }
                  : { cwd, projectUrl: resolved.projectUrl },
              supply: ['baseUrl'],
            },
          }
        : {}),
      projectUrl: resolved.projectUrl,
      projectUrlSource: sources.projectUrl,
      baseUrlSource: sources.baseUrl,
      shadowed,
      unpaired,
      notes: [...notes],
      message: [
        `Project URL: ${resolved.projectUrl}`,
        `Base URL:    ${BASE_URL_NOT_DETERMINED}`,
        `Directory:   ${cwd}`,
        ``,
        `The project is configured — only its Base URL is missing: ${BASE_URL_UNDERIVABLE}.`,
        // A record holds a project and its deployment together. An entry holding only a
        // deployment — the shape an earlier release wrote for a project kept elsewhere —
        // names no project, so nothing says which project it serves and it cannot be
        // read. Named here because it IS the value the user is being asked for again,
        // and the remedy below replaces the entry that strands it.
        // The Unpaired line below states WHAT is stranded. This says what the remedy
        // does about it, which is the part that differs by record: a mapping write
        // replaces the entry, while an edit to a committed file never touches the map —
        // and claiming otherwise left the entry in place after the user had been told
        // it was gone.
        ...(!resolution.candidates.mapping &&
        resolution.baseUrlCandidates.mapping &&
        // Gated with the remedy it describes. Unconditional, it promised a write
        // "below" in the same message that omits every remedy and warns against
        // recording anything under this directory.
        cwdWasNamed
          ? [
              ``,
              sources.projectUrl === 'committed'
                ? `The ${COMMITTED_CONFIG_FILE} edit below leaves that entry alone; remove it by recording a project for this directory, or leave it — it changes nothing.`
                : `The write below records the pair for this directory and replaces that entry.`,
            ]
          : []),
        // The remedy below records the Base URL under a directory, so the caller
        // has to know when that directory is a fallback rather than one they chose —
        // exactly as the unmapped branch says it. The project may resolve the same
        // everywhere; the record about to be written does not.
        ...(cwdWasNamed
          ? []
          : [
              `That directory is the MCP server's own working directory, and it is the only directory this answer is about because no cwd argument was passed. If it is not where the user is, call this again with cwd set to their directory BEFORE recording anything — a Base URL recorded here would not be found from theirs.`,
            ]),
        // Gated for the same reason, and on the same condition, as the structured
        // remedy above: a remedy that records a deployment under a directory the
        // caller did not choose is the write this answer just warned against.
        ...(cwdWasNamed
          ? remedies.setBaseUrl({
              cwd,
              projectUrlSource: sources.projectUrl,
              projectUrl: resolved.projectUrl,
              ...(committedPath ? { committedFilePath: committedPath } : {}),
            })
          : []),
        // "Why is the base URL I recorded not in effect?" is exactly the question this
        // answer provokes, and the losing record is the answer to it. Computed for every
        // status but rendered only into the resolved one, it was missing from the report
        // that most needs it.
        ...(shadowed.length
          ? [``, `Shadowed:    ${shadowed.join('; ')} — overridden by the record above.`]
          : []),
        ...(unpaired.length
          ? [
              ``,
              `Unpaired:    ${unpaired.join('; ')} — nothing says which project it serves, so it is ignored.`,
            ]
          : []),
        ``,
        `This blocks JWT authentication, which builds the portal-login URL from the Base URL and keys the cached token by it. An API key needs no Base URL and is unaffected.`,
      ].join('\n'),
    };
  }

  // Reports which side of the resolver's precedence supplied each URL. Without
  // it, an environment value silently overriding a mapping that looks correct on
  // disk is undiagnosable.
  //
  // Two answers, not one: the base URL resolves on its own terms — a pinned
  // project can be paired with a base URL that came from the mapping — so a
  // single "Source:" naming only where the project came from misattributes the
  // other line. The provenance is reported by the resolver rather than inferred
  // by comparing values here: an inferred answer credits the mapping whenever it
  // happens to hold the same string that won, and https://api.form.io is the
  // value most likely to be on both sides.
  const describe = (source: BaseUrlSource, variable: string) => {
    if (source === 'environment') {
      return `${remedies.environmentLocation} (${variable}), the weakest source — a committed ${COMMITTED_CONFIG_FILE} or the working-directory mapping overrides it`;
    }
    if (source === 'mapping') {
      return `the working-directory mapping for ${cwd}`;
    }
    if (source === 'committed') {
      // Named by path, not by layer: the upward walk means the governing file is
      // usually not in the directory the caller is standing in, so "a committed
      // file" leaves "why this project?" unanswered.
      return `the committed ${COMMITTED_CONFIG_FILE} at ${committedPath ?? '(unknown path)'}`;
    }
    // One wording for every derivation: a form.io host implies api.form.io, and a
    // sub-directory project implies its parent. Both are read off the project URL,
    // which is what makes the project URL the single configuration.
    return `the project URL it was derived from — the base URL is not configured separately unless it cannot be derived`;
  };
  const projectSource = describe(sources.projectUrl, 'FORMIO_PROJECT_URL');
  const baseSource = describe(sources.baseUrl, 'FORMIO_BASE_URL');
  // Collapsed on the rendered clauses, not on the source enums: two values can
  // both come from `environment` and still come from *different variables*, and
  // printing the project's clause alone then credits the base URL to
  // FORMIO_PROJECT_URL — the attribution a reader of this output branches on.
  // Identical strings are the only case where one clause says everything.
  const source =
    projectSource === baseSource
      ? projectSource
      : `project URL from ${projectSource}; base URL from ${baseSource}`;

  // Kept whenever the mapping supplied any part of the answer, including a base
  // URL under a pinned project. Whether it says anything at all is the caller's
  // decision, because what it discloses is true of a shell and false of the
  // server itself.
  const caveat = [sources.projectUrl, sources.baseUrl].includes('mapping')
    ? remedies.environmentCaveat(cwd)
    : [];

  return {
    status: 'ok',
    cwd,
    projectUrl: resolved.projectUrl,
    baseUrl: resolved.baseUrl,
    projectUrlSource: sources.projectUrl,
    baseUrlSource: sources.baseUrl,
    shadowed,
    unpaired,
    notes: [...notes],
    message: [
      `Project URL: ${resolved.projectUrl}`,
      `Base URL:    ${resolved.baseUrl}`,
      `Source:      ${source}`,
      ...(shadowed.length
        ? [`Shadowed:    ${shadowed.join('; ')} — overridden by the source above.`]
        : []),
      ...(unpaired.length
        ? [
            `Unpaired:    ${unpaired.join('; ')} — nothing says which project it serves, so it is ignored.`,
          ]
        : []),
      ...caveat,
    ].join('\n'),
  };
}
