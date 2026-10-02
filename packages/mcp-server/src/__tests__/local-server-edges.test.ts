// The two short-lived local servers — the portal login and the revisions consent
// page — at the edges Express 5 changed.
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
import { requestRevisionsLicenseConsent } from '../revisions/browser-prompts.js';

vi.mock('child_process', () => ({ execFile: vi.fn() }));

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

function postJson(port: number, body: unknown): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('the login callback', () => {
  it('answers a POST with no JSON body with 400, and keeps waiting for the token', async () => {
    let status = 0;
    const jwt = await authenticate(CONFIG, {
      onReady: async (port) => {
        status = (await postText(port, 'not json')).status;
        await postJson(port, { token: 'after-a-bad-post' });
      },
    });
    expect(status).toBe(400);
    expect(jwt).toBe('after-a-bad-post');
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

describe('the revisions consent callback', () => {
  it('treats a POST with no JSON body as no choice rather than failing the request', async () => {
    // The choice resolves as the response is sent, before the client has read
    // it, so hold on to the request and await it separately.
    let posted: Promise<Response> | undefined;
    const choice = await requestRevisionsLicenseConsent('a deployment', 'an action', {
      openBrowser: false,
      onReady: (port) => {
        posted = postText(port, 'not json');
      },
    });
    expect((await posted)?.status).toBe(200);
    expect(typeof choice).toBe('string');
  });
});
