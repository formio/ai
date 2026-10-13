import { afterEach, describe, expect, it, vi } from 'vitest';
import { deploymentRequest } from './harness.js';

vi.mock('../token-cache.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../token-cache.js')>()),
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
