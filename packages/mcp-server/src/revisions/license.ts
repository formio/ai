import { BASE_URL_UNRESOLVED_GUIDANCE, ResolvedFormioConfig } from '../config.js';
import { gateDisabledHistory, historyNotAccepted } from './history.js';
import { stripRevisions } from './helpers.js';
import { BaseUrlUnresolvedError, baseUrlWriteCommand } from '../project-resolver.js';
import { FormioNetworkError, ToolError } from '../tool-errors.js';
import { send } from '../formio-client.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';

// ─── License detection ──────────────────────────────────────────────────────
// Resolves the deployment's Security Module flag (`sac`) from the anonymous
// `/config.js`, cached per `baseUrl` — license is deployment-wide. A definite answer
// is kept for the life of the process; a probe that produced none is kept for
// UNKNOWN_LICENCE_TTL_MS, so a run of writes against a deployment that is not
// answering does not wait out the probe on every one, and is then asked again.
const UNKNOWN_LICENCE_TTL_MS = 60_000;

type CachedLicence = { licence: RevisionsLicence; expiresAt: number };

const revisionsLicensedByBaseUrl = new Map<string, CachedLicence>();

const SAC_PATTERN = /\bsac\s*=\s*(true|false)\b/i;

// Bounds the probe: an unattended hang here would hold every write behind it.
const LICENCE_PROBE_TIMEOUT_MS = 10_000;

type DefiniteLicence = { state: 'licensed' } | { state: 'unlicensed' };

/**
 * What the probe of `{baseUrl}/config.js` established. `unknown` means the probe ran
 * and produced no answer — no response, or an error status — and carries that failure
 * (NETWORK_ERROR or UPSTREAM_ERROR) naming the URL.
 */
export type RevisionsLicence = DefiniteLicence | { state: 'unknown'; failure: ToolError };

async function probeLicence(url: URL): Promise<RevisionsLicence> {
  try {
    const response = await send(url, { signal: AbortSignal.timeout(LICENCE_PROBE_TIMEOUT_MS) });
    if (!response.ok) {
      return {
        state: 'unknown',
        failure: new ToolError({
          code: 'UPSTREAM_ERROR',
          message: `the probe of ${url} was answered with status ${response.status}`,
        }),
      };
    }
    const body = await response.text();
    const match = body.match(SAC_PATTERN);
    return { state: match?.[1]?.toLowerCase() === 'true' ? 'licensed' : 'unlicensed' };
  } catch (error) {
    return {
      state: 'unknown',
      failure:
        error instanceof ToolError
          ? error
          : new FormioNetworkError({ url: url.toString(), cause: error }),
    };
  }
}

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

export interface LicenceCheckOptions {
  /** The clock an unknown answer's expiry is measured on, in milliseconds. */
  now?: () => number;
}

// Returns undefined when no base URL resolved: the flag is a property of the
// deployment and is fetched from it, so with no deployment URL there is nothing to
// ask, and reporting an answer would be a claim about a probe that never ran.
export async function checkRevisionsLicensed(
  cfg: ResolvedFormioConfig,
  { now = Date.now }: LicenceCheckOptions = {}
): Promise<RevisionsLicence | undefined> {
  if (!cfg.baseUrl) return undefined;
  const baseUrl = cfg.baseUrl;
  const cached = revisionsLicensedByBaseUrl.get(baseUrl);
  if (cached !== undefined && now() < cached.expiresAt) return cached.licence;

  const licence = await probeLicence(new URL('config.js', `${baseUrl.replace(/\/*$/, '/')}`));
  revisionsLicensedByBaseUrl.set(baseUrl, {
    licence,
    expiresAt: licence.state === 'unknown' ? now() + UNKNOWN_LICENCE_TTL_MS : Infinity,
  });
  return licence;
}

// The probe ran and produced no answer. Refused with the probe's own code — the
// deployment was unreachable or answered with an error — and never LICENSE_REQUIRED,
// which would be a claim about the licence that nothing established.
function licenceUnknown(failure: ToolError, actionLabel: string): ToolError {
  return new ToolError({
    code: failure.code,
    message: `Cannot ${actionLabel} — whether this Form.io deployment's licence includes form revisions could not be determined: ${failure.message}. Nothing was changed; retry once the deployment answers.`,
    cause: failure,
  });
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
 * revisions. Refuses with LICENSE_REQUIRED where it is not, with the Base URL remedy
 * where the licence cannot be read, and with the probe's own failure where the probe
 * produced no answer.
 */
export async function requireRevisionsLicense(
  cfg: ResolvedFormioConfig,
  actionLabel: string
): Promise<void> {
  const licence = await checkRevisionsLicensed(cfg);
  if (licence === undefined) {
    throw licenceUndetermined(cfg, actionLabel);
  }
  if (licence.state === 'unknown') {
    throw licenceUnknown(licence.failure, actionLabel);
  }
  if (licence.state === 'unlicensed') {
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

export interface RevisionsLicenseGateResult {
  /** True only when the deployment is definitely licensed. */
  licensed: boolean;
  /** True when the probe ran and produced no answer. */
  licenceUnknown?: boolean;
  form: Record<string, unknown>;
}

/**
 * The licence gate for standard creates and updates. On an unlicensed deployment the
 * save keeps no history, so it proceeds only with `acceptNoHistory: true`, and then
 * with `revisions` stripped. On a licensed one, a body that turns history off
 * (`revisions: ""`) needs the same acceptance. Where the probe produced no answer the
 * body is sent as the caller wrote it — never stripped, and never refused on the
 * licence's account — while a body turning history off still needs acceptance.
 */
export async function gateRevisionsLicense({
  cfg,
  actionLabel,
  form,
  acceptNoHistory,
}: RevisionsLicenseGateOptions): Promise<RevisionsLicenseGateResult> {
  const licence = await checkRevisionsLicensed(cfg);

  // Undetermined is not unlicensed. A form carrying a `revisions` setting must not
  // have it stripped on the strength of a probe that never ran. A form with no such
  // setting loses nothing — stripRevisions is a no-op on it — so an API-key write
  // proceeds rather than failing over a capability it never asked about, and is not
  // refused as unlicensed, because that would be a claim we cannot support.
  if (licence === undefined) {
    if ('revisions' in form) {
      throw licenceUndetermined(cfg, actionLabel);
    }
    return { licensed: false, form };
  }
  // The probe ran and produced no answer. Stripping or refusing would act on a licence
  // nothing established, so the body goes as written; only the caller's own choice to
  // turn history off is gated, exactly as it is where the licence is known.
  if (licence.state === 'unknown') {
    gateDisabledHistory({ form, acceptNoHistory });
    return { licensed: false, licenceUnknown: true, form };
  }
  if (licence.state === 'licensed') {
    gateDisabledHistory({ form, acceptNoHistory });
    return { licensed: true, form };
  }
  if (!acceptNoHistory) {
    throw historyNotAccepted({
      reason:
        "this Form.io deployment's licence does not include form revisions (the Security Module is required)",
      remedy: 'if they agree to save without history, retry with acceptNoHistory: true.',
    });
  }
  return { licensed: false, form: stripRevisions(form) };
}
