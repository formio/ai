import { BASE_URL_UNRESOLVED_GUIDANCE, ResolvedFormioConfig } from '../config.js';
import { gateDisabledHistory, historyNotAccepted } from './history.js';
import { stripRevisions } from './helpers.js';
import { BaseUrlUnresolvedError, baseUrlWriteCommand } from '../project-resolver.js';
import { ToolError } from '../tool-errors.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';

// ─── License detection ──────────────────────────────────────────────────────
// Resolves the deployment's Security Module flag (`sac`) from the anonymous
// `/config.js`. Cached per `baseUrl` — license is deployment-wide.
const revisionsLicensedByBaseUrl = new Map<string, boolean>();

const SAC_PATTERN = /\bsac\s*=\s*(true|false)\b/i;

// How to record the deployment, named for the record that holds this project — the
// same split `requireBaseUrl` makes. A committed file is edited by hand; the mapping
// and the environment have commands, and they are different commands.
function baseUrlRemedy(cfg: ResolvedFormioConfig): string {
  const cwd = cfg.cwd ?? process.cwd();
  if (cfg.projectUrlSource === 'committed') {
    return `Add "baseUrl": "<base_url>" beside "projectUrl" in ${cfg.committedFilePath ?? `the committed ${COMMITTED_CONFIG_FILE}`} — edit it directly; this server reads a committed file and never writes one`;
  }
  const source = cfg.projectUrlSource ?? 'mapping';
  return `Set it with project_set (pass baseUrl alongside the cwd${source === 'environment' ? ', with the projectUrl' : ''}), or run: ${baseUrlWriteCommand({ source, cwd, projectUrl: cfg.projectUrl })}`;
}

// Returns undefined — "cannot be determined" — when no base URL resolved, which
// is a third answer distinct from licensed and unlicensed. The flag is a property
// of the deployment and is fetched from it, so with no deployment URL there is
// nothing to ask; reporting `false` would be a claim about a probe that never ran.
export async function checkRevisionsLicensed(
  cfg: ResolvedFormioConfig
): Promise<boolean | undefined> {
  if (!cfg.baseUrl) return undefined;
  const baseUrl = cfg.baseUrl;
  const cached = revisionsLicensedByBaseUrl.get(baseUrl);
  if (cached !== undefined) return cached;

  let revisionsLicensed = false;
  try {
    const url = new URL('config.js', `${baseUrl.replace(/\/*$/, '/')}`);
    const response = await fetch(url);
    if (response.ok) {
      const body = await response.text();
      const match = body.match(SAC_PATTERN);
      revisionsLicensed = match?.[1]?.toLowerCase() === 'true';
    }
  } catch {
    revisionsLicensed = false;
  }

  revisionsLicensedByBaseUrl.set(baseUrl, revisionsLicensed);
  return revisionsLicensed;
}

// Why the licence cannot be read: the probe is a GET to the deployment, and no
// deployment resolved. Undetermined is not unlicensed, so this is raised only where
// the answer would change what happens.
function licenceUndetermined(
  cfg: ResolvedFormioConfig,
  actionLabel: string
): BaseUrlUnresolvedError {
  return new BaseUrlUnresolvedError(
    `Cannot ${actionLabel} — the Security Module flag is read from {baseUrl}/config.js, and the Base URL for ${cfg.projectUrl} cannot be determined, so that probe never ran. ` +
      `${BASE_URL_UNRESOLVED_GUIDANCE} ` +
      `This one is needed however you authenticate: the probe is an ANONYMOUS request to the deployment, so an API key does not exempt it. ` +
      // The write that reaches the record holding THIS project. The mapping's own
      // `--base-url` call is refused where the project lives in a committed file
      // or the environment, so naming it unconditionally named a command the
      // writer rejects — the failure `baseUrlWriteCommand` exists to prevent, in
      // the one message that did not use it.
      `${baseUrlRemedy(cfg)}. ` +
      `The project itself is configured — only its Base URL is missing, so do not ask for the Project URL again.`
  );
}

/**
 * Drafts, publishing and reverting exist only where the deployment is licensed for
 * revisions. Refuses with LICENSE_REQUIRED where it is not, and with the Base URL
 * remedy where the licence cannot be read.
 */
export async function requireRevisionsLicense(
  cfg: ResolvedFormioConfig,
  actionLabel: string
): Promise<void> {
  const licensed = await checkRevisionsLicensed(cfg);
  if (licensed === undefined) {
    throw licenceUndetermined(cfg, actionLabel);
  }
  if (!licensed) {
    throw new ToolError({
      code: 'LICENSE_REQUIRED',
      message: `Cannot ${actionLabel} — drafts, publishing and reverting need form revisions, which this Form.io deployment's licence does not include (the Security Module is required). To change the form, call form_update without draft: true.`,
    });
  }
}

export interface RevisionsLicenseGateOptions {
  cfg: ResolvedFormioConfig;
  actionLabel: string;
  form: Record<string, unknown>;
  acceptNoHistory?: boolean;
}

/**
 * The licence gate for standard creates and updates. On an unlicensed deployment the
 * save keeps no history, so it proceeds only with `acceptNoHistory: true`, and then
 * with `revisions` stripped. On a licensed one, a body that turns history off
 * (`revisions: ""`) needs the same acceptance. Returns the resolved licensed flag and
 * the body to send.
 */
export async function gateRevisionsLicense({
  cfg,
  actionLabel,
  form,
  acceptNoHistory,
}: RevisionsLicenseGateOptions): Promise<{ licensed: boolean; form: Record<string, unknown> }> {
  const licensed = await checkRevisionsLicensed(cfg);

  // Undetermined is not unlicensed. A form carrying a `revisions` setting must not
  // have it stripped on the strength of a probe that never ran. A form with no such
  // setting loses nothing — stripRevisions is a no-op on it — so an API-key write
  // proceeds rather than failing over a capability it never asked about, and is not
  // refused as unlicensed, because that would be a claim we cannot support.
  if (licensed === undefined) {
    if ('revisions' in form) {
      throw licenceUndetermined(cfg, actionLabel);
    }
    return { licensed: false, form };
  }
  if (licensed) {
    gateDisabledHistory({ form, acceptNoHistory });
    return { licensed, form };
  }
  if (!acceptNoHistory) {
    throw historyNotAccepted({
      reason:
        "this Form.io deployment's licence does not include form revisions (the Security Module is required)",
      remedy: 'if they agree to save without history, retry with acceptNoHistory: true.',
    });
  }
  return { licensed, form: stripRevisions(form) };
}
