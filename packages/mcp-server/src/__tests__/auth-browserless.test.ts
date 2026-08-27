import { exec } from 'child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../auth.js';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('child_process', () => ({ exec: vi.fn() }));

const CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid/sub',
  projectUrl: 'https://formio.invalid/sub/example',
};

// A host with no browser must be told so immediately. Waiting out the login
// timeout in CI, a cloud agent, or a container is pure dead time, and the
// guidance the user needs (an API key) arrives only at the very end.
describe('authenticate on a browserless host', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SSH_CONNECTION;
    delete process.env.SSH_TTY;
    process.env.CI = 'true';
    vi.mocked(exec).mockReset();
    vi.spyOn(process.stderr, 'write').mockImplementation((): boolean => true);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('rejects immediately rather than waiting for the login timeout', async () => {
    const started = Date.now();

    await expect(authenticate(CONFIG)).rejects.toThrow();

    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('names every way forward in the error', async () => {
    await expect(authenticate(CONFIG)).rejects.toThrow(/FORMIO_API_KEY/);
    await expect(authenticate(CONFIG)).rejects.toThrow(/FORMIO_AUTH_HOST/);
    await expect(authenticate(CONFIG)).rejects.toThrow(/FORMIO_AUTH_PORT/);
    await expect(authenticate(CONFIG)).rejects.toThrow(/FORMIO_FORCE_BROWSER/);
  });

  it('never launches a browser', async () => {
    await expect(authenticate(CONFIG)).rejects.toThrow();

    expect(vi.mocked(exec)).not.toHaveBeenCalled();
  });

  it('never binds a port', async () => {
    const onReady = vi.fn();

    await expect(authenticate(CONFIG, { onReady })).rejects.toThrow();

    expect(onReady).not.toHaveBeenCalled();
  });

  it('proceeds normally when forceBrowser overrides the detection', async () => {
    let observedPort = 0;

    const jwt = await authenticate(
      { ...CONFIG, forceBrowser: true },
      {
        onReady: async (port) => {
          observedPort = port;
          await fetch(`http://127.0.0.1:${port}/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'forced' }),
          });
        },
      }
    );

    expect(observedPort).toBeGreaterThan(1024);
    expect(jwt).toBe('forced');
  });

  it('mentions a container when one is what made the host browserless', async () => {
    delete process.env.CI;
    process.env.container = 'podman';

    await expect(authenticate(CONFIG)).rejects.toThrow(/container/i);
  });

  // The container branch is the one the error offers a remedy for: publish the
  // login port and open it from the host's browser. Configuring exactly that has
  // to get through, or a devcontainer user follows the advice and hits the same
  // wall.
  it('proceeds in a container once an auth host and port are configured', async () => {
    delete process.env.CI;
    process.env.container = 'podman';

    const jwt = await authenticate(
      { ...CONFIG, authHost: '127.0.0.1', authPort: 43117 },
      {
        onReady: async (port) => {
          await fetch(`http://127.0.0.1:${port}/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'published' }),
          });
        },
      }
    );

    expect(jwt).toBe('published');
  });

  it('still refuses in a container when only the host is configured', async () => {
    delete process.env.CI;
    process.env.container = 'podman';

    await expect(authenticate({ ...CONFIG, authHost: '0.0.0.0' })).rejects.toThrow(/container/i);
  });
});
