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

import { ensureAuthenticated, invalidateJwtCache } from '../ensure-auth.js';
import { clearToken } from '../token-cache.js';
import { toolErrorDetails } from '../tool-errors.js';

const mockEnsureAuth = vi.mocked(ensureAuthenticated);
const mockClearToken = vi.mocked(clearToken);
const mockInvalidateJwtCache = vi.mocked(invalidateJwtCache);

const CURRENT_URL = 'https://formio.invalid/sub/current';

interface RouteFetchOptions {
  /** How `{baseUrl}/current` answers. */
  current: (init?: RequestInit) => Promise<unknown>;
  /** Every other request's answer, in order. */
  responses: unknown[];
}

// Routes `{baseUrl}/current` apart from the request under test, so a test states how
// the deployment judges the token without depending on the order the two are sent in.
function routeFetch(
  mockFetch: ReturnType<typeof vi.fn>,
  { current, responses }: RouteFetchOptions
) {
  const queue = [...responses];
  mockFetch.mockImplementation(async (input: URL | string, init?: RequestInit) =>
    String(input) === CURRENT_URL ? current(init) : queue.shift()
  );
}

const refused = async () => ({ ok: false, status: 401, statusText: 'Unauthorized' });

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

    routeFetch(mockFetch, {
      current: refused,
      responses: [
        { ok: false, status: 401, statusText: 'Unauthorized' },
        { ok: false, status: 401, statusText: 'Unauthorized' },
      ],
    });

    await expect(formioFetch('form', {}, jwtConfig)).rejects.toThrow('401');
    // gate called twice: pre-request + 401 re-auth
    expect(mockEnsureAuth).toHaveBeenCalledTimes(2);
    // The request, /current refusing the token, and the one retry.
    expect(mockFetch.mock.calls.map(([input]) => String(input))).toEqual([
      'https://formio.invalid/sub/example/form',
      CURRENT_URL,
      'https://formio.invalid/sub/example/form',
    ]);
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
    // Nor is /current asked: an API key is not a session a login could replace.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).not.toBe(CURRENT_URL);
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
    routeFetch(mockFetch, {
      current: refused,
      responses: [
        { ok: false, status: 401, statusText: 'Unauthorized' },
        { ok: true, json: () => Promise.resolve({ data: 'ok' }) },
      ],
    });

    const result = await formioFetch('/form', {}, jwtConfig);

    // gate called twice: once before the initial request, once for re-auth
    expect(mockEnsureAuth).toHaveBeenCalledTimes(2);
    expect(mockClearToken).toHaveBeenCalledWith('https://formio.invalid/sub');
    // The request, /current refusing the token, and the retry.
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const retryOptions = mockFetch.mock.calls[2][1] as RequestInit;
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
    routeFetch(mockFetch, {
      current: refused,
      responses: [
        { ok: false, status: 401, statusText: 'Unauthorized' },
        { ok: true, json: () => Promise.resolve({ ok: true }) },
      ],
    });

    await formioFetch('/form', {}, jwtConfig);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const retryOptions = mockFetch.mock.calls[2][1] as RequestInit;
    expect(retryOptions.headers).toEqual({ 'x-jwt-token': 'refreshed-jwt' });
  });
});

describe('formioFetch keeps every request under the Project URL', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockEnsureAuth.mockReset();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const withProject = (projectUrl: string): ResolvedFormioConfig => ({ ...config, projectUrl });

  it('sends a form path under a hosted project', async () => {
    await formioFetch('user/login', {}, withProject('https://examples.form.io'));
    expect((mockFetch.mock.calls[0][0] as URL).href).toBe('https://examples.form.io/user/login');
  });

  it('sends a form ID path under a sub-directory project', async () => {
    await formioFetch(
      'form/65a1b2c3d4e5f60718293a4b',
      {},
      withProject('https://forms.mysite.com/myproject')
    );
    expect((mockFetch.mock.calls[0][0] as URL).href).toBe(
      'https://forms.mysite.com/myproject/form/65a1b2c3d4e5f60718293a4b'
    );
  });

  it.each([
    ['https://example.com/x', 'https://examples.form.io'],
    ['//elsewhere/form', 'https://forms.mysite.com/myproject'],
    ['../otherproject/form', 'https://forms.mysite.com/myproject'],
    ['../myproject2/form', 'https://forms.mysite.com/myproject'],
  ])('refuses %j under %s without sending it', async (path, projectUrl) => {
    const refusal = await formioFetch(path, {}, withProject(projectUrl)).catch(
      (error: unknown) => error
    );
    expect(refusal).toBeInstanceOf(Error);
    expect((refusal as Error).message).toContain(path);
    expect((refusal as Error).message).toContain(projectUrl);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refuses before the auth gate runs', async () => {
    await expect(
      formioFetch('https://example.com/x', {}, withProject('https://examples.form.io'))
    ).rejects.toThrow();
    expect(mockEnsureAuth).not.toHaveBeenCalled();
  });
});

