/**
 * FORMIO_INSECURE_TLS skips certificate verification for the resolved deployment
 * only: requests to the project URL's host or the Base URL's host are given a
 * connection setting that accepts a self-signed certificate, every other request
 * verifies as usual, and NODE_TLS_REJECT_UNAUTHORIZED is never changed.
 *
 * The HTTPS server below presents a certificate generated for this run, so no
 * client trusts it unless verification is skipped for its host. It listens on
 * 127.0.0.1; `localhost` reaches the same server under a different host name.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfig, ResolvedFormioConfig } from '../config.js';
import { formioRawFetch, selectDispatcher, send } from '../formio-client.js';
import { checkRevisionsLicensed } from '../revisions/license.js';
import { checkCurrentUser } from '../token-validation.js';
import { FormioNetworkError } from '../tool-errors.js';

interface Certificate {
  key: Buffer;
  cert: Buffer;
}

function generateCertificate(): Certificate {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-self-signed-'));
  try {
    const keyPath = path.join(dir, 'key.pem');
    const certPath = path.join(dir, 'cert.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-days',
        '1',
        '-subj',
        '/CN=127.0.0.1',
      ],
      { stdio: 'ignore' }
    );
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

let server: https.Server;
let port: number;

beforeAll(async () => {
  server = https.createServer(generateCertificate(), (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/config.js') {
      res.end('var sac = true;');
      return;
    }
    res.end(JSON.stringify({ _id: 'abc', data: { email: 'user@example.com' } }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const deployment = () => `https://127.0.0.1:${port}`;
const otherHost = () => `https://localhost:${port}`;

function config(overrides: Partial<ResolvedFormioConfig> = {}): ResolvedFormioConfig {
  return {
    projectUrl: `${deployment()}/myproject`,
    baseUrl: deployment(),
    apiKey: 'key',
    insecureTls: true,
    ...overrides,
  };
}

describe('send with FORMIO_INSECURE_TLS', () => {
  it('reaches the project host when it presents a self-signed certificate', async () => {
    await expect(
      send(new URL(`${deployment()}/myproject/form`), {
        certificateScope: { insecureTls: true, projectUrl: `${deployment()}/myproject` },
      })
    ).resolves.toMatchObject({ status: 200 });
  });

  it('reaches the Base URL host when it presents a self-signed certificate', async () => {
    await expect(
      send(new URL(`${deployment()}/current`), {
        certificateScope: {
          insecureTls: true,
          projectUrl: 'https://myproject.example.com',
          baseUrl: deployment(),
        },
      })
    ).resolves.toMatchObject({ status: 200 });
  });

  it('verifies the certificate of a host that is neither the project nor the Base URL host', async () => {
    await expect(
      send(new URL(`${otherHost()}/form`), { certificateScope: config() })
    ).rejects.toBeInstanceOf(FormioNetworkError);
  });

  it('verifies the deployment certificate when the setting is off', async () => {
    await expect(
      send(new URL(`${deployment()}/myproject/form`), {
        certificateScope: config({ insecureTls: false }),
      })
    ).rejects.toBeInstanceOf(FormioNetworkError);
  });

  it('carries the setting through formioRawFetch', async () => {
    await expect(
      formioRawFetch(new URL(`${deployment()}/myproject/form`), config())
    ).resolves.toMatchObject({ _id: 'abc' });
  });

  it('carries the setting through the /current check', async () => {
    await expect(checkCurrentUser(config({ jwt: 'token' }))).resolves.toEqual({
      accepted: true,
      account: 'user@example.com',
    });
  });

  it('carries the setting through the licence probe', async () => {
    await expect(checkRevisionsLicensed(config())).resolves.toEqual({ state: 'licensed' });
  });
});

describe('selectDispatcher', () => {
  const scope = () => ({
    insecureTls: true,
    projectUrl: 'https://myproject.forms.internal',
    baseUrl: 'https://api.forms.internal',
  });

  it('gives the project host the relaxed dispatcher', async () => {
    expect(
      await selectDispatcher(new URL('https://myproject.forms.internal/form'), scope())
    ).toBeDefined();
  });

  it('gives the Base URL host the relaxed dispatcher', async () => {
    expect(
      await selectDispatcher(new URL('https://api.forms.internal/current'), scope())
    ).toBeDefined();
  });

  it('creates one dispatcher and reuses it', async () => {
    const first = await selectDispatcher(new URL('https://myproject.forms.internal/a'), scope());
    const second = await selectDispatcher(new URL('https://api.forms.internal/b'), scope());
    expect(first).toBeDefined();
    expect(second).toBe(first);
  });

  it('gives any other host none', async () => {
    expect(
      await selectDispatcher(new URL('https://cdn.example.com/x.js'), scope())
    ).toBeUndefined();
  });

  it('gives no host one when the setting is off', async () => {
    expect(
      await selectDispatcher(new URL('https://myproject.forms.internal/form'), {
        ...scope(),
        insecureTls: false,
      })
    ).toBeUndefined();
  });

  it('gives no host one without a scope', async () => {
    expect(
      await selectDispatcher(new URL('https://myproject.forms.internal/form'), undefined)
    ).toBeUndefined();
  });
});

describe('the request send makes', () => {
  const mockFetch = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(new Response('{}'))
  );

  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sentInit(): RequestInit {
    return mockFetch.mock.calls[0][1];
  }

  it('passes no dispatcher when the setting is off', async () => {
    await send(new URL('https://myproject.forms.internal/form'), {
      certificateScope: { insecureTls: false, projectUrl: 'https://myproject.forms.internal' },
    });
    expect(sentInit()).not.toHaveProperty('dispatcher');
  });

  it('passes no dispatcher to a host outside the scope', async () => {
    await send(new URL('https://cdn.example.com/x.js'), {
      certificateScope: { insecureTls: true, projectUrl: 'https://myproject.forms.internal' },
    });
    expect(sentInit()).not.toHaveProperty('dispatcher');
  });

  it('passes the dispatcher to a host in the scope', async () => {
    await send(new URL('https://myproject.forms.internal/form'), {
      certificateScope: { insecureTls: true, projectUrl: 'https://myproject.forms.internal' },
    });
    expect(sentInit()).toHaveProperty('dispatcher', expect.anything());
  });

  it('does not hand the scope itself to fetch', async () => {
    await send(new URL('https://myproject.forms.internal/form'), {
      certificateScope: { insecureTls: true, projectUrl: 'https://myproject.forms.internal' },
    });
    expect(sentInit()).not.toHaveProperty('certificateScope');
  });
});

describe('FORMIO_INSECURE_TLS and the process', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('leaves NODE_TLS_REJECT_UNAUTHORIZED unchanged when the client loads', async () => {
    process.env.FORMIO_INSECURE_TLS = 'true';
    vi.resetModules();
    await import('../formio-client.js');
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  });

  it('is read into the configuration', () => {
    process.env.FORMIO_INSECURE_TLS = 'true';
    expect(getConfig().insecureTls).toBe(true);
  });
});
