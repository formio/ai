import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formioFetch } from '../formio-client.js';
import { ResolvedFormioConfig } from '../config.js';
import { TEST_CONFIG as config, TEST_PROJECT_URL } from './test-helpers.js';

vi.mock('../ensure-auth.js', () => ({
  ensureAuthenticated: vi.fn(),
  resetAuthState: vi.fn(),
  invalidateJwtCache: vi.fn(),
}));

vi.mock('../token-cache.js', () => ({
  readToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
}));

import { ensureAuthenticated } from '../ensure-auth.js';
import { clearToken } from '../token-cache.js';

const mockEnsureAuth = vi.mocked(ensureAuthenticated);
const mockClearToken = vi.mocked(clearToken);

describe('formioFetch', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockEnsureAuth.mockReset();
    mockClearToken.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends GET request to constructed URL with x-token header', async () => {
    const data = [{ _id: '1', title: 'Test' }];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await formioFetch('/form', {}, config);

    const calledUrl = mockFetch.mock.calls[0][0] as URL;
    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledUrl.href).toContain(`${TEST_PROJECT_URL}/form`);
    expect(calledOptions.headers).toEqual({ 'x-token': 'abc123' });
    expect(result).toEqual(data);
  });

  it('appends query parameters to URL', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await formioFetch('/form', { limit: '10', type: 'form' }, config);

    const calledUrl = mockFetch.mock.calls[0][0] as URL;
    expect(calledUrl.searchParams.get('limit')).toBe('10');
    expect(calledUrl.searchParams.get('type')).toBe('form');
  });

  it('omits undefined params from query string', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await formioFetch('/form', { limit: '10', type: undefined }, config);

    const calledUrl = mockFetch.mock.calls[0][0] as URL;
    expect(calledUrl.searchParams.get('limit')).toBe('10');
    expect(calledUrl.searchParams.has('type')).toBe(false);
  });

  it('throws on 401 response with status in message', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });

    await expect(formioFetch('/form', {}, config)).rejects.toThrow('401');
  });

  it('throws on 404 response with status in message', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    await expect(formioFetch('/form', {}, config)).rejects.toThrow('404');
  });

  it('sends POST request with JSON body when method and body are provided', async () => {
    const created = { _id: '1', title: 'New Form' };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(created) });

    const body = { title: 'New Form', name: 'newForm', path: 'newform', components: [] };
    const result = await formioFetch('form', {}, config, { method: 'POST', body });

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers).toEqual({
      'x-token': 'abc123',
      'Content-Type': 'application/json',
    });
    expect(calledOptions.body).toBe(JSON.stringify(body));
    expect(result).toEqual(created);
  });

  it('defaults to GET when no options are provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await formioFetch('form', {}, config);

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledOptions.method).toBeUndefined();
    expect(calledOptions.headers).toEqual({ 'x-token': 'abc123' });
  });

  it('handles errors on POST requests', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request' });

    const body = { title: 'Bad' };
    await expect(formioFetch('form', {}, config, { method: 'POST', body })).rejects.toThrow('400');
  });

  it('sends x-jwt-token header when config.jwt is set', async () => {
    const jwtConfig: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'my-jwt-token',
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await formioFetch('form', {}, jwtConfig);

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledOptions.headers).toEqual({ 'x-jwt-token': 'my-jwt-token' });
  });

  it('prefers x-jwt-token when both jwt and apiKey are present', async () => {
    const bothConfig: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      apiKey: 'abc123',
      jwt: 'my-jwt-token',
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await formioFetch('form', {}, bothConfig);

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledOptions.headers).toEqual({ 'x-jwt-token': 'my-jwt-token' });
  });

  it('throws when neither jwt nor apiKey is set', async () => {
    const noAuthConfig: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
    };

    await expect(formioFetch('form', {}, noAuthConfig)).rejects.toThrow();
  });

  it('on 401 retry that also fails throws without infinite loop', async () => {
    const jwtConfig: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'expired-token',
    };
    mockEnsureAuth.mockImplementation(async () => {
      jwtConfig.jwt = 'still-bad-token';
    });

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });

    await expect(formioFetch('form', {}, jwtConfig)).rejects.toThrow('401');
    // gate called twice: pre-request + 401 re-auth
    expect(mockEnsureAuth).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('on 401 in API key mode throws without re-auth', async () => {
    const apiKeyConfig: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      apiKey: 'bad-key',
    };

    mockFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });

    await expect(formioFetch('form', {}, apiKeyConfig)).rejects.toThrow('401');
    // gate called once for the pre-request check; 401 re-auth path not taken (no jwt)
    expect(mockEnsureAuth).toHaveBeenCalledTimes(1);
    expect(mockClearToken).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('invokes the auth gate before sending the outbound HTTP request', async () => {
    const callOrder: string[] = [];
    mockEnsureAuth.mockImplementation(async () => {
      callOrder.push('ensureAuth');
    });
    mockFetch.mockImplementation(async () => {
      callOrder.push('fetch');
      return { ok: true, json: () => Promise.resolve({}) };
    });

    await formioFetch('/form', {}, config);

    expect(callOrder).toEqual(['ensureAuth', 'fetch']);
  });

  it('on 401 in JWT mode clears the cached token, clears config.jwt, calls the gate, and retries', async () => {
    const jwtConfig: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'expired-jwt',
    };
    mockEnsureAuth.mockImplementation(async () => {
      // Simulate gate refreshing the token after the cache was cleared
      jwtConfig.jwt = 'fresh-jwt';
    });
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: 'ok' }) });

    const result = await formioFetch('/form', {}, jwtConfig);

    // gate called twice: once before the initial request, once for re-auth
    expect(mockEnsureAuth).toHaveBeenCalledTimes(2);
    expect(mockClearToken).toHaveBeenCalledWith('https://formio.invalid/sub');
    const retryOptions = mockFetch.mock.calls[1][1] as RequestInit;
    expect(retryOptions.headers).toEqual({ 'x-jwt-token': 'fresh-jwt' });
    expect(result).toEqual({ data: 'ok' });
  });

  it('propagates auth gate errors without sending any HTTP request', async () => {
    mockEnsureAuth.mockRejectedValue(new Error('user cancelled login'));

    await expect(formioFetch('/form', {}, config)).rejects.toThrow('user cancelled login');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns parsed text when responseType is text', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('Ok'),
      json: () => Promise.resolve({}),
    });

    const result = await formioFetch('/import', {}, config, {
      method: 'POST',
      body: { template: {} },
      responseType: 'text',
    });

    expect(result).toBe('Ok');
  });

  it('uses the refreshed config.jwt header on the retry after a successful gate during 401 re-auth', async () => {
    const jwtConfig: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid/sub',
      projectUrl: 'https://formio.invalid/sub/example',
      jwt: 'old-jwt',
    };
    let gateCallCount = 0;
    mockEnsureAuth.mockImplementation(async () => {
      gateCallCount += 1;
      if (gateCallCount === 2) {
        jwtConfig.jwt = 'refreshed-jwt';
      }
    });
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    await formioFetch('/form', {}, jwtConfig);

    const retryOptions = mockFetch.mock.calls[1][1] as RequestInit;
    expect(retryOptions.headers).toEqual({ 'x-jwt-token': 'refreshed-jwt' });
  });
});
