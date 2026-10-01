import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { browserLaunchCommand } from '../browser-launch.js';
import { requestRevisionsLicenseConsent } from '../revisions/browser-prompts.js';

vi.mock('child_process', () => ({ execFile: vi.fn() }));

function postChoice(port: number, choice: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice }),
  });
}

describe('opening the revisions consent page', () => {
  let stderr: string[];

  beforeEach(() => {
    stderr = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk): boolean => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    });
    vi.mocked(execFile).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('launches the browser without a shell, the URL as an argument of its own', async () => {
    let consentUrl = '';
    await requestRevisionsLicenseConsent('a deployment', 'an action', {
      onReady: async (port) => {
        consentUrl = `http://127.0.0.1:${port}/`;
        await postChoice(port, 'continue');
      },
    });

    const { command, args } = browserLaunchCommand(consentUrl);
    const [file, passedArgs] = vi.mocked(execFile).mock.calls[0] ?? [];
    expect(file).toBe(command);
    expect(passedArgs).toEqual(args);
  });

  // The launch failure was previously ignored, so a user whose browser never
  // opened had no URL to open by hand.
  it('names the consent URL when the browser cannot be launched', async () => {
    vi.mocked(execFile).mockImplementation(((
      _file: string,
      _args: readonly string[],
      _options: unknown,
      cb?: (err: Error | null) => void
    ): unknown => {
      cb?.(new Error('spawn xdg-open ENOENT'));
      return {};
    }) as unknown as typeof execFile);

    let consentUrl = '';
    await requestRevisionsLicenseConsent('a deployment', 'an action', {
      onReady: async (port) => {
        consentUrl = `http://127.0.0.1:${port}/`;
        await postChoice(port, 'continue');
      },
    });

    const logged = stderr.join('');
    expect(logged).toMatch(/could not open a browser/i);
    expect(logged).toContain(consentUrl);
  });
});
