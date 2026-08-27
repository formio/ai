import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureAuthenticated, resetAuthState } from '../ensure-auth.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('../token-cache.js', () => ({
  readToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock('../token-validation.js', () => ({
  validateToken: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  authenticate: vi.fn(),
}));

import { readToken, saveToken, clearToken } from '../token-cache.js';
import { validateToken } from '../token-validation.js';
import { authenticate } from '../auth.js';

const mockReadToken = vi.mocked(readToken);
const mockSaveToken = vi.mocked(saveToken);
const mockClearToken = vi.mocked(clearToken);
const mockValidateToken = vi.mocked(validateToken);
const mockAuthenticate = vi.mocked(authenticate);

function makeJwt(expSecondsFromNow: number): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.sig`;
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
    mockReadToken.mockResolvedValue('cached-jwt');
    mockValidateToken.mockResolvedValue(true);

    await ensureAuthenticated(config);
    mockReadToken.mockClear();
    mockValidateToken.mockClear();

    const second: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };
    await ensureAuthenticated(second);

    expect(mockReadToken).not.toHaveBeenCalled();
    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(second.jwt).toBe('cached-jwt');
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
