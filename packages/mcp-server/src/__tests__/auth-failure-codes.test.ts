// A browser login that cannot complete — no browser, or no login before the timeout —
// leaves the call without a credential, so it is AUTH_REQUIRED. A failure with a cause
// of its own keeps that cause's code: a login form that could not be resolved keeps
// the code it was raised with, and a login port that cannot be bound is INTERNAL with
// the cause in the message. Each keeps its own prose, which tells the user what to do.

import net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate, loginFormFailed } from '../auth.js';
import { FormioNetworkError, ToolError } from '../tool-errors.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('child_process', () => ({ execFile: vi.fn() }));

const CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid/sub',
  projectUrl: 'https://formio.invalid/sub/example',
  forceBrowser: true,
};

describe('a failed browser login carries the code of its cause', () => {
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

      await expect(attempt).rejects.toMatchObject({ code: 'INTERNAL' });
      await expect(attempt).rejects.toThrow(/Could not start the Form\.io login server/);
      await expect(attempt).rejects.toThrow(/EADDRINUSE/);
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

    await expect(attempt).rejects.toMatchObject({ code: 'INTERNAL' });
    await expect(attempt).rejects.toThrow(/Invalid URL/);
  });
});

describe('loginFormFailed', () => {
  it.each([
    [
      'NETWORK_ERROR',
      new FormioNetworkError({ url: 'https://formio.invalid/x', cause: new Error('ECONNREFUSED') }),
    ],
    ['NOT_FOUND', new ToolError({ code: 'NOT_FOUND', message: 'no login form' })],
    ['UPSTREAM_ERROR', new ToolError({ code: 'UPSTREAM_ERROR', message: '502' })],
  ])('keeps %s from a ToolError', (code, error) => {
    const failure = loginFormFailed(error);

    expect(failure).toMatchObject({ code });
    expect(failure.message).toContain(error.message);
    expect(failure.cause).toBe(error);
  });

  it('is INTERNAL for any other error, with its message', () => {
    const failure = loginFormFailed(new TypeError('Invalid URL'));

    expect(failure).toMatchObject({ code: 'INTERNAL' });
    expect(failure.message).toContain('Invalid URL');
  });
});
