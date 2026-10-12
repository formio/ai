// The short-lived local login server at the edges Express 5 changed.
//
// Express 5 no longer defaults `req.body` to `{}` when no body parser matched, so
// a POST without a JSON content type reaches the handler with `req.body`
// undefined; reading a property off it throws, and Express answers 500. And
// `app.listen` now hands a bind failure to its callback instead of leaving it on
// the server's `error` event, so a callback that only looks at `server.address()`
// swallows EADDRINUSE and the caller waits out the whole login timeout.

import net from 'node:net';
import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../auth.js';
import { ResolvedFormioConfig } from '../config.js';
import { loginPageState, postLoginCallback, postLoginToken } from './test-helpers.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
}));

const CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid/sub',
  projectUrl: 'https://formio.invalid/sub/example',
  forceBrowser: true,
};

function postText(port: number, body: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
}

describe('the login callback', () => {
  // A body-less post carries no page value, so it is refused as any other post
  // without one is — answered, not failed with a 500.
  it('answers a POST with no JSON body with 403, and keeps waiting for the token', async () => {
    let status = 0;
    const jwt = await authenticate(CONFIG, {
      onReady: async (port) => {
        status = (await postText(port, 'not json')).status;
        await postLoginToken(port, 'after-a-bad-post');
      },
    });
    expect(status).toBe(403);
    expect(jwt).toBe('after-a-bad-post');
  });

  it('answers a post with the page value but no token with 400, and keeps waiting', async () => {
    let status = 0;
    const jwt = await authenticate(CONFIG, {
      onReady: async (port) => {
        status = (await postLoginCallback(port, { state: await loginPageState(port) })).status;
        await postLoginToken(port, 'after-an-empty-post');
      },
    });
    expect(status).toBe(400);
    expect(jwt).toBe('after-an-empty-post');
  });
});

describe('a login port that is already taken', () => {
  it('rejects promptly with an error naming the port, rather than waiting out the timeout', async () => {
    const squatter = net.createServer();
    await new Promise<void>((resolve) => squatter.listen(0, '127.0.0.1', resolve));
    const port = (squatter.address() as net.AddressInfo).port;
    try {
      const started = Date.now();
      await expect(
        authenticate({ ...CONFIG, authHost: '127.0.0.1', authPort: port, authTimeoutMs: 60_000 })
      ).rejects.toThrow(String(port));
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      await new Promise<void>((resolve) => squatter.close(() => resolve()));
    }
  });
});
