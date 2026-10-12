import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResolvedFormioConfig } from '../config.js';
import { postLoginToken } from './test-helpers.js';

// The opener's exit status is no longer observed — a detached launch reports only a
// failure to start — so the login URL on stderr is the one guarantee that the user can
// reach the login page. It is printed before the launch is attempted, and printed
// again beside a launch failure.
const mockOpenInBrowser = vi.fn();
vi.mock('../browser-launch.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../browser-launch.js')>()),
  openInBrowser: (...args: unknown[]) => mockOpenInBrowser(...args),
}));

const { authenticate } = await import('../auth.js');

const CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid/sub',
  projectUrl: 'https://formio.invalid/sub/example',
  forceBrowser: true,
};

describe('the login URL is printed whether or not the browser opens', () => {
  let stderr: string[];

  beforeEach(() => {
    stderr = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk): boolean => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    });
    mockOpenInBrowser.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints it before launching the browser', async () => {
    let printedBeforeLaunch = '';
    mockOpenInBrowser.mockImplementation(() => {
      printedBeforeLaunch = stderr.join('');
    });
    let loginUrl = '';

    await authenticate(CONFIG, {
      onReady: async (port) => {
        loginUrl = `http://127.0.0.1:${port}/`;
        await postLoginToken(port, 'jwt');
      },
    });

    expect(mockOpenInBrowser).toHaveBeenCalledWith(loginUrl, expect.any(Function));
    expect(printedBeforeLaunch).toContain(loginUrl);
  });

  it('names the failure and the login URL when the browser cannot be opened', async () => {
    mockOpenInBrowser.mockImplementation((_url: string, onError: (err: Error) => void) => {
      onError(new Error('spawn xdg-open ENOENT'));
    });
    let loginUrl = '';

    await authenticate(CONFIG, {
      onReady: async (port) => {
        loginUrl = `http://127.0.0.1:${port}/`;
        await postLoginToken(port, 'jwt');
      },
    });

    const failure = stderr.find((line) => line.includes('spawn xdg-open ENOENT'));
    expect(failure).toBeDefined();
    expect(failure).toContain(loginUrl);
  });
});