describe('formioFetch does not follow a redirect with credentials attached', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockEnsureAuth.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks fetch not to follow redirects', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await formioFetch('form', {}, config);
    expect((mockFetch.mock.calls[0][1] as RequestInit).redirect).toBe('manual');
  });

  it('reports a redirect as an error naming where it pointed', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({ location: 'https://other.example/' }),
    });
    await expect(formioFetch('form', {}, config)).rejects.toThrow(
      /302[\s\S]*https:\/\/other\.example\//
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// Form.io answers 401 both to a token it no longer accepts and to a signed-in account
// the permission handler refuses. Only /current tells the two apart, and only the
// first is fixed by signing in again.
describe('a 401 in JWT mode asks /current before re-authenticating', () => {
  const mockFetch = vi.fn();
  const REQUEST_URL = 'https://formio.invalid/sub/example/form';

  const jwtConfig = (): ResolvedFormioConfig => ({
    baseUrl: 'https://formio.invalid/sub',
    projectUrl: 'https://formio.invalid/sub/example',
    jwt: 'valid-jwt',
  });

  const accepted = (body: unknown) => async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const unauthorized = () => new Response('Unauthorized', { status: 401 });
  const succeeded = () => ({ ok: true, json: () => Promise.resolve({ data: 'ok' }) });

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockEnsureAuth.mockReset();
    mockClearToken.mockReset();
    mockInvalidateJwtCache.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when /current accepts the token', () => {
    it('raises FORBIDDEN with status 401, naming the account and the URL', async () => {
      routeFetch(mockFetch, {
        current: accepted({ _id: 'user-id', data: { email: 'ann@example.com' } }),
        responses: [unauthorized()],
      });

      const error = await formioFetch('form', {}, jwtConfig()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(toolErrorDetails(error)).toMatchObject({ code: 'FORBIDDEN', status: 401 });
      expect((error as Error).message).toContain('ann@example.com');
      expect((error as Error).message).toContain(REQUEST_URL);
    });

    it('names the account by _id when /current carries no email', async () => {
      routeFetch(mockFetch, {
        current: accepted({ _id: '65a1b2c3d4e5f60718293a4b', data: {} }),
        responses: [unauthorized()],
      });

      const error = await formioFetch('form', {}, jwtConfig()).catch((e: unknown) => e);

      expect(toolErrorDetails(error).code).toBe('FORBIDDEN');
      expect((error as Error).message).toContain('65a1b2c3d4e5f60718293a4b');
    });

    it('keeps the token, does not run the gate again, and does not retry', async () => {
      const config = jwtConfig();
      routeFetch(mockFetch, {
        current: accepted({ _id: 'user-id', data: { email: 'ann@example.com' } }),
        responses: [unauthorized()],
      });

      await formioFetch('form', {}, config).catch(() => undefined);

      expect(config.jwt).toBe('valid-jwt');
      expect(mockClearToken).not.toHaveBeenCalled();
      expect(mockInvalidateJwtCache).not.toHaveBeenCalled();
      // Once, for the pre-request check — never for a re-login.
      expect(mockEnsureAuth).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls.map(([input]) => String(input))).toEqual([
        REQUEST_URL,
        CURRENT_URL,
      ]);
    });

    it('asks /current with the same token, without following a redirect, within 10 seconds', async () => {
      const timeout = vi.spyOn(AbortSignal, 'timeout');
      routeFetch(mockFetch, {
        current: accepted({ _id: 'user-id', data: { email: 'ann@example.com' } }),
        responses: [unauthorized()],
      });

      await formioFetch('form', {}, jwtConfig()).catch(() => undefined);

      const currentInit = mockFetch.mock.calls[1][1] as RequestInit;
      expect(currentInit.headers).toEqual({ 'x-jwt-token': 'valid-jwt' });
      expect(currentInit.redirect).toBe('manual');
      expect(currentInit.signal).toBeInstanceOf(AbortSignal);
      expect(timeout).toHaveBeenCalledWith(10_000);
    });
  });

  // A wrong "still valid" would leave the user stuck behind a refusal no login can
  // clear, so every answer short of a 2xx falls back to re-authenticating.
  describe('when /current does not accept the token', () => {
    it.each([
      ['refuses it', refused],
      [
        'redirects',
        async () =>
          new Response('', { status: 302, headers: { location: 'https://other.example/' } }),
      ],
      [
        'gets no response',
        async () => {
          throw new TypeError('fetch failed', {
            cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
          });
        },
      ],
    ])('clears the token, runs the gate, and retries once when /current %s', async (_, current) => {
      const config = jwtConfig();
      mockEnsureAuth.mockImplementation(async () => {
        if (mockEnsureAuth.mock.calls.length === 2) {
          config.jwt = 'fresh-jwt';
        }
      });
      routeFetch(mockFetch, { current, responses: [unauthorized(), succeeded()] });

      const result = await formioFetch('form', {}, config);

      expect(result).toEqual({ data: 'ok' });
      expect(mockClearToken).toHaveBeenCalledWith('https://formio.invalid/sub');
      expect(mockEnsureAuth).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls.map(([input]) => String(input))).toEqual([
        REQUEST_URL,
        CURRENT_URL,
        REQUEST_URL,
      ]);
      expect((mockFetch.mock.calls[2][1] as RequestInit).headers).toEqual({
        'x-jwt-token': 'fresh-jwt',
      });
    });

    it('clears the token, runs the gate, and retries once when /current times out', async () => {
      const realTimeout = AbortSignal.timeout.bind(AbortSignal);
      // The 10-second limit, shortened so the test does not wait it out.
      vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) =>
        realTimeout(ms === 10_000 ? 5 : ms)
      );
      const config = jwtConfig();
      mockEnsureAuth.mockImplementation(async () => {
        if (mockEnsureAuth.mock.calls.length === 2) {
          config.jwt = 'fresh-jwt';
        }
      });
      routeFetch(mockFetch, {
        current: (init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
        responses: [unauthorized(), succeeded()],
      });

      const result = await formioFetch('form', {}, config);

      expect(result).toEqual({ data: 'ok' });
      expect(mockClearToken).toHaveBeenCalledWith('https://formio.invalid/sub');
      expect(mockEnsureAuth).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls.map(([input]) => String(input))).toEqual([
        REQUEST_URL,
        CURRENT_URL,
        REQUEST_URL,
      ]);
    });
  });
});
