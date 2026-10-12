import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureAuthenticated, resetAuthState } from '../ensure-auth.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('../token-cache.js', () => ({
  readToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
  readCacheSnapshot: vi.fn(),
}));

vi.mock('../token-validation.js', () => ({
  validateToken: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  authenticate: vi.fn(),
}));

import { readToken, saveToken, clearToken, readCacheSnapshot } from '../token-cache.js';
import { validateToken } from '../token-validation.js';
import { authenticate } from '../auth.js';

const mockReadToken = vi.mocked(readToken);
const mockSaveToken = vi.mocked(saveToken);
const mockClearToken = vi.mocked(clearToken);
const mockReadCacheSnapshot = vi.mocked(readCacheSnapshot);
const mockValidateToken = vi.mocked(validateToken);
const mockAuthenticate = vi.mocked(authenticate);

function makeJwt(expSecondsFromNow: number): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.sig`;
}

const BASE_URL = 'https://formio.invalid/sub';

// What the cache file holds for the deployment: the cold path reads it through
// readToken, the check before reusing an in-memory token through readCacheSnapshot.
function diskHolds(token: string | null): void {
  mockReadToken.mockResolvedValue(token);
  mockReadCacheSnapshot.mockReturnValue({
    fingerprint: { mtimeMs: 1, size: 1, ino: 1 },
    tokens: token === null ? {} : { [BASE_URL]: token },
  });
}

describe('ensureAuthenticated', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetAuthState();
  });

  it('sets config.jwt from a valid cached token without launching the login flow', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    mockReadToken.mockResolvedValue('cached-jwt');
    mockValidateToken.mockResolvedValue(true);

    await ensureAuthenticated(config);

    expect(config.jwt).toBe('cached-jwt');
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('launches the login flow when no cached token and no API key, then saves the new JWT', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    mockReadToken.mockResolvedValue(null);
    mockAuthenticate.mockResolvedValue('new-jwt');

    await ensureAuthenticated(config);

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(mockSaveToken).toHaveBeenCalledWith('https://formio.invalid/sub', 'new-jwt');
    expect(config.jwt).toBe('new-jwt');
  });

  it('clears the cached token and launches login when the cached token fails validation', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    mockReadToken.mockResolvedValue('expired-jwt');
    mockValidateToken.mockResolvedValue(false);
    mockAuthenticate.mockResolvedValue('fresh-jwt');

    await ensureAuthenticated(config);

    expect(mockClearToken).toHaveBeenCalledWith('https://formio.invalid/sub');
    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(config.jwt).toBe('fresh-jwt');
  });

  it('clears an expired cached disk token without a network validation call, then re-auths', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    mockReadToken.mockResolvedValue(makeJwt(-60));
    mockAuthenticate.mockResolvedValue('fresh-jwt');

    await ensureAuthenticated(config);

    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(mockClearToken).toHaveBeenCalledWith('https://formio.invalid/sub');
    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(config.jwt).toBe('fresh-jwt');
  });

  it('re-validates an in-process cached token and re-auths when it has expired mid-session', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    // First call: a still-valid JWT gets cached in-process.
    const validJwt = makeJwt(3600);
    mockReadToken.mockResolvedValue(validJwt);
    mockValidateToken.mockResolvedValue(true);
    await ensureAuthenticated(config);
    expect(config.jwt).toBe(validJwt);

    // Simulate the cached token having expired: reads now return an expired one.
    const second: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    // Seed the in-process cache with an expired token by going through a fresh flow.
    resetAuthState();
    mockReadToken.mockResolvedValue(makeJwt(-60));
    mockAuthenticate.mockResolvedValue('re-authed-jwt');

    await ensureAuthenticated(second);

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(second.jwt).toBe('re-authed-jwt');
  });

  it('is a no-op when an API key is configured — tool calls surface invalid keys via 401', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      apiKey: 'any-key',
    };

    await ensureAuthenticated(config);

    expect(mockReadToken).not.toHaveBeenCalled();
    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(config.jwt).toBeUndefined();
  });

  it('short-circuits subsequent calls for the same project from an in-process cache', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    diskHolds('cached-jwt');
    mockValidateToken.mockResolvedValue(true);

    await ensureAuthenticated(config);
    mockReadToken.mockClear();
    mockValidateToken.mockClear();

    const second: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    await ensureAuthenticated(second);

    // The on-disk entry is checked — it still holds the same token — and nothing else runs.
    expect(mockReadCacheSnapshot).toHaveBeenCalled();
    expect(mockReadToken).not.toHaveBeenCalled();
    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(second.jwt).toBe('cached-jwt');
  });

  // `project logout` removes the on-disk entry from another process; the running
  // server checks it before reusing the token it holds in memory.
  it('discards an in-memory token whose cache entry was removed, and runs the gate', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    diskHolds('cached-jwt');
    mockValidateToken.mockResolvedValue(true);
    await ensureAuthenticated(config);

    diskHolds(null);
    mockAuthenticate.mockResolvedValue('signed-in-again');
    const next: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    await ensureAuthenticated(next);

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(next.jwt).toBe('signed-in-again');
    expect(mockSaveToken).toHaveBeenCalledWith('https://formio.invalid/sub', 'signed-in-again');
  });

  it('discards an in-memory token whose cache entry changed, and validates the new entry', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    diskHolds('first-account');
    mockValidateToken.mockResolvedValue(true);
    await ensureAuthenticated(config);
    mockValidateToken.mockClear();

    // Signed in under another account from elsewhere: the file now holds its token.
    diskHolds('second-account');
    const next: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    await ensureAuthenticated(next);

    expect(mockValidateToken).toHaveBeenCalledOnce();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(next.jwt).toBe('second-account');

    // And the new token is the one reused from memory afterwards.
    mockValidateToken.mockClear();
    const after: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    await ensureAuthenticated(after);
    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(after.jwt).toBe('second-account');
  });

  // A file torn by a concurrent writer, or otherwise unreadable, says nothing about the
  // token: it is not a sign-out, so the token in memory is kept and no login starts.
  it('keeps the in-memory token when the cache file cannot be read', async () => {
    diskHolds('cached-jwt');
    mockValidateToken.mockResolvedValue(true);
    await ensureAuthenticated({ baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` });
    mockValidateToken.mockClear();

    mockReadToken.mockResolvedValue(null);
    mockReadCacheSnapshot.mockReturnValue({ fingerprint: { mtimeMs: 2, size: 9, ino: 2 } });
    const next: ResolvedFormioConfig = { baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` };
    await ensureAuthenticated(next);

    expect(next.jwt).toBe('cached-jwt');
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(mockClearToken).not.toHaveBeenCalled();
  });

  // The file is re-read only when it changed: each check hands the last snapshot back,
  // and readCacheSnapshot reuses it while the file's stat is unchanged.
  it('hands the previous snapshot back on each check', async () => {
    diskHolds('cached-jwt');
    mockValidateToken.mockResolvedValue(true);
    await ensureAuthenticated({ baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` });

    await ensureAuthenticated({ baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` });
    const first = mockReadCacheSnapshot.mock.results[0].value;
    await ensureAuthenticated({ baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` });

    expect(mockReadCacheSnapshot).toHaveBeenNthCalledWith(1, { previous: undefined });
    expect(mockReadCacheSnapshot).toHaveBeenNthCalledWith(2, { previous: first });
  });

  it('starts from no snapshot after resetAuthState()', async () => {
    diskHolds('cached-jwt');
    mockValidateToken.mockResolvedValue(true);
    await ensureAuthenticated({ baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` });
    await ensureAuthenticated({ baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` });

    resetAuthState();
    await ensureAuthenticated({ baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` });
    await ensureAuthenticated({ baseUrl: BASE_URL, projectUrl: `${BASE_URL}/example` });

    expect(mockReadCacheSnapshot).toHaveBeenLastCalledWith({ previous: undefined });
  });

  it('concurrent calls resolve via a single login flow', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    mockReadToken.mockResolvedValue(null);
    mockAuthenticate.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('shared-jwt'), 20))
    );

    await Promise.all([
      ensureAuthenticated(config),
      ensureAuthenticated(config),
      ensureAuthenticated(config),
    ]);

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(mockSaveToken).toHaveBeenCalledOnce();
    expect(config.jwt).toBe('shared-jwt');
  });

  // Every tool call resolves its own config object, so a caller that joins a login
  // already in flight must still end up holding the token on ITS object.
  it('gives every concurrent caller the new JWT on its own config object', async () => {
    const configFor = (): ResolvedFormioConfig => ({
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    });
    const callers = [configFor(), configFor(), configFor()];
    mockReadToken.mockResolvedValue(null);
    mockAuthenticate.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('shared-jwt'), 20))
    );

    await Promise.all(callers.map((caller) => ensureAuthenticated(caller)));

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(callers.map((caller) => caller.jwt)).toEqual(['shared-jwt', 'shared-jwt', 'shared-jwt']);
  });

  it('after rejection, a subsequent call retries fresh', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    mockReadToken.mockResolvedValue(null);
    mockAuthenticate
      .mockRejectedValueOnce(new Error('user cancelled'))
      .mockResolvedValueOnce('fresh-jwt');

    await expect(ensureAuthenticated(config)).rejects.toThrow('user cancelled');
    await ensureAuthenticated(config);

    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    expect(config.jwt).toBe('fresh-jwt');
  });

  it('resetAuthState() clears the internal pendingAuth reference', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    mockReadToken.mockResolvedValue(null);

    // Start a flow that never resolves
    let releaseAuth: (value: string) => void = () => {};
    mockAuthenticate.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseAuth = resolve;
        })
    );

    const first = ensureAuthenticated(config);
    // Yield so the first call registers its pending promise
    await new Promise((r) => setImmediate(r));

    resetAuthState();

    // A subsequent call should start its own flow, not wait on the cleared pending
    mockAuthenticate.mockResolvedValueOnce('second-jwt');
    await ensureAuthenticated(config);

    // authenticate called twice: once for the abandoned flow, once for the reset-and-retry flow
    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    expect(config.jwt).toBe('second-jwt');

    // Cleanup: release the first promise so it doesn't leak
    releaseAuth('stale-jwt');
    await first.catch(() => {});
  });
});
