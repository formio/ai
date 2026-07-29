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
      baseUrl: 'https://formio.invalid',
      projectUrl: 'https://formio.invalid/example',
      jwt: 'valid-token',
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await validateToken(config);

    expect(result).toBe(true);
  });

  it('returns false when GET /current responds 401', async () => {
    const config: FormioConfig = {
      baseUrl: 'https://formio.invalid',
      projectUrl: 'https://formio.invalid/example',
      jwt: 'expired-token',
    };
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const result = await validateToken(config);

    expect(result).toBe(false);
  });

  it('sends x-jwt-token header when config has JWT', async () => {
    const config: FormioConfig = {
      baseUrl: 'https://formio.invalid',
      projectUrl: 'https://formio.invalid/example',
      jwt: 'my-jwt',
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await validateToken(config);

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as URL | string;
    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledUrl.toString()).toBe('https://formio.invalid/current');
    expect(calledOptions.headers).toEqual(expect.objectContaining({ 'x-jwt-token': 'my-jwt' }));
  });

  it('sends x-token header when config has API key', async () => {
    const config: FormioConfig = {
      baseUrl: 'https://formio.invalid',
      projectUrl: 'https://formio.invalid/example',
      apiKey: 'my-api-key',
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await validateToken(config);

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as URL | string;
    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledUrl.toString()).toBe('https://formio.invalid/current');
    expect(calledOptions.headers).toEqual(expect.objectContaining({ 'x-token': 'my-api-key' }));
  });
});
