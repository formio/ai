import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deploymentRequest } from './harness.js';

vi.mock('../../token-cache.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../token-cache.js')>()),
  readToken: vi.fn(() => 'token'),
}));

// The clean-up requests trust a deployment exactly as the server does: with
// FORMIO_INSECURE_TLS on, a request to the project's or deployment's host is sent
// with the relaxed dispatcher; any other host, or the variable off, verifies the
// certificate as usual.
describe('deploymentRequest certificate trust', () => {
  const original = process.env.FORMIO_INSECURE_TLS;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (original === undefined) delete process.env.FORMIO_INSECURE_TLS;
    else process.env.FORMIO_INSECURE_TLS = original;
  });

  const call = async () => {
    const fetchMock = vi.fn<(url: URL | string, init?: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await deploymentRequest({
      projectUrl: 'https://form.test/sandbox',
      baseUrl: 'https://form.test',
      method: 'GET',
      path: '/tag/current',
    });
    return fetchMock.mock.calls[0]?.[1] as { dispatcher?: unknown } | undefined;
  };

  it('relaxes the check for the deployment when FORMIO_INSECURE_TLS is on', async () => {
    process.env.FORMIO_INSECURE_TLS = 'true';
    expect((await call())?.dispatcher).toBeDefined();
  });

  it('verifies the certificate when FORMIO_INSECURE_TLS is off', async () => {
    delete process.env.FORMIO_INSECURE_TLS;
    expect((await call())?.dispatcher).toBeUndefined();
  });
});

// Clean-up authenticates exactly as the server does for the same folder: a
// FORMIO_API_KEY applies only to the project FORMIO_PROJECT_URL names, and is used in
// preference to a login; otherwise the cached portal-login token is sent.
describe('deploymentRequest credentials', () => {
  const saved = { ...process.env };
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...saved };
  });

  const headersSent = async (cwd: string) => {
    const fetchMock = vi.fn<(url: URL | string, init?: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await deploymentRequest({
      cwd,
      projectUrl: 'https://form.test/sandbox',
      baseUrl: 'https://form.test',
      method: 'GET',
      path: '/tag/current',
    });
    return fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
  };

  it('sends a bound API key in preference to the cached login', async () => {
    process.env.FORMIO_PROJECT_URL = 'https://form.test/sandbox';
    process.env.FORMIO_API_KEY = 'bound-key';
    const headers = await headersSent(mkdtempSync(join(tmpdir(), 'live-auth-')));
    expect(headers['x-token']).toBe('bound-key');
    expect(headers['x-jwt-token']).toBeUndefined();
  });

  it('sends the cached login when the key belongs to another project', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'live-auth-'));
    writeFileSync(
      join(dir, 'formio.json'),
      JSON.stringify({ projectUrl: 'https://form.test/sandbox' })
    );
    process.env.FORMIO_PROJECT_URL = 'https://form.test/other';
    process.env.FORMIO_API_KEY = 'other-key';
    const headers = await headersSent(dir);
    expect(headers['x-jwt-token']).toBe('token');
    expect(headers['x-token']).toBeUndefined();
  });
});

// A stalled deployment must not hang clean-up — least of all on Ctrl-C, which waits
// for it before exiting.
describe('deploymentRequest timeout', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gives up on a request that never answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: URL | string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          })
      )
    );
    await expect(
      deploymentRequest({
        projectUrl: 'https://form.test/sandbox',
        baseUrl: 'https://form.test',
        method: 'GET',
        path: '/tag/current',
        timeoutMs: 50,
      })
    ).rejects.toThrow(/timed out|abort/i);
  });
});
