// Every way the browser login can fail is the same answer to a caller: no credential
// was obtained, so the call needs authentication it does not have. Each failure keeps
// its own prose — that is what tells the user what to do — and carries AUTH_REQUIRED,
// so a client branching on the code sees an authentication failure rather than
// INTERNAL.

import net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../auth.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('child_process', () => ({ execFile: vi.fn() }));

const CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid/sub',
  projectUrl: 'https://formio.invalid/sub/example',
  forceBrowser: true,
};

describe('a failed browser login carries AUTH_REQUIRED', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.spyOn(process.stderr, 'write').mockImplementation((): boolean => true);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('on a host with no browser', async () => {
    delete process.env.SSH_CONNECTION;
    delete process.env.SSH_TTY;
    process.env.CI = 'true';

    const attempt = authenticate({ ...CONFIG, forceBrowser: false });

    await expect(attempt).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(attempt).rejects.toThrow(/Cannot complete the Form\.io browser login/);
  });

  it('when no login arrives before the timeout', async () => {
    const attempt = authenticate({ ...CONFIG, authTimeoutMs: 50 });

    await expect(attempt).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(attempt).rejects.toThrow(/Timed out after/);
  });

  it('when the login port cannot be bound', async () => {
    const squatter = net.createServer();
    await new Promise<void>((resolve) => squatter.listen(0, '127.0.0.1', resolve));
    const port = (squatter.address() as net.AddressInfo).port;
    try {
      const attempt = authenticate({
        ...CONFIG,
        authHost: '127.0.0.1',
        authPort: port,
        authTimeoutMs: 60_000,
      });

      await expect(attempt).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
      await expect(attempt).rejects.toThrow(/Could not start the Form\.io login server/);
    } finally {
      await new Promise<void>((resolve) => squatter.close(() => resolve()));
    }
  });

  it('when the login form cannot be resolved', async () => {
    const attempt = authenticate(
      { ...CONFIG, loginFormUrl: 'not a url', authTimeoutMs: 60_000 },
      {
        onReady: (port) => {
          void fetch(`http://127.0.0.1:${port}/`).catch(() => undefined);
        },
      }
    );

    await expect(attempt).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(attempt).rejects.toThrow(/Invalid URL/);
  });
});
