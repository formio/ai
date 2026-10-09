import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateToken } from '../token-validation.js';
import { FormioConfig } from '../config.js';

describe('validateToken', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when GET /current responds 200', async () => {
    const config: FormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'valid-token',
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await validateToken(config);

    expect(result).toBe(true);
  });

  it('returns false when GET /current responds 401', async () => {
    const config: FormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'expired-token',
    };
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const result = await validateToken(config);

    expect(result).toBe(false);
  });

  it('sends x-jwt-token header when config has JWT', async () => {
    const config: FormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'my-jwt',
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await validateToken(config);

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as URL | string;
    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledUrl.toString()).toBe('https://formio.invalid/sub/current');
    expect(calledOptions.headers).toEqual(expect.objectContaining({ 'x-jwt-token': 'my-jwt' }));
  });

  it('sends x-token header when config has API key', async () => {
    const config: FormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      apiKey: 'my-api-key',
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await validateToken(config);

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as URL | string;
    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledUrl.toString()).toBe('https://formio.invalid/sub/current');
    expect(calledOptions.headers).toEqual(expect.objectContaining({ 'x-token': 'my-api-key' }));
  });

  it('does not follow a redirect with the token attached', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 302 });
    const result = await validateToken({
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'valid-token',
    });
    expect((mockFetch.mock.calls.at(-1)?.[1] as RequestInit).redirect).toBe('manual');
    expect(result).toBe(false);
  });

  // A refused connection is the same failure every other request reports: a
  // NETWORK_ERROR naming the cause and the URL, not a bare "fetch failed".
  it('reports a refused connection as NETWORK_ERROR naming the cause and URL', async () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), {
      code: 'ECONNREFUSED',
    });
    mockFetch.mockRejectedValue(new TypeError('fetch failed', { cause }));

    const attempt = validateToken({
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'valid-token',
    });

    await expect(attempt).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(attempt).rejects.toThrow(/ECONNREFUSED/);
    await expect(attempt).rejects.toThrow('https://formio.invalid/sub/current');
  });
});
