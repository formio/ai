import { ResolvedFormioConfig } from './config.js';
import {
  readToken,
  saveToken,
  clearToken,
  readCacheSnapshot,
  type CacheSnapshot,
} from './token-cache.js';
import { validateToken } from './token-validation.js';
import { isJwtExpired } from './token-expiry.js';
import { authenticate } from './auth.js';
import { requireBaseUrl } from './project-resolver.js';

// Keyed by baseUrl: one JWT is valid for every project on the same Form.io
// deployment, so caching per-project would over-partition.
const jwtCache = new Map<string, string>();
const pendingAuthByBaseUrl = new Map<string, Promise<void>>();
// The cache file as last read by the check below, reused while its stat is unchanged.
let diskSnapshot: CacheSnapshot | undefined;

// Whether the cache file still allows reusing `token` for `baseUrl`. Only an entry that
// is absent from a readable file — or a missing file — or that holds a different token
// discards it; a file that cannot be read says nothing about the token, so it is kept.
function diskAllowsReuse(baseUrl: string, token: string): boolean {
  diskSnapshot = readCacheSnapshot({ previous: diskSnapshot });
  const { tokens } = diskSnapshot;
  return tokens === undefined || tokens[baseUrl] === token;
}

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
  // reuse it blindly — and check the on-disk entry: `project logout` removes it
  // from another process, and a sign-in elsewhere replaces it, so a token the file
  // no longer holds is not reused. An unchanged entry needs no validation.
  const cached = jwtCache.get(baseUrl);
  if (cached) {
    if (diskAllowsReuse(baseUrl, cached) && !isJwtExpired(cached)) {
      config.jwt = cached;
      return;
    }
    // Expired, signed out, or replaced — drop it and fall through to the full auth
    // flow, which reads the cache again and validates whatever it now holds.
    jwtCache.delete(baseUrl);
    config.jwt = undefined;
  }

  // Single-flight per baseUrl: reuse an in-flight auth promise if one exists. That
  // flow writes the token onto the config that started it; every tool call resolves
  // its own config, so a caller that joins takes the token from the shared cache.
  const existing = pendingAuthByBaseUrl.get(baseUrl);
  if (existing) {
    await existing;
    config.jwt = jwtCache.get(baseUrl);
    return;
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
  diskSnapshot = undefined;
}

export function invalidateJwtCache(baseUrl: string): void {
  jwtCache.delete(baseUrl);
}
