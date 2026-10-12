import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formioFetch } from '../formio-client.js';
import { ResolvedFormioConfig } from '../config.js';
import { FormioApiError, FormioNetworkError, FORMIO_BODY_LIMIT } from '../tool-errors.js';
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

const mockEnsureAuth = vi.mocked(ensureAuthenticated);

function errorResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

// The shape undici gives a request that never got a response: a TypeError whose
// cause carries the system error code.
function fetchFailure(code: string, detail: string): TypeError {
  const cause = Object.assign(new Error(`${detail}`), { code });
  return new TypeError('fetch failed', { cause });
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the request to fail');
    },
    (error: unknown) => error
  );
}

describe('formioFetch raises a FormioApiError for an error response', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockEnsureAuth.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('carries the status, the URL and the body text', async () => {
    const body = JSON.stringify({ status: 400, message: 'Form validation failed' });
    mockFetch.mockResolvedValue(errorResponse(400, body));

    const error = await caught(formioFetch('form', {}, config, { method: 'POST', body: {} }));

    expect(error).toBeInstanceOf(FormioApiError);
    const apiError = error as FormioApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.url).toBe(`${TEST_PROJECT_URL}/form`);
    expect(apiError.body).toBe(body);
  });

  it('keeps the existing status and URL prose', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, ''));

    const error = (await caught(formioFetch('form/abc', {}, config))) as Error;

    expect(error.message).toContain('Form.io API error: 404');
    expect(error.message).toContain(`URL: ${TEST_PROJECT_URL}/form/abc`);
  });

  it(`truncates the body to ${FORMIO_BODY_LIMIT} characters`, async () => {
    mockFetch.mockResolvedValue(errorResponse(500, 'x'.repeat(FORMIO_BODY_LIMIT + 500)));

    const error = (await caught(formioFetch('form', {}, config))) as FormioApiError;

    expect(error.body).toHaveLength(FORMIO_BODY_LIMIT);
  });

  it("includes Form.io's JSON message in the prose", async () => {
    const body = JSON.stringify({
      status: 400,
      message: 'form validation failed: path: The Path must be unique per Project.',
      errors: {
        path: {
          path: 'path',
          name: 'ValidatorError',
          message: 'The Path must be unique per Project.',
        },
      },
    });
    mockFetch.mockResolvedValue(errorResponse(400, body));

    const error = (await caught(formioFetch('form', {}, config))) as Error;

    expect(error.message).toContain('The Path must be unique per Project.');
  });

  it("falls back to Form.io's JSON name when there is no message", async () => {
    mockFetch.mockResolvedValue(errorResponse(400, JSON.stringify({ name: 'ValidationError' })));

    const error = (await caught(formioFetch('form', {}, config))) as Error;

    expect(error.message).toContain('ValidationError');
  });

  // resourcejs answers a missing document with `errors` as an array of strings.
  it('includes an errors array of strings in the prose', async () => {
    mockFetch.mockResolvedValue(
      errorResponse(404, JSON.stringify({ status: 404, errors: ['Resource not found'] }))
    );

    const error = (await caught(formioFetch('form', {}, config))) as Error;

    expect(error.message).toContain('Resource not found');
  });

  it('includes an errors array of objects carrying a message in the prose', async () => {
    mockFetch.mockResolvedValue(
      errorResponse(
        400,
        JSON.stringify({ errors: [{ message: 'First problem' }, { message: 'Second problem' }] })
      )
    );

    const error = (await caught(formioFetch('form', {}, config))) as Error;

    expect(error.message).toContain('First problem Second problem');
  });

  it('includes a short plain-text body in the prose', async () => {
    mockFetch.mockResolvedValue(errorResponse(400, 'Invalid alias'));

    const error = (await caught(formioFetch('contact/v', {}, config))) as Error;

    expect(error.message).toContain('Invalid alias');
  });

  it('still names where a redirect pointed', async () => {
    mockFetch.mockResolvedValue(errorResponse(302, '', { location: 'https://other.example/' }));

    const error = (await caught(formioFetch('form', {}, config))) as FormioApiError;

    expect(error).toBeInstanceOf(FormioApiError);
    expect(error.status).toBe(302);
    expect(error.message).toMatch(/302[\s\S]*https:\/\/other\.example\//);
  });

  it('raises the retry response after a 401 re-authentication', async () => {
    const jwtConfig: ResolvedFormioConfig = { ...config, apiKey: undefined, jwt: 'expired' };
    mockEnsureAuth.mockImplementation(async () => {
      jwtConfig.jwt = 'still-bad';
    });
    const answers = [errorResponse(401, 'Unauthorized'), errorResponse(401, 'Token expired')];
    // /current refuses the token, so the 401 is re-authenticated and retried.
    mockFetch.mockImplementation(async (input: URL | string) =>
      String(input) === `${config.baseUrl}/current`
        ? errorResponse(401, 'Unauthorized')
        : answers.shift()
    );

    const error = (await caught(formioFetch('form', {}, jwtConfig))) as FormioApiError;

    expect(error).toBeInstanceOf(FormioApiError);
    expect(error.status).toBe(401);
    expect(error.body).toBe('Token expired');
    // The request, the /current check, and the one retry.
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe('formioFetch raises a FormioNetworkError when no response arrives', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockEnsureAuth.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:443'],
    ['ENOTFOUND', 'getaddrinfo ENOTFOUND formio.invalid'],
    ['CERT_HAS_EXPIRED', 'certificate has expired'],
  ])('names the %s cause and the URL', async (code, detail) => {
    mockFetch.mockRejectedValue(fetchFailure(code, detail));

    const error = (await caught(formioFetch('form', {}, config))) as FormioNetworkError;

    expect(error).toBeInstanceOf(FormioNetworkError);
    expect(error.url).toBe(`${TEST_PROJECT_URL}/form`);
    expect(error.message).toContain(code);
    expect(error.message).toContain(`${TEST_PROJECT_URL}/form`);
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it('names a code carried by an aggregate cause', async () => {
    const inner = Object.assign(new Error('connect ECONNREFUSED ::1:443'), {
      code: 'ECONNREFUSED',
    });
    const cause = new AggregateError([inner], '');
    mockFetch.mockRejectedValue(new TypeError('fetch failed', { cause }));

    const error = (await caught(formioFetch('form', {}, config))) as FormioNetworkError;

    expect(error.message).toContain('ECONNREFUSED');
  });
});

// AbortSignal.timeout runs on Node's own timers, which fake timers do not reach, so
// these shorten the real timeout instead: the configured duration is still the one
// asked for and the one the message names.
describe('formioFetch times out a request that receives no response', () => {
  const mockFetch = vi.fn();
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);

  // A deployment that accepts the request and never answers: only an abort ends it.
  const hang = (_input: URL | string, init?: RequestInit) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });

  // What a request still in flight after a second settles to, so a missing timeout
  // fails the assertion rather than the test's own time limit.
  const STILL_WAITING = 'still waiting after 1 second';
  const settled = (attempt: Promise<unknown>) =>
    Promise.race([
      caught(attempt),
      new Promise((resolve) => setTimeout(() => resolve(STILL_WAITING), 1000)),
    ]);

  // Makes the timeout of `ms` fire at once, leaving every other duration as asked.
  function shorten(ms: number) {
    return vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation((asked) => realTimeout(asked === ms ? 5 : asked));
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockEnsureAuth.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aborts after 60 seconds by default, as NETWORK_ERROR naming the URL and the wait', async () => {
    const timeout = shorten(60_000);
    mockFetch.mockImplementation(hang);

    const error = (await settled(formioFetch('form', {}, config))) as FormioNetworkError;

    expect(error).toBeInstanceOf(FormioNetworkError);
    expect(timeout).toHaveBeenCalledWith(60_000);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toContain('timed out after 60 seconds');
    expect(error.message).toContain(`${TEST_PROJECT_URL}/form`);
  });

  it('uses the configured request timeout in place of the default', async () => {
    const timeout = shorten(5_000);
    mockFetch.mockImplementation(hang);

    const error = (await settled(
      formioFetch('form', {}, { ...config, requestTimeoutMs: 5_000 })
    )) as FormioNetworkError;

    expect(error).toBeInstanceOf(FormioNetworkError);
    expect(timeout).toHaveBeenCalledWith(5_000);
    expect(timeout).not.toHaveBeenCalledWith(60_000);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toContain('timed out after 5 seconds');
  });

  it('gives a per-call timeout precedence over the configured one', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    mockFetch.mockResolvedValue(new Response('Ok', { status: 200 }));

    await formioFetch(
      'import',
      {},
      { ...config, requestTimeoutMs: 5_000 },
      {
        method: 'POST',
        body: { template: {} },
        responseType: 'text',
        timeoutMs: 300_000,
      }
    );

    expect(timeout).toHaveBeenCalledWith(300_000);
    expect(timeout).not.toHaveBeenCalledWith(5_000);
    expect((mockFetch.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('lets a caller signal abort the request with its own reason, not a timeout', async () => {
    const controller = new AbortController();
    const reason = new Error('caller stopped waiting');
    mockFetch.mockImplementation(hang);

    const attempt = caught(formioFetch('form', {}, config, { signal: controller.signal }));
    // After the auth gate, once the request is in flight.
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());
    controller.abort(reason);
    const error = (await attempt) as FormioNetworkError;

    expect(error.cause).toBe(reason);
    expect(error.message).not.toMatch(/timed out/);
  });
});

