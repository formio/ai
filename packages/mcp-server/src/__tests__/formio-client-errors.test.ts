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
    mockFetch
      .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(errorResponse(401, 'Token expired'));

    const error = (await caught(formioFetch('form', {}, jwtConfig))) as FormioApiError;

    expect(error).toBeInstanceOf(FormioApiError);
    expect(error.status).toBe(401);
    expect(error.body).toBe('Token expired');
    expect(mockFetch).toHaveBeenCalledTimes(2);
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
