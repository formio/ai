/**
 * Which requests the local login server answers depends on where it is bound.
 *
 * Bound to loopback (the default, or FORMIO_AUTH_HOST naming a loopback address), it
 * answers only requests addressed to `localhost`, `127.0.0.1` or `[::1]` at the port it
 * listens on. Bound to every interface (`0.0.0.0` or `::`), the user has opted into
 * access from another host — a devcontainer or Codespaces forwarded port, served under
 * a name and port this server cannot know — so the Host header is not checked; the
 * per-login value on `/callback` still is. Bound to a specific other host, it answers
 * that host or the loopback names, at any port, since forwarding may remap the port.
 * A refused request is answered 403 and the login keeps waiting.
 */

import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { authenticate } from '../auth.js';
import { ResolvedFormioConfig } from '../config.js';
import { acceptsLoginHost } from '../login-host.js';
import { loginPageState, postLoginToken } from './test-helpers.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
}));

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

// A request to the server on loopback carrying an arbitrary Host header, which fetch
// does not let a caller set.
function request({ port, host, method, path, body }: RawRequest): Promise<number> {
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
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

describe('acceptsLoginHost', () => {
  const port = 41234;

  it.each(['localhost', '127.0.0.1', '[::1]', 'LOCALHOST'])('accepts %s at the port', (name) => {
    expect(acceptsLoginHost({ host: `${name}:${port}`, port })).toBe(true);
  });

  it.each([
    ['another host', `login.example.test:${port}`],
    ['another port', `127.0.0.1:${port + 1}`],
    ['no port', 'localhost'],
    ['no header', undefined],
    ['a malformed header', 'local host:1'],
    ['a loopback lookalike', `localhost.example.test:${port}`],
  ])('refuses %s', (_, host) => {
    expect(acceptsLoginHost({ host, port })).toBe(false);
  });

  it.each(['127.0.0.1', 'localhost', '::1'])(
    'stays strict when the configured host is the loopback address %s',
    (loopback) => {
      expect(acceptsLoginHost({ host: `localhost:${port}`, port, configuredHost: loopback })).toBe(
        true
      );
      expect(
        acceptsLoginHost({ host: `login.example.test:${port}`, port, configuredHost: loopback })
      ).toBe(false);
      expect(
        acceptsLoginHost({ host: `127.0.0.1:${port + 1}`, port, configuredHost: loopback })
      ).toBe(false);
    }
  );

  it('accepts a configured specific host, or a loopback name, at any port', () => {
    const configuredHost = 'login.example.test';
    expect(acceptsLoginHost({ host: `login.example.test:${port}`, port, configuredHost })).toBe(
      true
    );
    expect(acceptsLoginHost({ host: 'login.example.test:8080', port, configuredHost })).toBe(true);
    expect(acceptsLoginHost({ host: 'login.example.test', port, configuredHost })).toBe(true);
    expect(acceptsLoginHost({ host: 'localhost:9999', port, configuredHost })).toBe(true);
    expect(acceptsLoginHost({ host: `other.example.test:${port}`, port, configuredHost })).toBe(
      false
    );
    expect(acceptsLoginHost({ host: undefined, port, configuredHost })).toBe(false);
  });

  it.each(['0.0.0.0', '::'])('does not check the Host header when bound to %s', (wildcard) => {
    expect(
      acceptsLoginHost({ host: 'foo-43117.app.github.dev:443', port, configuredHost: wildcard })
    ).toBe(true);
    expect(acceptsLoginHost({ host: undefined, port, configuredHost: wildcard })).toBe(true);
    expect(acceptsLoginHost({ host: `127.0.0.1:${port}`, port, configuredHost: wildcard })).toBe(
      true
    );
  });
});

describe('the login server and the Host header', () => {
  it('answers GET / with 403 for a foreign Host, and serves the page for its own', async () => {
    const statuses: number[] = [];
    await authenticate(CONFIG, {
      onReady: async (port) => {
        statuses.push(
          await request({ port, host: `login.example.test:${port}`, method: 'GET', path: '/' }),
          await request({ port, host: `localhost:${port}`, method: 'GET', path: '/' })
        );
        await postLoginToken(port, 'jwt');
      },
    });
    expect(statuses).toEqual([403, 200]);
  });

  it('answers POST /callback with 403 for a foreign Host, and keeps waiting', async () => {
    let refused: Promise<number> | undefined;
    const jwt = await authenticate(CONFIG, {
      onReady: (port) => {
        refused = (async () => {
          const state = await loginPageState(port);
          const status = await request({
            port,
            host: `login.example.test:${port}`,
            method: 'POST',
            path: '/callback',
            body: { token: 'foreign-jwt', state },
          });
          await postLoginToken(port, 'own-jwt');
          return status;
        })();
      },
    });
    expect(jwt).toBe('own-jwt');
    expect(await refused).toBe(403);
  });

  it('accepts a POST /callback addressed as localhost', async () => {
    let accepted: Promise<number> | undefined;
    const jwt = await authenticate(CONFIG, {
      onReady: (port) => {
        accepted = (async () =>
          request({
            port,
            host: `localhost:${port}`,
            method: 'POST',
            path: '/callback',
            body: { token: 'localhost-jwt', state: await loginPageState(port) },
          }))();
      },
    });
    expect(jwt).toBe('localhost-jwt');
    expect(await accepted).toBe(200);
  });

  it('serves the page and completes the login for a forwarded name when bound to every interface', async () => {
    let statuses: Promise<number[]> | undefined;
    const forwarded = 'foo-43117.app.github.dev:443';
    const jwt = await authenticate(
      { ...CONFIG, authHost: '0.0.0.0' },
      {
        onReady: (port) => {
          statuses = (async () => {
            const page = await request({ port, host: forwarded, method: 'GET', path: '/' });
            const withoutValue = await request({
              port,
              host: forwarded,
              method: 'POST',
              path: '/callback',
              body: { token: 'no-value-jwt' },
            });
            const withValue = await request({
              port,
              host: forwarded,
              method: 'POST',
              path: '/callback',
              body: { token: 'forwarded-jwt', state: await loginPageState(port) },
            });
            return [page, withoutValue, withValue];
          })();
        },
      }
    );
    expect(jwt).toBe('forwarded-jwt');
    expect(await statuses).toEqual([200, 403, 200]);
  });
});
