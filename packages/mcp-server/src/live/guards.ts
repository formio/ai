/**
 * The live runner's decisions, kept pure so the default suite can test them without a
 * deployment: whether the resolved project may be used at all, which registered tools
 * have no live case, and what a run must delete and restore when it ends.
 */

export const LIVE_TARGET_VARIABLE = 'FORMIO_LIVE_TEST_PROJECT';

export type LiveTargetCheck = { ok: true; projectUrl: string } | { ok: false; message: string };

const withoutTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * A live run creates and deletes forms, roles, and version tags, so it may only run
 * against the one project the person running it named. The resolved Project URL must
 * equal that allowlisted URL exactly; a folder mapping that has drifted to a real
 * project then refuses instead of writing to it.
 */
export function checkLiveTarget({
  resolvedProjectUrl,
  allowedProjectUrl,
}: {
  resolvedProjectUrl: string | undefined;
  allowedProjectUrl: string | undefined;
}): LiveTargetCheck {
  if (!allowedProjectUrl) {
    return {
      ok: false,
      message: `${LIVE_TARGET_VARIABLE} is not set. Set it to the Project URL of a throwaway project; the live run creates and deletes forms, roles, and version tags there.`,
    };
  }
  if (!resolvedProjectUrl) {
    return {
      ok: false,
      message: `The repository folder resolves to no project. Record one with project_set (or set FORMIO_PROJECT_URL) and set ${LIVE_TARGET_VARIABLE} to the same URL.`,
    };
  }
  const resolved = withoutTrailingSlash(resolvedProjectUrl);
  const allowed = withoutTrailingSlash(allowedProjectUrl);
  if (resolved !== allowed) {
    return {
      ok: false,
      message: `The repository folder resolves to ${resolved}, but ${LIVE_TARGET_VARIABLE} allows only ${allowed}. Nothing was called; point the folder at the allowed project or change ${LIVE_TARGET_VARIABLE}.`,
    };
  }
  return { ok: true, projectUrl: resolved };
}

/** Registered tools that no live case exercises, sorted for a stable report. */
export function coverageGaps({
  registered,
  covered,
}: {
  registered: readonly string[];
  covered: readonly string[];
}): string[] {
  const exercised = new Set(covered);
  return registered.filter((tool) => !exercised.has(tool)).sort();
}

/**
 * A per-run prefix every created entity carries, so clean-up can find exactly what the
 * run made. Lowercase letters and digits only: it is used in form names and paths.
 */
export function runPrefix(now: Date): string {
  return `mcplive${now
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)}`;
}

export interface CleanupInput {
  prefix: string;
  forms: ReadonlyArray<{ _id: string; name?: string; path?: string }>;
  roles: ReadonlyArray<{ _id: string; title?: string }>;
  tags: ReadonlyArray<{ _id: string; tag?: string; chunk?: boolean }>;
  /** The project's version before the run started. */
  originalTag: string | undefined;
  /** The project's version now. */
  currentTag: string | undefined;
}

export interface CleanupPlan {
  deleteForms: string[];
  deleteRoles: string[];
  /** Main tag documents only: deleting one removes its chunk documents too. */
  deleteTags: string[];
  /** Set when the run moved the project's version and it must be put back. */
  restoreTag: string | undefined;
}

export function cleanupPlan({
  prefix,
  forms,
  roles,
  tags,
  originalTag,
  currentTag,
}: CleanupInput): CleanupPlan {
  const carriesPrefix = (value: string | undefined): boolean =>
    typeof value === 'string' && value.toLowerCase().includes(prefix);
  return {
    deleteForms: forms
      .filter((form) => carriesPrefix(form.name) || carriesPrefix(form.path))
      .map((form) => form._id),
    deleteRoles: roles.filter((role) => carriesPrefix(role.title)).map((role) => role._id),
    deleteTags: tags.filter((tag) => !tag.chunk && carriesPrefix(tag.tag)).map((tag) => tag._id),
    restoreTag: originalTag !== undefined && currentTag !== originalTag ? originalTag : undefined,
  };
}

const SYSTEM_CA_FLAG = '--use-system-ca';

/**
 * Node flags that make TLS trust the operating system's certificate store as well as
 * Node's bundled CAs: `--use-system-ca` when this Node accepts it, otherwise none.
 * Verification stays on; a deployment whose certificate the OS already trusts — a
 * local `*.test` host in the macOS keychain, for example — then works without
 * FORMIO_INSECURE_TLS.
 */
export function systemCaArgs(allowedFlags: ReadonlySet<string>): string[] {
  return allowedFlags.has(SYSTEM_CA_FLAG) ? [SYSTEM_CA_FLAG] : [];
}
