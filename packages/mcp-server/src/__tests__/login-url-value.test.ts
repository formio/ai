/**
 * The login URL the server opens and prints carries this login's value as its `s` query
 * parameter. `GET /` serves the login page only for that value — any other request is
 * answered with a short 403 page that does not carry it, and the login keeps waiting —
 * and the page posts the same value back to `/callback` with the token.
 *
 * Nothing else about a request is checked: a devcontainer or Codespaces forwarded port
 * reaches the server under a name and port it cannot know, and the value in the URL is
 * what ties the request to this login.
 */

import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResolvedFormioConfig } from '../config.js';
import { loginPageState, postLoginToken } from './test-helpers.js';

const mockOpenInBrowser = vi.fn();
vi.mock('../browser-launch.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../browser-launch.js')>()),
  openInBrowser: (...args: unknown[]) => mockOpenInBrowser(...args),
}));

const { authenticate } = await import('../auth.js');

const CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid/sub',
  projectUrl: 'https://formio.invalid/sub/example',
  loginFormUrl: 'https://formio.invalid/sub/formio/user/login',
  forceBrowser: true,
};

interface RawRequest {
  port: number;
  host: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

interface RawResponse {
  status: number;
  body: string;
}

// A request to the server on loopback carrying an arbitrary Host header, which fetch
// does not let a caller set.
function request({ port, host, method, path, body }: RawRequest): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          Host: host,
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() })
        );
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

const valueOf = (url: string): string => new URL(url).searchParams.get('s') ?? '';

describe('the login URL', () => {
  let stderr: string[];

  beforeEach(() => {
    stderr = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk): boolean => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    });
    mockOpenInBrowser.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('carries the login value as `s`, in the URL opened and the URL printed', async () => {
    let loginUrl = '';
    await authenticate(CONFIG, {
      onReady: async ({ url }) => {
        loginUrl = url;
        await postLoginToken(url, 'jwt');
      },
    });

    expect(valueOf(loginUrl)).toMatch(/^[0-9a-f]{32}$/);
    expect(new URL(loginUrl).pathname).toBe('/');
    expect(mockOpenInBrowser).toHaveBeenCalledWith(loginUrl, expect.any(Function));
    expect(stderr.join('')).toContain(`Form.io login required: ${loginUrl}`);
  });

  it('is the value the served page posts back', async () => {
    let loginUrl = '';
    let pageValue: string | undefined;
    await authenticate(CONFIG, {
      onReady: async ({ url }) => {
        loginUrl = url;
        pageValue = await loginPageState(url);
        await postLoginToken(url, 'jwt');
      },
    });

    expect(pageValue).toBe(valueOf(loginUrl));
  });
});

describe('GET /', () => {
  it.each([
    ['without the value', () => '/'],
    [
      'with a different value',
      (value: string) => `/?s=${value.replace(/^./, (c) => (c === '0' ? '1' : '0'))}`,
    ],
    ['with the value twice', (value: string) => `/?s=${value}&s=${value}`],
    ['with the value under another name', (value: string) => `/?state=${value}`],
  ])(
    'answers 403 %s, without the value in the page, and the login keeps waiting',
    async (_, path) => {
      let refused: RawResponse | undefined;
      const jwt = await authenticate(CONFIG, {
        onReady: async ({ port, url }) => {
          refused = await request({
            port,
            host: `127.0.0.1:${port}`,
            method: 'GET',
            path: path(valueOf(url)),
          });
          await postLoginToken(url, 'the-token');
        },
      });

      expect(refused?.status).toBe(403);
      expect(refused?.body).not.toContain('Formio.createForm');
      expect(jwt).toBe('the-token');
    }
  );

  it('does not carry the value in the 403 page', async () => {
    let refused: RawResponse | undefined;
    let value = '';
    await authenticate(CONFIG, {
      onReady: async ({ port, url }) => {
        value = valueOf(url);
        refused = await request({ port, host: `127.0.0.1:${port}`, method: 'GET', path: '/' });
        await postLoginToken(url, 'jwt');
      },
    });

    expect(value).not.toBe('');
    expect(refused?.body).not.toContain(value);
  });
});

describe('a forwarded port', () => {
  const forwarded = 'foo-41000.app.github.dev:443';

  it('serves the page and completes the login for another Host and port when the value is right', async () => {
    let page: RawResponse | undefined;
    // The login completes as the post is received, before its response arrives.
    let posted: Promise<RawResponse> | undefined;
    const jwt = await authenticate(CONFIG, {
      onReady: async ({ port, url }) => {
        page = await request({ port, host: forwarded, method: 'GET', path: `/?s=${valueOf(url)}` });
        posted = request({
          port,
          host: forwarded,
          method: 'POST',
          path: '/callback',
          body: { token: 'forwarded-jwt', state: valueOf(url) },
        });
      },
    });

    expect(page?.status).toBe(200);
    expect(page?.body).toContain('Formio.createForm');
    expect((await posted)?.status).toBe(200);
    expect(jwt).toBe('forwarded-jwt');
  });

  it('answers /callback without the value with 403, and keeps waiting', async () => {
    let refused: RawResponse | undefined;
    const jwt = await authenticate(CONFIG, {
      onReady: async ({ port, url }) => {
        refused = await request({
          port,
          host: forwarded,
          method: 'POST',
          path: '/callback',
          body: { token: 'no-value-jwt' },
        });
        await postLoginToken(url, 'own-jwt');
      },
    });

    expect(refused?.status).toBe(403);
    expect(jwt).toBe('own-jwt');
  });
});
