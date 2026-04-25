import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../auth.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('child_process', () => ({ exec: vi.fn() }));

const DEFAULT_CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://form.local',
  projectUrl: 'https://form.local/example',
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

    expect(html).toContain('formio.form.min.js');
    expect(html).toContain('Formio.createForm');
    expect(html).toContain('https://form.local/formio/user/login');
  });

  it('uses custom loginFormUrl when set instead of the default', async () => {
    const config: ResolvedFormioConfig = {
      baseUrl: 'https://form.local',
      projectUrl: 'https://form.local/example',
      loginFormUrl: 'https://custom.form.io/mylogin',
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
    expect(html).not.toContain('https://form.local/formio/user/login');
  });
});
