import { ResolvedFormioConfig } from './config.js';
import { readToken, saveToken, clearToken } from './token-cache.js';
import { validateToken } from './token-validation.js';
import { isJwtExpired } from './token-expiry.js';
import { authenticate } from './auth.js';
import { requireBaseUrl } from './project-resolver.js';

// Keyed by baseUrl: one JWT is valid for every project on the same Form.io
// deployment, so caching per-project would over-partition.
const jwtCache = new Map<string, string>();
const pendingAuthByBaseUrl = new Map<string, Promise<void>>();

async function runAuthFlow(config: ResolvedFormioConfig): Promise<void> {
  // API key mode: tool calls themselves will validate the key. Ordered ahead of
  // every baseUrl read on purpose — an API-key deployment authenticates without
  // a deployment URL, so requiring one here would fail calls over a value this
  // path never touches.
  if (config.apiKey) {
    return;
  }

  // JWT mode needs a deployment: the cache is keyed by it, the login form is
  // probed under it, and /current is fetched from it. Demanded once, here, so
  // the four reads below cannot each invent their own fallback.
  const baseUrl = requireBaseUrl(config);

  // JWT mode: check cache
  const cachedToken = await readToken(baseUrl);

  if (cachedToken) {
    // Local expiry check first: a plainly-expired JWT is cleared without a
    // wasted network round-trip, avoiding the thrash of firing requests with a
    // token we already know is dead.
    if (isJwtExpired(cachedToken)) {
      await clearToken(baseUrl);
    } else {
      config.jwt = cachedToken;
      const valid = await validateToken({ ...config, baseUrl });
      if (valid) {
        jwtCache.set(baseUrl, cachedToken);
        return;
      }
      // Rejected by the server (revoked, etc.) — clear and re-auth
      await clearToken(baseUrl);
      config.jwt = undefined;
    }
  }

  // No valid token — login
  const jwt = await authenticate(config);
  config.jwt = jwt;
  await saveToken(baseUrl, jwt);
  jwtCache.set(baseUrl, jwt);
}

export async function ensureAuthenticated(config: ResolvedFormioConfig): Promise<void> {
  // Before any baseUrl read, for the same reason runAuthFlow checks it first:
  // this lookup used to key the in-process cache on config.baseUrl, so an
  // API-key deployment with no deployment URL touched the value on every call.
  if (config.apiKey) {
    return;
  }

  const baseUrl = requireBaseUrl(config);

  // Short-circuit: already authenticated in this process. Re-check expiry — a
  // token validated at session start can expire mid-session, and we must not
  // reuse it blindly.
  const cached = jwtCache.get(baseUrl);
  if (cached) {
    if (!isJwtExpired(cached)) {
      config.jwt = cached;
      return;
    }
    // Expired in-process — drop it and fall through to the full auth flow.
    jwtCache.delete(baseUrl);
    config.jwt = undefined;
  }

  // Single-flight per baseUrl: reuse an in-flight auth promise if one exists
  const existing = pendingAuthByBaseUrl.get(baseUrl);
  if (existing) {
    return existing;
  }

  const pending = runAuthFlow(config).finally(() => {
    pendingAuthByBaseUrl.delete(baseUrl);
  });
  pendingAuthByBaseUrl.set(baseUrl, pending);

  return pending;
}

export function resetAuthState(): void {
  jwtCache.clear();
  pendingAuthByBaseUrl.clear();
}

export function invalidateJwtCache(baseUrl: string): void {
  jwtCache.delete(baseUrl);
}
