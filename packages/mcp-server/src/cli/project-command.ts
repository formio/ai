import fs from 'fs';
import path from 'path';
import { FormioConfig, PROJECT_URL_GUIDANCE, normalizeHttpUrl, readHttpUrlEnv } from '../config.js';
import {
  COMMITTED_CONFIG_FILE,
  CommittedConfigUnusableError,
  findCommittedConfig,
  planCommittedConfigWrite,
} from '../committed-config.js';
import { ProjectMapUnreadableError, readProjectEntry, writeProjectEntry } from '../project-map.js';
import {
  BaseUrlSource,
  ProjectResolution,
  derivesOwnBaseUrl,
  resolveProject,
  usableEnvironmentBaseUrl,
} from '../project-resolver.js';
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
  `  ${PROJECT_CLI} set [--project-url <url>] [--base-url <url>] [--cwd <absolute path>] [--scope user|repo]`,
  `  ${PROJECT_CLI} get [--cwd <absolute path>]`,
  '',
  'Scopes:',
  '  user  (default)  the machine-local mapping in ~/.formio/projects.json',
  `  repo             a committed ${COMMITTED_CONFIG_FILE}, versioned with the code and shared with everyone who clones it`,
].join('\n');

// The environment, the working directory, and the cache directory are all
// injected rather than read at the point of use, so every case is testable
// without touching the real ~/.formio or the real process environment.
interface CommandContext {
  env: NodeJS.ProcessEnv;
  cwd: string;
  cacheDir?: string;
}

export function isProjectCommand(args: string[]): boolean {
  return args[0] === 'project';
}

