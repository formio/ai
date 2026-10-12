import { FormioConfig } from './config.js';
import { getAuthHeader } from './auth-header.js';
import { send } from './formio-client.js';

/** How long the 401 check waits on `/current` before treating the token as refused. */
export const CURRENT_CHECK_TIMEOUT_MS = 10_000;

// baseUrl is required here and the type cannot say so: FormioConfig leaves it
// optional, and template interpolation would happily fetch "undefined/current"
// rather than fail — the one place an absent deployment URL becomes a request
// instead of an error. Checked explicitly for that reason.
function currentUrl(config: FormioConfig): URL {
  if (!config.baseUrl) {
    throw new Error(
      'Checking a token against /current requires a resolved Base URL; the auth path must call requireBaseUrl first.'
    );
  }
  return new URL(`${config.baseUrl}/current`);
}

interface CurrentRequest {
  url: URL;
  config: FormioConfig;
  timeoutMs?: number;
}

// The one `/current` request both checks send: the config's credential, and a
// redirect not followed, since following it would carry the token to wherever it
// points. A request that gets no response is a NETWORK_ERROR naming the cause and
// URL, as every other Form.io request reports it.
function requestCurrent({ url, config, timeoutMs }: CurrentRequest): Promise<Response> {
  return send(url, {
    headers: getAuthHeader(config),
    redirect: 'manual',
    timeoutMs: timeoutMs ?? config.requestTimeoutMs,
  });
}

export async function validateToken(config: FormioConfig): Promise<boolean> {
  const response = await requestCurrent({ url: currentUrl(config), config });
  return response.ok;
}

/** What `/current` said of a token: still accepted, and for which account, or not. */
export type CurrentUserCheck = { accepted: true; account?: string } | { accepted: false };

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// The account `/current` describes: its email, else its `_id`.
function accountName(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const { data, _id } = body as { data?: unknown; _id?: unknown };
  const email =
    typeof data === 'object' && data !== null
      ? nonEmptyString((data as { email?: unknown }).email)
      : undefined;
  return email ?? nonEmptyString(_id);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Whether the deployment still accepts the config's token. Only a 2xx counts: a
 * refusal, a redirect, a timeout or no response at all is "not accepted", because
 * a wrong "still valid" would leave a user behind a refusal no login can clear.
 */
export async function checkCurrentUser(config: FormioConfig): Promise<CurrentUserCheck> {
  const url = currentUrl(config);
  try {
    const response = await requestCurrent({ url, config, timeoutMs: CURRENT_CHECK_TIMEOUT_MS });
    if (!response.ok) {
      return { accepted: false };
    }
    return { accepted: true, account: accountName(await readJson(response)) };
  } catch {
    return { accepted: false };
  }
}
