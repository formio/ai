import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../auth.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('child_process', () => ({ exec: vi.fn() }));

// forceBrowser because these tests exercise the browser login path itself, and
// the suite runs on CI — where browserless detection refuses to launch one.
const DEFAULT_CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid',
  projectUrl: 'https://formio.invalid/example',
  forceBrowser: true,
};

function postCallback(port: number, token: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

describe('authenticate', () => {
  it('starts an Express server on a random port and returns a JWT after /callback is hit', async () => {
    let serverPort = 0;
    const authPromise = authenticate(DEFAULT_CONFIG, {
      onReady: async (port) => {
        serverPort = port;
        await postCallback(port, 'test-jwt-123');
      },
    });

    const jwt = await authPromise;
    expect(serverPort).toBeGreaterThan(0);
    expect(jwt).toBe('test-jwt-123');
  });

  it('shuts down the Express server after capturing the JWT', async () => {
    let serverPort = 0;
    const authPromise = authenticate(DEFAULT_CONFIG, {
      onReady: async (port) => {
        serverPort = port;
        await postCallback(port, 'shutdown-test-jwt');
      },
    });

    await authPromise;
    expect(serverPort).toBeGreaterThan(0);

    // Server should be shut down — fetching should fail
    await expect(fetch(`http://127.0.0.1:${serverPort}/`)).rejects.toThrow();
  });

  it('GET / serves an HTML page with Form.io SDK script tag and Formio.createForm call', async () => {
    let html = '';
    const authPromise = authenticate(DEFAULT_CONFIG, {
      onReady: async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        html = await res.text();
        await postCallback(port, 'test-jwt');
      },
    });

    await authPromise;

    // The renderer is a third-party script on a page that handles the user's
    // portal credentials, so the URL must stay version-pinned and SRI-pinned.
    expect(html).not.toContain('cdn.form.io');
    expect(html).toMatch(
      /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@formio\/js@\d+\.\d+\.\d+\/dist\/formio\.form\.min\.js" integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous">/
    );
    expect(html).toMatch(
      /<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/npm\/@formio\/js@\d+\.\d+\.\d+\/dist\/formio\.form\.min\.css" integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous">/
    );
    // Same rule for every third-party asset on the page, not just the renderer.
    for (const link of html.match(
      /<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net[^>]*>/g
    ) ?? []) {
      expect(link).toMatch(/@\d+\.\d+\.\d+\//);
      expect(link).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous"/);
    }
    expect(html).toContain('Formio.createForm');
    expect(html).toContain('https://formio.invalid/formio/user/login');
  });

  it('uses custom loginFormUrl when set instead of the default', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://formio.invalid',
      projectUrl: 'https://formio.invalid/example',
      loginFormUrl: 'https://custom.form.io/mylogin',
      forceBrowser: true,
    };

    let html = '';
    const authPromise = authenticate(config, {
      onReady: async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        html = await res.text();
        await postCallback(port, 'test-jwt');
      },
    });

    await authPromise;

    expect(html).toContain('https://custom.form.io/mylogin');
    expect(html).not.toContain('https://formio.invalid/formio/user/login');
  });
});

// The README's privacy section is the disclosure that travels with the package —
// packed into the npm tarball and copied into the .mcpb bundle — so the hosts it
// names are a claim about what the sign-in page contacts. Naming a host the page
// no longer loads, or omitting one it does, is wrong in a way no other test here
// would notice.
describe('the privacy disclosure names the hosts the sign-in page contacts', () => {
  const README = path.resolve(__dirname, '../../README.md');

  it('lists every external host on the page, and no other', async () => {
    let html = '';
    await authenticate(DEFAULT_CONFIG, {
      onReady: async (port) => {
        html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
        await postCallback(port, 'test-jwt');
      },
    });

    // Every host the browser is told to fetch from, minus the deployment itself —
    // the login form's own origin is the service the user is signing in to, not a
    // third party.
    const contacted = new Set(
      [...html.matchAll(/https:\/\/([\w.-]+)/g)]
        .map((match) => match[1])
        .filter((host) => host !== new URL(DEFAULT_CONFIG.projectUrl).hostname)
    );
    const disclosure = fs
      .readFileSync(README, 'utf8')
      .split('\n')
      .find((line) => line.startsWith('**Third parties.**'));

    expect(disclosure, 'no **Third parties.** paragraph in the README').toBeDefined();
    expect([...contacted].sort()).toEqual(
      [...(disclosure as string).matchAll(/`([\w.-]+\.[a-z]{2,})`/g)].map((m) => m[1]).sort()
    );
  });
});
