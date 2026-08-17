import path from 'path';
import { DEFAULT_BASE_URL, FormioConfig, normalizeHttpUrl, readHttpUrlEnv } from '../config.js';
import { ProjectMapUnreadableError, readProjectEntry, writeProjectEntry } from '../project-map.js';
import { BaseUrlSource, ProjectResolution, resolveProject } from '../project-resolver.js';

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

// Three outcomes, three codes. "Nothing is mapped for this directory" is an
// answer to the question asked; "this command could not run" is not, and a
// caller that cannot tell them apart interviews the user and then calls
// project_set, which fails again for the same unreported reason. Documented for
// the skills, which branch on the code rather than on a substring of the
// message.
export const EXIT_OK = 0;
export const EXIT_NOT_CONFIGURED = 1;
export const EXIT_FAILED = 2;

const USAGE = [
  'Usage:',
  '  formio-mcp project set --project-url <url> [--base-url <url>] [--cwd <absolute path>]',
  '  formio-mcp project get [--cwd <absolute path>]',
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
function notConfigured(stderr: string): ProjectCommandResult {
  return { exitCode: EXIT_NOT_CONFIGURED, stdout: '', stderr };
}

// The command could not answer: a usage error, a malformed URL, a relative
// --cwd, an unreadable map. Interviewing on this hides the cause and repeats the
// failure through project_set.
function fail(stderr: string): ProjectCommandResult {
  return { exitCode: EXIT_FAILED, stdout: '', stderr };
}

function runSet(flags: Record<string, string>, context: CommandContext): ProjectCommandResult {
  if (!flags['project-url']) {
    return fail(`--project-url is required.\n\n${USAGE}`);
  }

  const projectUrl = normalizeHttpUrl(flags['project-url'], 'projectUrl');
  const cwd = resolveCwd(flags.cwd, context.cwd);
  // Same precedence as the project_set tool, and deliberately identical: the
  // flag, then the base URL already mapped for this directory, then the
  // environment. The mapping outranks the environment because it is the more
  // specific answer for this directory and the one the server honours at resolve
  // time; a re-set without --base-url must not revert a self-hosted directory to
  // whatever global the shell happens to export.
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
  const declaredBaseUrl =
    flags['base-url'] ||
    mappedBaseUrl ||
    readHttpUrlEnv({
      raw: context.env.FORMIO_BASE_URL,
      name: 'FORMIO_BASE_URL',
      onIgnored,
    });
  const baseUrl = declaredBaseUrl ? normalizeHttpUrl(declaredBaseUrl, 'baseUrl') : undefined;

  writeProjectEntry(
    cwd,
    {
      FORMIO_PROJECT_URL: projectUrl,
      ...(baseUrl && { FORMIO_BASE_URL: baseUrl }),
    },
    context.cacheDir
  );

  return ok(
    [
      `Project set for ${cwd}`,
      `Project URL: ${projectUrl}`,
      ...(baseUrl ? [`Base URL:    ${baseUrl}`] : []),
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
  // Carried through even though nothing resolves from it: a configured default is
  // a suggestion, and the caller most likely to have one (a desktop host that
  // prompted for it) is exactly the caller who should be told the value exists
  // rather than that nothing is configured.
  const defaultProjectUrl = readHttpUrlEnv({
    raw: context.env.FORMIO_DEFAULT_PROJECT_URL,
    name: 'FORMIO_DEFAULT_PROJECT_URL',
    onIgnored,
  });
  const resolution = resolveOrNull(cwd, context, {
    baseConfig: { baseUrl: envBaseUrl, projectUrl: envProjectUrl, defaultProjectUrl },
    onNote: (message) => notes.push(message),
  });

  if (!resolution) {
    // The resolver's own error carries the offer, but not this command's shape:
    // it names the project_set tool, and a shell caller has the bin instead. Same
    // suggestion, in the vocabulary of the caller who will act on it.
    const offer = defaultProjectUrl
      ? ` A default is configured (FORMIO_DEFAULT_PROJECT_URL): ${defaultProjectUrl} — confirm it with the user before persisting it.`
      : '';
    return notConfigured(
      `No Form.io project is configured for ${cwd}. Run: formio-mcp project set --project-url <url> --cwd ${cwd}${offer}`
    );
  }

  const { config: resolved, sources } = resolution;

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
      return `this shell’s environment (${variable}), which takes precedence over the mapping`;
    }
    if (source === 'mapping') {
      return `the working-directory mapping for ${cwd}`;
    }
    return `the default (${DEFAULT_BASE_URL}), because neither the environment nor the mapping supplied one for this project`;
  };
  const projectSource = describe(sources.projectUrl, 'FORMIO_PROJECT_URL');
  const baseSource = describe(sources.baseUrl, 'FORMIO_BASE_URL');
  // Collapsed on the rendered clauses, not on the source enums: two values can
  // both come from `environment` and still come from *different variables*, and
  // printing the project's clause alone then credits the base URL to
  // FORMIO_PROJECT_URL — the attribution DEPLOYMENT.md tells the agent to branch
  // on. Identical strings are the only case where one clause says everything.
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
        `Note:        the MCP server’s own environment is not visible from this shell. A FORMIO_PROJECT_URL set there takes precedence over this mapping, and a FORMIO_BASE_URL set there applies only where no base URL is mapped.`,
      ]
    : [];

  return ok(
    [
      `Project URL: ${resolved.projectUrl}`,
      `Base URL:    ${resolved.baseUrl}`,
      `Source:      ${source}`,
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
    if (error instanceof ProjectMapUnreadableError) {
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
