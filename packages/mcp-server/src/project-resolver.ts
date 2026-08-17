import path from 'path';
import { z } from 'zod';
import {
  DEFAULT_BASE_URL,
  FormioConfig,
  ResolvedFormioConfig,
  normalizeHttpUrl,
  stripTrailingSlashes,
} from './config.js';
import { ProjectMapUnreadableError, projectMapPath, readProjectEntry } from './project-map.js';

const CWD_DESCRIPTION =
  "User's current working directory as an absolute path. Selects the Form.io project mapped to that directory in ~/.formio/projects.json — call project_set to create the mapping. Pass it on every call whenever you know it: omitting it resolves against the MCP server's own working directory, which is fixed at spawn and may be a different directory mapped to a different project. Only a FORMIO_PROJECT_URL set in the server environment makes it unnecessary, because that pin takes precedence over every mapping.";

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

// The only configuration guidance a stand-alone server can give, so it names
// the base URL too: omitting it defaults to api.form.io, which builds the login
// URL and would send a self-hosted user to the wrong deployment.
interface MissingProject {
  cwd: string | undefined;
  mapCwd: string;
  suggested?: string;
}

function missingProjectError({ cwd, mapCwd, suggested }: MissingProject): Error {
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
  // A configured default is offered here rather than applied during resolution:
  // the agent must confirm it and persist it, so nothing is written to a project
  // the user did not choose for this directory.
  const offer = suggested
    ? ` A default is configured (FORMIO_DEFAULT_PROJECT_URL): ${suggested} — the suggested project. Confirm it with the user before using it, then persist it with the same call.`
    : '';
  return new Error(
    `No Form.io project is configured${where}. Ask the user for their Project URL and Base URL, then call ${how} (pass baseUrl too — it defaults to ${DEFAULT_BASE_URL}, which is wrong for a self-hosted deployment and is what the login URL is built from).${offer} Setting FORMIO_PROJECT_URL and FORMIO_BASE_URL in the server environment works as well.`
  );
}

// Where each half of the answer came from. Derived here because this is the only
// code that knows: a reader comparing the resolved value against the mapping
// cannot tell "the mapping supplied it" from "the mapping happened to hold the
// same string", and https://api.form.io is the value most likely to collide.
export type ProjectUrlSource = 'environment' | 'mapping';
export type BaseUrlSource = 'environment' | 'mapping' | 'default';

export interface ProjectResolution {
  config: ResolvedFormioConfig;
  sources: {
    projectUrl: ProjectUrlSource;
    baseUrl: BaseUrlSource;
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

// Ordered candidates in, the winner and its provenance out. Precedence is stated
// once, at the call site, as the order of the list.
function chooseBaseUrl(candidates: ReadonlyArray<readonly [BaseUrlSource, string | undefined]>): {
  baseUrl: string;
  baseUrlSource: BaseUrlSource;
} {
  const chosen = candidates.find(([, value]) => Boolean(value));
  return chosen?.[1]
    ? { baseUrl: chosen[1], baseUrlSource: chosen[0] }
    : { baseUrl: DEFAULT_BASE_URL, baseUrlSource: 'default' };
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
    onNote(`${error.message}\nContinuing with the pinned FORMIO_PROJECT_URL.`);
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

// Precedence: an explicit FORMIO_PROJECT_URL from the environment wins, then the
// per-cwd mapping, then an actionable error. Environment-first keeps a pinned
// launch (CI, a hosted runner, an .mcp.json with an explicit project)
// deterministic even when a stale mapping exists for the same directory.
// Precedence stays defined here for every caller.
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
  // read back: the next tool call said "no project configured", whose remedy is
  // project_set, which writes the identical unreadable entry again.
  const mapCwd = cwd || process.cwd();
  // Read only where it can change the answer. A pin carrying its own base URL
  // needs nothing from the map, and reading it there turned an unreadable
  // ~/.formio/projects.json into a hard failure of a launch that never depended
  // on the file — exactly the determinism this module promises above.
  const mappedEnv =
    envProjectUrl && baseConfig.baseUrl
      ? undefined
      : readMappedEnv({ mapCwd, cacheDir, tolerateUnreadable: Boolean(envProjectUrl), onNote });

  // Falsy, not nullish, and deliberately the same test as the line above: an
  // empty FORMIO_PROJECT_URL is an unanswered prompt, not a pinned project, and
  // treating it as one would discard the mapping and leave project_set with no
  // way to fix it.
  const projectUrl = envProjectUrl || mappedEnv?.FORMIO_PROJECT_URL;
  if (!projectUrl) {
    throw missingProjectError({
      cwd: cwd || undefined,
      mapCwd,
      suggested: baseConfig.defaultProjectUrl,
    });
  }
  // Said out loud for the same reason project_set warns on the write side: the
  // server's process cwd is fixed at spawn and, for a plugin- or desktop-launched
  // server, is not where the user is. Nothing else can surface this — an omitted
  // cwd and a cwd that happens to match are indistinguishable from here — so a
  // resolution against the wrong directory's project is otherwise silent.
  if (!cwd && !envProjectUrl) {
    onNote(
      `No cwd argument was passed, so the project was resolved from the mapping for ${mapCwd}, the MCP server's own working directory. Pass cwd on every Form.io tool call to target the user's directory.`
    );
  }

  // Which side wins depends on which side supplied the project. When the mapping
  // did, its base URL travels with it and outranks the environment global. When
  // the environment pinned the project, an explicit FORMIO_BASE_URL is part of
  // that pin and stands — and a pin carrying no base URL may borrow the mapped
  // one, but ONLY when the mapping names the very project that was pinned.
  // A base URL belongs to a deployment, not to a directory: lending
  // https://forms.mysite.com to a pinned https://examples.form.io would send the
  // portal login to a self-hosted host for a hosted project and cache the token
  // under that host's key — the same silent wrong-host failure as defaulting a
  // self-hosted pin to api.form.io, arrived at from the other side.
  // getConfig leaves baseUrl undefined when the environment named none, so the
  // default is applied last, once both have been consulted.
  const mappedProjectUrl = mappedEnv?.FORMIO_PROJECT_URL;
  const mappedBaseAppliesToPin =
    envProjectUrl !== undefined &&
    mappedProjectUrl !== undefined &&
    stripTrailingSlashes(envProjectUrl) === stripTrailingSlashes(mappedProjectUrl);
  const borrowableMappedBaseUrl =
    !envProjectUrl || mappedBaseAppliesToPin ? mappedEnv?.FORMIO_BASE_URL : undefined;
  const { baseUrl, baseUrlSource } = chooseBaseUrl(
    envProjectUrl
      ? [
          ['environment', baseConfig.baseUrl],
          ['mapping', borrowableMappedBaseUrl],
        ]
      : [
          ['mapping', borrowableMappedBaseUrl],
          ['environment', baseConfig.baseUrl],
        ]
  );

  return {
    config: {
      ...baseConfig,
      baseUrl: stripTrailingSlashes(baseUrl),
      projectUrl: stripTrailingSlashes(projectUrl),
    },
    sources: {
      projectUrl: envProjectUrl ? 'environment' : 'mapping',
      baseUrl: baseUrlSource,
    },
  };
}
