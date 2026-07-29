import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { authenticate } from '../auth.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('child_process', () => ({ exec: vi.fn() }));

const DEFAULT_CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid',
  projectUrl: 'https://formio.invalid/example',
};

function postCallback(port: number, token: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

describe('authenticate in headless environments', () => {
  let stderr: string[];

  beforeEach(() => {
    stderr = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk): boolean => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    });
    vi.mocked(exec).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Without this a headless user has no way to reach the login page: the URL is
  // only ever handed to the browser-launcher, which does not exist there.
  it('writes the login URL to stderr so it can be opened manually', async () => {
    await authenticate(DEFAULT_CONFIG, {
      onReady: async (port) => {
        await postCallback(port, 'jwt');
      },
    });

    const logged = stderr.join('');
    expect(logged).toContain('/');
    expect(logged).toMatch(/http:\/\/[^\s]+/);
  });

  // A container must publish a known port, and the host browser cannot reach a
  // server bound to the container's loopback address.
  it('honours an explicit bind host and port', async () => {
    let observed = 0;
    await authenticate(
      { ...DEFAULT_CONFIG, authHost: '0.0.0.0', authPort: 43117 },
      {
        onReady: async (port) => {
          observed = port;
          await postCallback(port, 'jwt');
        },
      }
    );

    expect(observed).toBe(43117);
  });

  // The spawn failure was previously swallowed, leaving no clue why nothing
  // opened.
  it('reports a failure to launch the browser instead of swallowing it', async () => {
    vi.mocked(exec).mockImplementation(((
      _cmd: string,
      cb?: (err: Error | null) => void
    ): unknown => {
      cb?.(new Error('xdg-open ENOENT'));
      return {};
    }) as unknown as typeof exec);

    await authenticate(DEFAULT_CONFIG, {
      onReady: async (port) => {
        await postCallback(port, 'jwt');
      },
    });

    expect(stderr.join('')).toMatch(/could not open a browser/i);
  });

  // Previously this hung forever, so the tool call never returned and the client
  // had nothing to report.
  it('rejects with an actionable error when no login arrives before the timeout', async () => {
    await expect(authenticate({ ...DEFAULT_CONFIG, authTimeoutMs: 50 })).rejects.toThrow(
      /FORMIO_API_KEY/
    );
  });

  // The error is returned to the MCP client as tool output, so it reaches the
  // user directly. Relying on stderr alone assumes they know to go read logs.
  it('includes the login URL in the timeout error', async () => {
    await expect(
      authenticate({ ...DEFAULT_CONFIG, authPort: 43219, authTimeoutMs: 50 })
    ).rejects.toThrow(/http:\/\/127\.0\.0\.1:43219\//);
  });

  // Guards the desktop and Claude Code plugin path, which is the common case:
  // neither sets any FORMIO_AUTH_* variable, so it must still bind an ephemeral
  // port on loopback and launch a browser, exactly as it did before headless
  // support was added.
  it('still binds loopback on an ephemeral port and launches a browser by default', async () => {
    let observedPort = 0;
    await authenticate(DEFAULT_CONFIG, {
      onReady: async (port) => {
        observedPort = port;
        await postCallback(port, 'jwt');
      },
    });

    // Ephemeral, not a fixed port.
    expect(observedPort).toBeGreaterThan(1024);

    const opener =
      process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    const command = vi.mocked(exec).mock.calls[0]?.[0] as string;
    expect(command).toContain(opener);
    expect(command).toContain(`http://127.0.0.1:${observedPort}/`);
  });

  it('does not reject when the login arrives before the timeout', async () => {
    const jwt = await authenticate(
      { ...DEFAULT_CONFIG, authTimeoutMs: 5000 },
      {
        onReady: async (port) => {
          await postCallback(port, 'in-time');
        },
      }
    );

    expect(jwt).toBe('in-time');
  });
});
