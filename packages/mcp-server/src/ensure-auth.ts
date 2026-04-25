import { ResolvedFormioConfig } from './config.js';
import { readToken, saveToken, clearToken } from './token-cache.js';
import { validateToken } from './token-validation.js';
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
    config.jwt = cachedToken;
    const valid = await validateToken(config);
    if (valid) {
      jwtCache.set(config.baseUrl, cachedToken);
      return;
    }
    // Expired — clear and re-auth
    await clearToken(config.baseUrl);
    config.jwt = undefined;
  }

  // No valid token — login
  const jwt = await authenticate(config);
  config.jwt = jwt;
  await saveToken(config.baseUrl, jwt);
  jwtCache.set(config.baseUrl, jwt);
}

export async function ensureAuthenticated(config: ResolvedFormioConfig): Promise<void> {
  // Short-circuit: already authenticated in this process
  const cached = jwtCache.get(config.baseUrl);
  if (cached) {
    config.jwt = cached;
    return;
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
