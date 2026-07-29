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
}));
vi.mock('../token-validation.js', () => ({ validateToken: vi.fn() }));

import { authenticate } from '../auth.js';
import { readToken, saveToken } from '../token-cache.js';
import { validateToken } from '../token-validation.js';

const mockAuthenticate = vi.mocked(authenticate);
const mockReadToken = vi.mocked(readToken);
const mockSaveToken = vi.mocked(saveToken);
const mockValidateToken = vi.mocked(validateToken);

describe('formioFetch + ensureAuthenticated integration', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.resetAllMocks();
    resetAuthState();
  });

  it('two concurrent first-time calls trigger exactly one authenticate and one saveToken', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid',
      projectUrl: 'https://formio.invalid/example',
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
      baseUrl: 'https://formio.invalid',
      projectUrl: 'https://formio.invalid/example',
    };

    // Disk has an initial token that passes validation.
    // After the 401 clears it, subsequent readToken calls return null.
    mockReadToken.mockResolvedValueOnce('initial-jwt').mockResolvedValue(null);
    mockValidateToken.mockResolvedValueOnce(true);

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
    expect(result1).toEqual({ result: 'ok' });
    expect(result2).toEqual({ result: 'ok' });
  });
});