// Headers can arrive in time and the body not: the timeout then aborts the body
// read, which rejects with the timeout's own reason — a TimeoutError DOMException.
describe('formioFetch times out a response whose body never finishes', () => {
  const mockFetch = vi.fn();

  // A 200 whose headers arrived but whose body read the timeout aborted.
  function stalledBody(): Response {
    const response = new Response('{}', { status: 200 });
    const timedOut = () =>
      Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    vi.spyOn(response, 'json').mockImplementation(timedOut);
    vi.spyOn(response, 'text').mockImplementation(timedOut);
    return response;
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockEnsureAuth.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a JSON body read cut off by the timeout as NETWORK_ERROR naming the wait and the URL', async () => {
    mockFetch.mockResolvedValue(stalledBody());

    const error = (await caught(formioFetch('form', {}, config))) as FormioNetworkError;

    expect(error).toBeInstanceOf(FormioNetworkError);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toContain('timed out after 60 seconds');
    expect(error.message).toContain(`${TEST_PROJECT_URL}/form`);
  });

  it('reports a text body read cut off by the timeout the same way, with the per-call wait', async () => {
    mockFetch.mockResolvedValue(stalledBody());

    const error = (await caught(
      formioFetch('export', {}, config, { responseType: 'text', timeoutMs: 300_000 })
    )) as FormioNetworkError;

    expect(error).toBeInstanceOf(FormioNetworkError);
    expect(error.message).toContain('timed out after 300 seconds');
    expect(error.message).toContain(`${TEST_PROJECT_URL}/export`);
  });

  it('reports a page body read cut off by the timeout the same way', async () => {
    mockFetch.mockResolvedValue(stalledBody());

    const error = (await caught(
      formioFetch('form', {}, { ...config, requestTimeoutMs: 5_000 }, { withMeta: true })
    )) as FormioNetworkError;

    expect(error).toBeInstanceOf(FormioNetworkError);
    expect(error.message).toContain('timed out after 5 seconds');
  });

  it('leaves a body read the caller aborted with its own reason', async () => {
    const controller = new AbortController();
    const reason = new DOMException('caller gave up', 'TimeoutError');
    controller.abort(reason);
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'json').mockRejectedValue(reason);
    mockFetch.mockResolvedValue(response);

    const error = await caught(formioFetch('form', {}, config, { signal: controller.signal }));

    expect(error).toBe(reason);
  });
});
