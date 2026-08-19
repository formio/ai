import path from 'path';
import { z } from 'zod';
import {
  BASE_URL_UNRESOLVED_GUIDANCE,
  DEFAULT_BASE_URL,
  FormioConfig,
  ResolvedFormioConfig,
  PROJECT_URL_GUIDANCE,
  normalizeHttpUrl,
  stripTrailingSlashes,
} from './config.js';
import { ProjectMapUnreadableError, projectMapPath, readProjectEntry } from './project-map.js';
import {
  COMMITTED_CONFIG_FILE,
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
}

function missingProjectError({ cwd, mapCwd }: MissingProject): Error {
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
  return new Error(
    `No Form.io project is configured${where}, and no ${COMMITTED_CONFIG_FILE} was found by walking up from it. ` +
      `Ask the user for their Project URL, then call ${how}, or run: formio-mcp project set --project-url <project_url> --cwd ${cwd ?? mapCwd}. ` +
      `To record the target with the code instead — versioned, and shared with everyone who clones it — add a ${COMMITTED_CONFIG_FILE} holding {"projectUrl": "..."} in the application's own folder, or run the same command with --scope repo. ` +
      `${PROJECT_URL_GUIDANCE} FORMIO_PROJECT_URL in the server environment supplies one too, but it is the weakest source: a ${COMMITTED_CONFIG_FILE} or a mapping overrides it.`
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
export function requireBaseUrl(config: ResolvedFormioConfig): string {
  if (config.baseUrl) {
    return config.baseUrl;
  }
  throw new Error(
    `The Base URL for ${config.projectUrl} cannot be determined, so JWT authentication cannot proceed. ` +
      `${BASE_URL_UNRESOLVED_GUIDANCE} ` +
      `Guessing one would build the portal-login URL and key the cached token against a deployment you do not use. ` +
      `Set it with project_set (pass baseUrl alongside the cwd), or run: formio-mcp project set --base-url <base_url> --cwd <cwd>. ` +
      `The project itself is configured — only its Base URL is missing, so do not ask for the Project URL again. ` +
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
  // `candidates` because the two halves resolve independently — a committed
  // project can be paired with a mapped deployment — so one shared list would
  // attribute a shadowed deployment to whichever layer supplied the project.
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

interface MappedEnvRead {
  mapCwd: string;
  cacheDir?: string;
  tolerateUnreadable: boolean;
  onNote: (message: string) => void;
}

// A project URL's host tells us whether DEFAULT_BASE_URL can possibly be right.
// The hosted cloud is the only deployment whose base URL is a constant, and it
// is api.form.io for every project on it — so a project sub-domain of form.io
// implies it, and nothing else does.
function isHostedCloudProject(projectUrl: URL): boolean {
  return projectUrl.hostname === 'form.io' || projectUrl.hostname.endsWith('.form.io');
}

// A sub-directory-routed project URL is its deployment plus exactly ONE
// segment — the project's name — so the deployment is the project URL's parent,
// not its origin. Those coincide only for a single-segment path: a deployment
// mounted at https://forms.mysite.com/one serves project `two` at
// https://forms.mysite.com/one/two, and flattening that to the origin would
// build the portal login and ${baseUrl}/current against a host root that serves
// neither. Returns undefined when there is no path to take a parent of.
function deriveBaseUrlFromProjectPath(projectUrl: URL): string | undefined {
  const segments = projectUrl.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }
  const parentPath = segments.slice(0, -1).join('/');
  return stripTrailingSlashes(`${projectUrl.origin}${parentPath ? `/${parentPath}` : ''}`);
}

// Whether a project URL names its own deployment, and so needs nothing recorded.
// Asked by the two WRITERS — the project_set tool and `project set` — before they
// fall back to a global FORMIO_BASE_URL. That global is one value answering a
// per-project question: written into a mapping for a project that derives its own
// deployment, it replaces a per-project-correct answer with a stale one that then
// outranks derivation for that directory forever. api.form.io is the value most
// likely to be exported, which makes the failure a portal login sent to a
// deployment the user does not use — the exact substitution the shape rules exist
// to prevent.
//
// Answered by asking chooseBaseUrl itself, so "derivable" cannot drift from what
// resolution actually derives.
export function derivesOwnBaseUrl(projectUrl: string): boolean {
  return chooseBaseUrl(projectUrl, []).baseUrlSource === 'derived';
}

// Ordered candidates in, the winner and its provenance out. Precedence is stated
// once, at the call site, as the order of the list.
//
// The no-candidate case is decided by the shape of the project URL rather than
// by a constant. Three outcomes, and the third is the point: a path-less
// customer project URL leaves the base URL UNRESOLVED instead of silently
// becoming api.form.io. The deployment is a sibling sub-domain of the same
// parent domain, and nothing in the project URL names it — the one thing the
// server's own guidance already says must be asked for rather than derived.
function chooseBaseUrl(
  resolvedProjectUrl: string,
  candidates: ReadonlyArray<readonly [BaseUrlSource, string | undefined]>
): {
  baseUrl: string | undefined;
  baseUrlSource: BaseUrlSource;
} {
  const chosen = candidates.find(([, value]) => Boolean(value));
  if (chosen?.[1]) {
    return { baseUrl: chosen[1], baseUrlSource: chosen[0] };
  }

  let parsed: URL;
  try {
    parsed = new URL(resolvedProjectUrl);
  } catch {
    // Unparseable project URLs are rejected upstream by normalizeHttpUrl; if one
    // reaches here it is not a deployment we can name, so say so rather than
    // guess.
    return { baseUrl: undefined, baseUrlSource: 'unresolved' };
  }

  // Reported as DERIVED rather than defaulted. The hosted cloud is the one
  // deployment whose base URL is a constant, so naming it from a form.io host is a
  // derivation from the project URL like any other — and calling it a default
  // invited the reading the shape rules exist to remove, that the server guessed.
  if (isHostedCloudProject(parsed)) {
    return { baseUrl: DEFAULT_BASE_URL, baseUrlSource: 'derived' };
  }

  const derived = deriveBaseUrlFromProjectPath(parsed);
  return derived
    ? { baseUrl: derived, baseUrlSource: 'derived' }
    : { baseUrl: undefined, baseUrlSource: 'unresolved' };
}

// An unreadable project map is a real problem the caller has to hear about —
// reporting it as "nothing configured" sends them to project_set, whose rewrite
// is what destroys the surviving mappings. But that is only true where the map
// is the source of the project. When a pinned launch consults it purely as a
// base-URL fallback, an unreadable file means "no mapped base URL", which is the
// same answer as no mapping at all: resolution continues to the documented
// default rather than failing a call that never needed the file. The reason is
// still said out loud, because a broken map that nothing depends on today breaks
// every unpinned directory tomorrow.
// The two mapped values that are URLs. getConfig validates every URL it reads
// from the environment for exactly one reason — taken raw, an unusable value keys
// the token cache and builds the portal-login URL, and only surfaces much later as
// an opaque "Failed to parse URL" out of fetch — and a value read from
// ~/.formio/projects.json reaches the same places. That file is hand-editable and
// predates the validation, so the same rule applies to both sides.
const MAPPED_URL_KEYS: ReadonlyArray<string> = ['FORMIO_PROJECT_URL', 'FORMIO_BASE_URL'];

// Reported as an unreadable ENTRY, not as an unmapped directory: the value is
// there and it is wrong, so answering "nothing is configured" sends the caller to
// interview the user and call project_set, which is the rewrite that destroys the
// surviving mappings. The same distinction ProjectMapUnreadableError already draws
// for the file as a whole, drawn one level down.
function normalizeMappedUrls(
  env: Record<string, string>,
  { mapCwd, cacheDir }: { mapCwd: string; cacheDir?: string }
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => {
      if (!MAPPED_URL_KEYS.includes(key)) {
        return [key, value];
      }
      try {
        return [key, normalizeHttpUrl(value, key)];
      } catch (error) {
        throw new ProjectMapUnreadableError(
          projectMapPath(cacheDir),
          new Error(
            `the entry for ${mapCwd} holds an unusable ${key}: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    })
  );
}

function readMappedEnv({
  mapCwd,
  cacheDir,
  tolerateUnreadable,
  onNote,
}: MappedEnvRead): Record<string, string> | undefined {
  try {
    const env = readProjectEntry(mapCwd, cacheDir)?.env;
    // Normalized inside the same try: an entry whose URL is unusable is as good
    // as unreadable, so a pin that consults the map purely as a base-URL fallback
    // tolerates it on exactly the terms below.
    return env && normalizeMappedUrls(env, { mapCwd, cacheDir });
  } catch (error) {
    if (!tolerateUnreadable || !(error instanceof ProjectMapUnreadableError)) {
      throw error;
    }
    onNote(
      `${error.message}\nContinuing with the committed ${COMMITTED_CONFIG_FILE}, which supplies both URLs, so the map cannot change the answer.`
    );
    return undefined;
  }
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
  const committed: CommittedProjectConfig | undefined = findCommittedConfig(mapCwd);
  // An unreadable map is tolerated ONLY when nothing is left for it to decide —
  // a committed file supplying BOTH URLs. Otherwise it fails, and the reordering
  // is why: the mapping now outranks the environment for both halves, so skipping
  // it could resolve a lower-precedence value and target a project the unreadable
  // entry would have overridden. Under the old environment-first order the map
  // was strictly lower for the project URL, which made skipping safe; it is not
  // safe any more.
  const committedIsComplete = Boolean(committed?.projectUrl && committed?.baseUrl);
  const mappedEnv = readMappedEnv({
    mapCwd,
    cacheDir,
    tolerateUnreadable: committedIsComplete,
    onNote,
  });

  // Falsy, not nullish: an empty FORMIO_PROJECT_URL is an unanswered prompt, not
  // a pinned project.
  const projectCandidates: ReadonlyArray<readonly [ProjectUrlSource, string | undefined]> = [
    ['committed', committed?.projectUrl],
    ['mapping', mappedEnv?.FORMIO_PROJECT_URL],
    ['environment', envProjectUrl || undefined],
  ];
  const chosenProject = projectCandidates.find(([, value]) => Boolean(value));
  if (!chosenProject?.[1]) {
    throw missingProjectError({
      cwd: cwd || undefined,
      mapCwd,
    });
  }
  const [projectUrlSource, projectUrl] = chosenProject as readonly [ProjectUrlSource, string];

  // Said out loud for the same reason project_set warns on the write side: the
  // server's process cwd is fixed at spawn and, for a plugin- or desktop-launched
  // server, is not where the user is.
  if (!cwd && projectUrlSource !== 'environment') {
    onNote(
      `No cwd argument was passed, so the project was resolved from ${mapCwd}, the MCP server's own working directory. Pass cwd on every Form.io tool call to target the user's directory.`
    );
  }

  const normalizedProjectUrl = stripTrailingSlashes(projectUrl);
  // The base URL walks the identical order. Before this it resolved
  // mapping-first while the project URL resolved environment-first, so one pair
  // resolved in two directions; the borrow-the-mapped-base-URL special case
  // existed only to paper over that.
  const { baseUrl, baseUrlSource } = chooseBaseUrl(normalizedProjectUrl, [
    ['committed', committed?.baseUrl],
    ['mapping', mappedEnv?.FORMIO_BASE_URL],
    ['environment', baseConfig.baseUrl],
  ]);

  return {
    config: {
      ...baseConfig,
      baseUrl: baseUrl && stripTrailingSlashes(baseUrl),
      projectUrl: normalizedProjectUrl,
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
