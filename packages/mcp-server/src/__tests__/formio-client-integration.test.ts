/**
 * Integration tests: formioFetch + ensureAuthenticated running together.
 * Leaf dependencies (auth, token-cache, token-validation, fetch) are mocked.
 * ensure-auth is NOT mocked — the real single-flight logic runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formioFetch } from '../formio-client.js';
import { resetAuthState } from '../ensure-auth.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('../auth.js', () => ({ authenticate: vi.fn() }));
vi.mock('../token-cache.js', () => ({
  readToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
  readCacheSnapshot: vi.fn(),
}));
vi.mock('../token-validation.js', () => ({ validateToken: vi.fn(), checkCurrentUser: vi.fn() }));

import { authenticate } from '../auth.js';
import { clearToken, readCacheSnapshot, readToken, saveToken } from '../token-cache.js';
import { checkCurrentUser, validateToken } from '../token-validation.js';
import { toolErrorDetails } from '../tool-errors.js';

const mockAuthenticate = vi.mocked(authenticate);
const mockReadToken = vi.mocked(readToken);
const mockSaveToken = vi.mocked(saveToken);
const mockClearToken = vi.mocked(clearToken);
const mockReadCacheSnapshot = vi.mocked(readCacheSnapshot);
const mockValidateToken = vi.mocked(validateToken);
const mockCheckCurrentUser = vi.mocked(checkCurrentUser);

describe('formioFetch + ensureAuthenticated integration', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.resetAllMocks();
    resetAuthState();
  });

  it('two concurrent first-time calls trigger exactly one authenticate and one saveToken', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };

    mockReadToken.mockResolvedValue(null);
    // authenticate takes 20ms so both calls overlap
    mockAuthenticate.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('shared-jwt'), 20))
    );
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: 'ok' }) });

    const [result1, result2] = await Promise.all([
      formioFetch('/form', {}, config),
      formioFetch('/form', {}, config),
    ]);

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    expect(mockSaveToken).toHaveBeenCalledOnce();
    expect(result1).toEqual({ result: 'ok' });
    expect(result2).toEqual({ result: 'ok' });
  });

  it('a 401 re-auth concurrent with a second call triggers authenticate exactly once', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };

    // Disk has an initial token that passes validation.
    // After the 401 clears it, subsequent readToken calls return null.
    mockReadToken.mockResolvedValueOnce('initial-jwt').mockResolvedValue(null);
    mockValidateToken.mockResolvedValueOnce(true);
    // The deployment no longer accepts the token, so the 401 is an expired session.
    mockCheckCurrentUser.mockResolvedValue({ accepted: false });

    // re-auth takes 20ms so concurrent second call overlaps
    mockAuthenticate.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('refreshed-jwt'), 20))
    );

    // Call A: 401 then success on retry. Call B: success immediately.
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: 'ok' }) });

    const [result1, result2] = await Promise.all([
      formioFetch('/form', {}, config),
      // Small delay so call B fires while call A is in re-auth
      new Promise<unknown>((resolve) =>
        setTimeout(() => resolve(formioFetch('/form', {}, config)), 5)
      ),
    ]);

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    // /current was asked about the refused token, and refused it, before any login.
    expect(mockCheckCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ jwt: 'initial-jwt' })
    );
    expect(mockCheckCurrentUser.mock.invocationCallOrder[0]).toBeLessThan(
      mockAuthenticate.mock.invocationCallOrder[0]
    );
    expect(result1).toEqual({ result: 'ok' });
    expect(result2).toEqual({ result: 'ok' });
  });

  // Each tool call resolves its own config. Two calls whose tokens both expire re-auth
  // through one login; the one that joins it must retry with the new token too.
  it("a 401 re-auth that joins another call's login retries with the new token", async () => {
    const configFor = (): ResolvedFormioConfig => ({
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    });
    const [first, second] = [configFor(), configFor()];

    mockReadToken.mockResolvedValueOnce('initial-jwt').mockResolvedValue(null);
    mockValidateToken.mockResolvedValueOnce(true);
    mockCheckCurrentUser.mockResolvedValue({ accepted: false });
    mockAuthenticate.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('refreshed-jwt'), 20))
    );
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: 'ok' }) });

    await Promise.all([formioFetch('/form', {}, first), formioFetch('/form', {}, second)]);

    expect(mockAuthenticate).toHaveBeenCalledOnce();
    const retries = mockFetch.mock.calls.slice(2).map(([, init]) => (init as RequestInit).headers);
    expect(retries).toEqual([
      { 'x-jwt-token': 'refreshed-jwt' },
      { 'x-jwt-token': 'refreshed-jwt' },
    ]);
    expect([first.jwt, second.jwt]).toEqual(['refreshed-jwt', 'refreshed-jwt']);
  });

  it('a 401 for a token /current still accepts is a permission refusal: no login, token kept', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };

    mockReadToken.mockResolvedValue('valid-jwt');
    mockReadCacheSnapshot.mockReturnValue({
      fingerprint: { mtimeMs: 1, size: 1, ino: 1 },
      tokens: { 'https://formio.invalid/sub': 'valid-jwt' },
    });
    mockValidateToken.mockResolvedValue(true);
    mockCheckCurrentUser.mockResolvedValue({ accepted: true, account: 'ann@example.com' });
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: 'ok' }) });

    const refusal = await formioFetch('/form', {}, config).catch((error: unknown) => error);

    expect(toolErrorDetails(refusal)).toMatchObject({ code: 'FORBIDDEN', status: 401 });
    // No browser opens and the session survives the refusal.
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockClearToken).not.toHaveBeenCalled();
    // The next call reuses the in-memory token without validating it again.
    await expect(formioFetch('/form', {}, config)).resolves.toEqual({ result: 'ok' });
    expect(mockValidateToken).toHaveBeenCalledOnce();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
