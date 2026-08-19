import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResolvedFormioConfig } from '../config.js';
import {
  requestRevisionsLicenseConsent,
  RevisionsLicenseConsentChoice,
} from './browser-prompts.js';
import { stripRevisions } from './helpers.js';
import { requireBaseUrl } from '../project-resolver.js';

// ─── License detection ──────────────────────────────────────────────────────
// Resolves the deployment's Security Module flag (`sac`) from the anonymous
// `/config.js`. Cached per `baseUrl` — license is deployment-wide.
const revisionsLicensedByBaseUrl = new Map<string, boolean>();

const SAC_PATTERN = /\bsac\s*=\s*(true|false)\b/i;

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

// ─── Persistent consent store ───────────────────────────────────────────────
// `~/.formio/revisions-license-consent.json`, keyed by `baseUrl`. Only
// positive consent ("continue") is persisted; cancel is transient.
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const CACHE_FILE = 'revisions-license-consent.json';

async function readCache(cacheDir: string): Promise<Record<string, true>> {
  const filePath = path.join(cacheDir, CACHE_FILE);
  try {
    const contents = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(contents) as Record<string, unknown>;
    const result: Record<string, true> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === true) result[k] = true;
    }
    return result;
  } catch {
    return {};
  }
}

async function writeCache(cacheDir: string, data: Record<string, true>): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, CACHE_FILE);
  await fs.writeFile(filePath, JSON.stringify(data), { mode: 0o600 });
}

async function readRevisionsLicenseConsent(
  baseUrl: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<boolean> {
  const data = await readCache(cacheDir);
  return data[baseUrl] === true;
}

async function saveRevisionsLicenseConsent(
  baseUrl: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): Promise<void> {
  const data = await readCache(cacheDir);
  data[baseUrl] = true;
  await writeCache(cacheDir, data);
}

// ─── In-memory consent layered over the persistent store ───────────────────
// Lookup order: memory → disk → prompt.
const revisionsLicenseConsentByBaseUrl = new Map<string, RevisionsLicenseConsentChoice>();

export async function getRevisionsLicenseConsent(
  server: McpServer,
  cfg: ResolvedFormioConfig,
  actionLabel: string
): Promise<RevisionsLicenseConsentChoice> {
  // Only reachable once the license resolved to false, which requires a base URL
  // to have been probed — an undetermined license returns before this. Narrowed
  // through the same guard so the invariant is enforced rather than assumed.
  const baseUrl = requireBaseUrl(cfg);
  const cached = revisionsLicenseConsentByBaseUrl.get(baseUrl);
  if (cached) return cached;

  if (await readRevisionsLicenseConsent(baseUrl)) {
    revisionsLicenseConsentByBaseUrl.set(baseUrl, 'continue');
    return 'continue';
  }

  const supportsElicitation = Boolean(server.server.getClientCapabilities()?.elicitation);
  let choice: RevisionsLicenseConsentChoice;
  if (supportsElicitation) {
    const result = await server.server.elicitInput({
      message: `Form revisions are not available on this Form.io deployment (the Security Module is required on the license). You can still ${actionLabel}, but history will not be saved. Continue?`,
      requestedSchema: {
        type: 'object',
        properties: {
          choice: {
            type: 'string',
            title: 'How to proceed',
            enum: ['continue', 'cancel'],
            enumNames: [
              'Continue without revision tracking (remembered for this deployment across future sessions)',
              'Cancel',
            ],
          },
        },
        required: ['choice'],
      },
    });
    if (result.action !== 'accept' || !result.content?.choice) {
      choice = 'cancel';
    } else {
      choice = result.content.choice === 'continue' ? 'continue' : 'cancel';
    }
  } else {
    // TEMPORARY: browser-consent fallback for MCP clients that do not yet support elicitation.
    choice = await requestRevisionsLicenseConsent(baseUrl, actionLabel);
  }

  // Only cache positive consent — cancel is transient so users can change their mind.
  if (choice === 'continue') {
    revisionsLicenseConsentByBaseUrl.set(baseUrl, choice);
    await saveRevisionsLicenseConsent(baseUrl);
  }
  return choice;
}

// Prompts the user if they want to proceed when revisions are not enabled on the license
export async function confirmProceedWithoutRevisions(
  server: McpServer,
  cfg: ResolvedFormioConfig,
  actionLabel: string
): Promise<void> {
  const consent = await getRevisionsLicenseConsent(server, cfg, actionLabel);
  if (consent === 'cancel') {
    throw new Error(
      `USER CANCELLED. The user explicitly chose to cancel: ${actionLabel}. Do NOT retry. Do NOT suggest workarounds, alternative projects, or enabling the Security Module. Do NOT offer to switch deployments. Simply acknowledge the cancellation to the user in one short sentence and stop. The user is aware of why they cancelled.`
    );
  }
}

// Top-level license gate. Throws when the action requires revisions on an
// unlicensed deployment; otherwise prompts for "continue without history"
// consent when unlicensed. Returns the resolved licensed flag and the form
// body with `revisions` stripped when unlicensed (passthrough when licensed).
export async function gateRevisionsLicense(
  server: McpServer,
  cfg: ResolvedFormioConfig,
  {
    actionLabel,
    requiresRevisions,
    form,
  }: { actionLabel: string; requiresRevisions: boolean; form: Record<string, unknown> }
): Promise<{ licensed: boolean; form: Record<string, unknown> }> {
  const licensed = await checkRevisionsLicensed(cfg);

  // Undetermined is not unlicensed. Demand the Base URL only where the answer
  // would change what we do: an explicit draft/publish/revert needs the license
  // to be real, and a form carrying a `revisions` setting must not have it
  // stripped on the strength of a probe that never ran. A form with no such
  // setting loses nothing — stripRevisions is a no-op on it — so an API-key
  // write proceeds rather than failing over a capability it never asked about,
  // and no consent is requested, because claiming the deployment is unlicensed
  // would be a statement we cannot support.
  if (licensed === undefined) {
    if (requiresRevisions || 'revisions' in form) {
      requireBaseUrl(cfg);
    }
    return { licensed: false, form };
  }

  if (!licensed && requiresRevisions) {
    throw new Error(
      `Cannot ${actionLabel} — the Security Module is required to use revisions, so drafts, publishes, and reverts are unavailable. Drop the draft/publish/revert flag and call form_update as a standard update to apply your changes.`
    );
  }
  // for standard creates/updates, confirm with the user that they don't care if history is not preserved
  if (!licensed) {
    await confirmProceedWithoutRevisions(server, cfg, actionLabel);
  }
  return { licensed, form: licensed ? form : stripRevisions(form) };
}
