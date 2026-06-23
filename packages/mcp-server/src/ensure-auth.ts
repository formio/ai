import { ResolvedFormioConfig } from './config.js';
import { readToken, saveToken, clearToken } from './token-cache.js';
import { validateToken } from './token-validation.js';
import { isJwtExpired } from './token-expiry.js';
import { authenticate } from './auth.js';

// Keyed by baseUrl: one JWT is valid for every project on the same Form.io
// deployment, so caching per-project would over-partition.
const jwtCache = new Map<string, string>();
const pendingAuthByBaseUrl = new Map<string, Promise<void>>();

async function runAuthFlow(config: ResolvedFormioConfig): Promise<void> {
  // API key mode: tool calls themselves will validate the key
  if (config.apiKey) {
    return;
  }

  // JWT mode: check cache
  const cachedToken = await readToken(config.baseUrl);

  if (cachedToken) {
    // Local expiry check first: a plainly-expired JWT is cleared without a
    // wasted network round-trip, avoiding the thrash of firing requests with a
    // token we already know is dead.
    if (isJwtExpired(cachedToken)) {
      await clearToken(config.baseUrl);
    } else {
      config.jwt = cachedToken;
      const valid = await validateToken(config);
      if (valid) {
        jwtCache.set(config.baseUrl, cachedToken);
        return;
      }
      // Rejected by the server (revoked, etc.) — clear and re-auth
      await clearToken(config.baseUrl);
      config.jwt = undefined;
    }
  }

  // No valid token — login
  const jwt = await authenticate(config);
  config.jwt = jwt;
  await saveToken(config.baseUrl, jwt);
  jwtCache.set(config.baseUrl, jwt);
}

export async function ensureAuthenticated(config: ResolvedFormioConfig): Promise<void> {
  // Short-circuit: already authenticated in this process. Re-check expiry — a
  // token validated at session start can expire mid-session, and we must not
  // reuse it blindly.
  const cached = jwtCache.get(config.baseUrl);
  if (cached) {
    if (!isJwtExpired(cached)) {
      config.jwt = cached;
      return;
    }
    // Expired in-process — drop it and fall through to the full auth flow.
    jwtCache.delete(config.baseUrl);
    config.jwt = undefined;
  }

  // Single-flight per baseUrl: reuse an in-flight auth promise if one exists
  const existing = pendingAuthByBaseUrl.get(config.baseUrl);
  if (existing) {
    return existing;
  }

  const pending = runAuthFlow(config).finally(() => {
    pendingAuthByBaseUrl.delete(config.baseUrl);
  });
  pendingAuthByBaseUrl.set(config.baseUrl, pending);

  return pending;
}

export function resetAuthState(): void {
  jwtCache.clear();
  pendingAuthByBaseUrl.clear();
}

export function invalidateJwtCache(baseUrl: string): void {
  jwtCache.delete(baseUrl);
}
