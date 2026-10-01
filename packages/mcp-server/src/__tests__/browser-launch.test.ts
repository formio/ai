import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import { browserLaunchCommand, openInBrowser } from '../browser-launch.js';

vi.mock('child_process', () => ({ execFile: vi.fn() }));

const URL = 'http://127.0.0.1:53555/';

describe('browserLaunchCommand', () => {
  it('uses open on macOS', () => {
    expect(browserLaunchCommand(URL, 'darwin')).toEqual({ command: 'open', args: [URL] });
  });

  it('uses xdg-open on Linux', () => {
    expect(browserLaunchCommand(URL, 'linux')).toEqual({ command: 'xdg-open', args: [URL] });
  });

  // `start "<url>"` reads its first quoted argument as a window title, so on
  // Windows it opened an empty console titled with the URL and no browser.
  it('hands the URL to the protocol handler on Windows, never to start', () => {
    const launch = browserLaunchCommand(URL, 'win32');
    expect(launch).toEqual({
      command: 'rundll32.exe',
      args: ['url.dll,FileProtocolHandler', URL],
    });
    expect([launch.command, ...launch.args]).not.toContain('start');
  });
});

describe('openInBrowser', () => {
  beforeEach(() => {
    vi.mocked(execFile).mockReset();
  });

  // execFile runs no shell, so the URL reaches the opener as one argument and
  // nothing in it is parsed as a shell token on any platform.
  it('launches without a shell, passing the URL as its own argument', () => {
    openInBrowser(URL);

    const { command, args } = browserLaunchCommand(URL);
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      command,
      args,
      expect.objectContaining({ windowsHide: true }),
      expect.any(Function)
    );
  });

  it('reports a launch failure to the caller', () => {
    vi.mocked(execFile).mockImplementation(((
      _file: string,
      _args: readonly string[],
      _options: unknown,
      cb: (err: Error | null) => void
    ): unknown => {
      cb(new Error('spawn xdg-open ENOENT'));
      return {};
    }) as unknown as typeof execFile);

    const onError = vi.fn();
    openInBrowser(URL, onError);

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'spawn xdg-open ENOENT' })
    );
  });

  it('does not report success as a failure', () => {
    vi.mocked(execFile).mockImplementation(((
      _file: string,
      _args: readonly string[],
      _options: unknown,
      cb: (err: Error | null) => void
    ): unknown => {
      cb(null);
      return {};
    }) as unknown as typeof execFile);

    const onError = vi.fn();
    openInBrowser(URL, onError);

    expect(onError).not.toHaveBeenCalled();
  });
});