// Only `--flag value` pairs are recognized; anything else is a usage error
// rather than a silently ignored token.
function parseFlags(args: string[]): Record<string, string> {
  return args.reduce<Record<string, string>>((flags, token, index) => {
    if (!token.startsWith('--')) {
      const flagBefore = args[index - 1];
      if (flagBefore?.startsWith('--')) {
        return flags;
      }
      throw new Error(`Unexpected argument: ${token}`);
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
function fail(stderr: string): ProjectCommandResult {
  return { exitCode: EXIT_FAILED, stdout: '', stderr };
}

function runSet(flags: Record<string, string>, context: CommandContext): ProjectCommandResult {
  if (!flags['project-url'] && !flags['base-url']) {
    return fail(`Pass at least one of --project-url or --base-url.\n\n${USAGE}`);
  }

  const scope = flags.scope ?? 'user';
  if (scope !== 'user' && scope !== 'repo') {
    return fail(`--scope must be one of: user, repo. Received: ${scope}\n\n${USAGE}`);
  }

  const cwd = resolveCwd(flags.cwd, context.cwd);

  if (scope === 'repo') {
    return writeCommittedScope(flags, cwd);
  }
  const mappedProjectUrl = readProjectEntry(cwd, context.cacheDir)?.env.FORMIO_PROJECT_URL;
  // A committed formio.json configures the project exactly as the mapping does,
  // and the base-URL error does not say which one supplied it — it asks for the
  // deployment alone, by design. So "this directory has a project" is a question
  // about every source, not about the map: consulting only the map made the
  // remedy the server prints for a repo-scoped project answer "no project mapped
  // yet" for a directory whose project it had just printed. A file too broken to
  // read throws out of here into runProjectCommand's catch, which is right — that
  // is a command that could not answer, not a directory with no project.
  const committedProjectUrl = findCommittedConfig(cwd)?.projectUrl;

  // --project-url is required only where NOTHING configures a project. Wherever
  // one is on record, either flag alone is a valid partial update, which is what
  // makes the base-URL error's own remedy — `project set --base-url <url>` — a
  // command the user can actually run.
  if (!flags['project-url'] && !mappedProjectUrl && !committedProjectUrl) {
    return fail(
      `--project-url is required for ${cwd}, which has no project mapped yet.\n\n${USAGE}`
    );
  }

  const normalizedMapped = mappedProjectUrl
    ? // Re-normalized rather than passed through: the stored value is
      // hand-editable and predates this validation, and it is about to be
      // rewritten as though freshly supplied.
      normalizeHttpUrl(mappedProjectUrl, `FORMIO_PROJECT_URL mapped for ${cwd}`)
    : undefined;
  // Undefined when only a committed file names the project. Nothing is written to
  // the mapping in that case: copying the committed value in would make a second
  // record of the project that goes stale the moment the tracked file changes,
  // and this call was asked for a deployment, not for a project.
  const projectUrl = flags['project-url']
    ? normalizeHttpUrl(flags['project-url'], 'projectUrl')
    : normalizedMapped;
  // What this directory will resolve to once the write lands — the value the
  // derivation questions below are about, whichever record holds it. Committed
  // first, matching the order resolveProjectConfig reads them in: a committed
  // formio.json outranks the mapping, so where both name a project the mapping is
  // not what governs this directory.
  const effectiveProjectUrl = (committedProjectUrl ?? projectUrl) as string;
  const repointed = Boolean(normalizedMapped) && projectUrl !== normalizedMapped;
  // Falsy, not nullish, at every link: an empty FORMIO_BASE_URL is a prompt the
  // user cleared, not a deployment. A nullish chain would stop there, hand the
  // rewrite an empty string, and drop the mapped base URL just the same.
  //
  // The environment link is read through readHttpUrlEnv, which drops an
  // unusable value instead of throwing: this command runs in whatever shell the
  // agent inherited, and a FORMIO_BASE_URL exported from an unexpanded manifest
  // variable would otherwise fail the very invocation formio-mcp-setup runs —
  // for a user who supplied no base URL of their own and cannot see why. The
  // flag stays strict, because that one is the user's own typing.
  //
  // The mapped link is read the same tolerant way, and for a sharper reason: this
  // rewrite is the documented repair for a directory whose mapping the resolver
  // now refuses, so failing on the stored value made the repair report the very
  // error it was run to clear — and named it "baseUrl", as though the caller had
  // typed it.
  const notes: string[] = [];
  const onIgnored = (message: string) => notes.push(message);
  const mappedBaseUrl = readHttpUrlEnv({
    raw: readProjectEntry(cwd, context.cacheDir)?.env.FORMIO_BASE_URL,
    name: `FORMIO_BASE_URL mapped for ${cwd}`,
    onIgnored,
  });
  // A mapped base URL belongs to the project it was mapped WITH. Re-pointing the
  // directory at a project that names its own deployment must drop it, or one
  // deployment answers for another — and, because the mapping outranks
  // derivation, answers for this directory forever. The same one-value-answering-
  // a-per-project-question failure the environment link below is gated against,
  // reached through the mapping instead. A re-set that leaves the project alone
  // keeps it: there it is this project's own explicitly recorded deployment.
  const carriedBaseUrl =
    repointed && derivesOwnBaseUrl(effectiveProjectUrl) ? undefined : mappedBaseUrl;
  //
  // The environment link is reached only for a project URL that derives no
  // deployment of its own. One global answering a per-project question, written
  // into this mapping, would replace the derivation and then outrank it for this
  // directory forever.
  const declaredBaseUrl =
    flags['base-url'] ||
    carriedBaseUrl ||
    usableEnvironmentBaseUrl({
      projectUrl: effectiveProjectUrl,
      read: () =>
        readHttpUrlEnv({
          raw: context.env.FORMIO_BASE_URL,
          name: 'FORMIO_BASE_URL',
          onIgnored,
        }),
      onNote: onIgnored,
    });
  const baseUrl = declaredBaseUrl ? normalizeHttpUrl(declaredBaseUrl, 'baseUrl') : undefined;

  writeProjectEntry(
    cwd,
    {
      ...(projectUrl && { FORMIO_PROJECT_URL: projectUrl }),
      ...(baseUrl && { FORMIO_BASE_URL: baseUrl }),
    },
    context.cacheDir
  );

  return ok(
    [
      projectUrl ? `Project set for ${cwd}` : `Base URL set for ${cwd}`,
      `Project URL: ${effectiveProjectUrl}`,
      // A mapping write under a committed file naming a different project still
      // belongs on disk — it is the fallback if that file goes away — but it does
      // not take effect now, and silence here reads as "your project is now X".
      ...(committedProjectUrl && projectUrl && committedProjectUrl !== projectUrl
        ? [
            ``,
            `Note: the committed ${COMMITTED_CONFIG_FILE} names ${committedProjectUrl}, which outranks the mapping just written (${projectUrl}). ${committedProjectUrl} stays the active project for this directory until that file changes.`,
          ]
        : []),
      ...(baseUrl ? [`Base URL:    ${baseUrl}`] : []),
      ...(projectUrl
        ? []
        : [
            ``,
            `The project stays where it is recorded — the committed ${COMMITTED_CONFIG_FILE} — and only the deployment was added to this directory's mapping.`,
          ]),
    ].join('\n'),
    notes
  );
}

function runGet(flags: Record<string, string>, context: CommandContext): ProjectCommandResult {
  const cwd = resolveCwd(flags.cwd, context.cwd);
  // Read exactly as getConfig reads it, or this command answers a question about
  // a server that does not exist: the server drops an unusable FORMIO_PROJECT_URL
  // and resolves from the mapping, so printing the literal here and naming the
  // environment as the winning source contradicts what the next tool call does.
  // The whole point of `project get` is to report what resolves and which source
  // won, so the two readings must not diverge.
  const notes: string[] = [];
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
  const resolution = resolveOrNull(cwd, context, {
    baseConfig: { baseUrl: envBaseUrl, projectUrl: envProjectUrl },
    onNote: (message) => notes.push(message),
  });

  if (!resolution) {
    return notConfigured(
      [
        `No Form.io project is configured for ${cwd}, and no ${COMMITTED_CONFIG_FILE} was found by walking up from it.`,
        `Run: ${projectCommand(`set --project-url <url> --cwd ${cwd}`)}`,
        `Or record it with the code, versioned and shared with everyone who clones the repository:`,
        `     ${projectCommand(`set --project-url <url> --scope repo --cwd ${cwd}`)}`,
        ``,
        PROJECT_URL_GUIDANCE,
      ]
        .filter(Boolean)
        .join('\n'),
      notes
    );
  }

  const { config: resolved, sources } = resolution;
  const committedPath = resolution.committedFilePath;

  // Every layer that COULD have supplied the project, in precedence order, so a
  // losing one can be reported rather than silently omitted. "My project_set did
  // nothing" is otherwise unanswerable from this output.
  const shadowed: string[] = [];
  if (sources.projectUrl !== 'committed' && resolution.candidates.committed) {
    shadowed.push(`a committed ${COMMITTED_CONFIG_FILE} naming ${resolution.candidates.committed}`);
  }
  if (sources.projectUrl !== 'mapping' && resolution.candidates.mapping) {
    shadowed.push(`the working-directory mapping naming ${resolution.candidates.mapping}`);
  }
  if (sources.projectUrl !== 'environment' && resolution.candidates.environment) {
    shadowed.push(`FORMIO_PROJECT_URL in this shell naming ${resolution.candidates.environment}`);
  }
  // The base URL needs the same report, for the same reason. A mapped deployment
  // silently overriding a committed one is otherwise invisible in this output,
  // and "my formio.json baseUrl did nothing" then has no answer here.
  if (sources.baseUrl !== 'committed' && resolution.baseUrlCandidates.committed) {
    shadowed.push(
      `the baseUrl in the committed ${COMMITTED_CONFIG_FILE} naming ${resolution.baseUrlCandidates.committed}`
    );
  }
  if (sources.baseUrl !== 'mapping' && resolution.baseUrlCandidates.mapping) {
    shadowed.push(`the mapped base URL naming ${resolution.baseUrlCandidates.mapping}`);
  }
  if (sources.baseUrl !== 'environment' && resolution.baseUrlCandidates.environment) {
    shadowed.push(
      `FORMIO_BASE_URL in this shell naming ${resolution.baseUrlCandidates.environment}`
    );
  }

  // Half-configured is its own answer, and its own exit code. The project URL
  // resolved and its deployment did not — a path-less customer project names no
  // host to derive one from — so printing the api.form.io default here would
  // present a guess as configuration. Not a `1`: the remedy is the base URL
  // alone, not the project interview a `1` sends the caller into. And not a `2`
  // either, which is what it used to return: a `2` means the command could not
  // answer, and every skill's preflight responds to one by relaying and stopping.
  if (sources.baseUrl === 'unresolved') {
    return baseUrlUnresolved(
      [
        `Project URL: ${resolved.projectUrl}`,
        `Base URL:    could not be determined.`,
        ``,
        `The project is configured — only its Base URL is missing. A project URL with no path names its deployment nowhere: the deployment is a sibling sub-domain of the same parent domain, so it must be supplied rather than derived.`,
        `Run: ${projectCommand(`set --base-url <base_url> --cwd ${cwd}`)}`,
        `Or add a "baseUrl" key beside "projectUrl" in the committed ${COMMITTED_CONFIG_FILE}, which records it with the code.`,
        ``,
        `This blocks JWT authentication, which builds the portal-login URL from the Base URL and keys the cached token by it. An API key needs no Base URL and is unaffected.`,
      ].join('\n'),
      notes
    );
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
      return `this shell’s environment (${variable}), the weakest source — a committed ${COMMITTED_CONFIG_FILE} or the working-directory mapping overrides it`;
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

  // This command runs in the caller's shell, not in the MCP server's process. A
  // plugin- or bundle-launched server carries its own env block, so what it
  // resolves can differ from what is printed here — and the difference is
  // invisible from this side. Say so rather than let the output be read as the
  // server's answer. Kept whenever the mapping supplied any part of the answer,
  // including a base URL under a pinned project.
  const caveat = [sources.projectUrl, sources.baseUrl].includes('mapping')
    ? [
        `Note:        the MCP server’s own environment is not visible from this shell, so a FORMIO_PROJECT_URL or FORMIO_BASE_URL set there is not listed above. Neither can override this mapping — the environment is the weakest source — so what resolves here is what the server resolves.`,
      ]
    : [];

  return ok(
    [
      `Project URL: ${resolved.projectUrl}`,
      `Base URL:    ${resolved.baseUrl}`,
      `Source:      ${source}`,
      ...(shadowed.length
        ? [`Shadowed:    ${shadowed.join('; ')} — overridden by the source above.`]
        : []),
      ...caveat,
    ].join('\n'),
    notes
  );
}

interface ResolveRequest {
  baseConfig: FormioConfig;
  onNote: (message: string) => void;
}

// The resolver signals "nothing configured" by throwing, which is the right
// shape for a tool handler and the wrong one for a reporting command. An
// unreadable map is a different answer than an unmapped directory, though:
// reporting it as "nothing configured" sends the caller to `project set`, whose
// rewrite is what destroys the other mappings. It travels to the caller instead,
// where runProjectCommand's catch turns it into EXIT_FAILED — a code the caller
// can act on, rather than the EXIT_NOT_CONFIGURED an unmapped directory returns.
function resolveOrNull(
  cwd: string,
  context: CommandContext,
  { baseConfig, onNote }: ResolveRequest
): ProjectResolution | null {
  try {
    return resolveProject(cwd, baseConfig, { cacheDir: context.cacheDir, onNote });
  } catch (error) {
    // Both "a record exists and cannot be used" errors travel to the caller,
    // where runProjectCommand turns them into EXIT_FAILED. Reporting either as
    // "nothing configured" would send the caller to `project set`, which writes a
    // record the broken one then shadows — the symptom clears and the cause does
    // not, which the precedence order then hides.
    if (
      error instanceof ProjectMapUnreadableError ||
      error instanceof CommittedConfigUnusableError
    ) {
      throw error;
    }
    return null;
  }
}

export function runProjectCommand(
  args: string[],
  options: ProjectCommandOptions = {}
): ProjectCommandResult {
  const context: CommandContext = {
    env: options.env ?? process.env,
    cwd: options.cwd ?? process.cwd(),
    cacheDir: options.cacheDir,
  };
  const subcommand = args[1];

  try {
    const flags = parseFlags(args.slice(2));
    if (subcommand === 'set') {
      return runSet(flags, context);
    }
    if (subcommand === 'get') {
      return runGet(flags, context);
    }
    return fail(`Unknown project subcommand: ${subcommand ?? '(none)'}\n\n${USAGE}`);
  } catch (error) {
    // Everything that throws is a failure to answer, never an answer of
    // "nothing is mapped": an unreadable map, a relative --cwd, a malformed
    // stored URL. EXIT_FAILED keeps them out of the interview path.
    return fail(error instanceof Error ? error.message : String(error));
  }
}

// `--scope repo` writes the committed file rather than the machine-local mapping.
//
// Where it writes is the whole subtlety, and planCommittedConfigWrite owns the
// rule: an amendment lands on the governing file wherever the walk found it, and
// a write recording a DIFFERENT project lands in the directory the caller named,
// because rewriting an ancestor would re-point every sibling folder beside it.
function writeCommittedScope(flags: Record<string, string>, cwd: string): ProjectCommandResult {
  // Normalized before the placement question is asked: "is this the same project
  // the governing file already names?" is a comparison between normalized URLs,
  // and an unusable value has to fail as a usage error rather than decide a path.
  const requestedProjectUrl = flags['project-url']
    ? normalizeHttpUrl(flags['project-url'], 'projectUrl')
    : undefined;
  const { filePath: target, shadows } = planCommittedConfigWrite({
    startDir: cwd,
    projectUrl: requestedProjectUrl,
  });

  // Read-modify-write, preserving unknown keys: the file is hand-edited and may
  // carry a $schema or a convention key that this command has no business
  // discarding.
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(target)) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(target, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    } catch {
      // A file too broken to parse is still the file to replace; the values below
      // are what the caller asked to record, and refusing here would leave them
      // with no way to repair it through this command.
      existing = {};
    }
  }

  const projectUrl =
    requestedProjectUrl ??
    (typeof existing.projectUrl === 'string'
      ? normalizeHttpUrl(existing.projectUrl, `projectUrl in ${target}`)
      : undefined);
  if (!projectUrl) {
    return fail(
      `--project-url is required for ${target}, which records no project yet.\n\n${USAGE}`
    );
  }

  const baseUrl = flags['base-url']
    ? normalizeHttpUrl(flags['base-url'], 'baseUrl')
    : typeof existing.baseUrl === 'string'
      ? normalizeHttpUrl(existing.baseUrl, `baseUrl in ${target}`)
      : undefined;

  const next = {
    ...existing,
    projectUrl,
    ...(baseUrl ? { baseUrl } : {}),
  };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`);

  return ok(
    [
      `Wrote ${target}`,
      `Project URL: ${projectUrl}`,
      ...(baseUrl ? [`Base URL:    ${baseUrl}`] : []),
      ``,
      `This file is committed with the code and takes precedence over the machine-local mapping, so everyone who clones this repository resolves the same project.`,
      // Said out loud because the caller asked to record a project and got a file
      // in a directory they may not have expected: the ancestor was left alone on
      // purpose, so the folders beside this one keep the project it names.
      ...(shadows
        ? [
            ``,
            `${shadows.filePath} still names ${shadows.projectUrl} and was left unchanged, so it keeps governing every other directory under it. The new file takes precedence for ${cwd} and everything beneath it. To re-point the whole tree instead, run the same command with --cwd ${path.dirname(shadows.filePath)}.`,
          ]
        : []),
    ].join('\n')
  );
}
