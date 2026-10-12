import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { ChildProcess, execFile, spawn } from 'child_process';
import { browserLaunchCommand, openInBrowser } from '../browser-launch.js';

vi.mock('child_process', () => ({ execFile: vi.fn(), spawn: vi.fn() }));

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
  let child: EventEmitter & { unref: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.mocked(execFile).mockReset();
    child = Object.assign(new EventEmitter(), { unref: vi.fn() });
    vi.mocked(spawn)
      .mockReset()
      .mockReturnValue(child as unknown as ChildProcess);
  });

  // No shell, so the URL reaches the opener as one argument. Detached with its
  // streams ignored, so nothing is buffered — and so nothing is capped: an opener
  // that keeps the browser as its child cannot have it terminated for writing too
  // much output, and the server never holds the browser.
  it('starts the opener detached, with its output ignored, passing the URL as its own argument', () => {
    openInBrowser(URL);

    const { command, args } = browserLaunchCommand(URL);
    expect(vi.mocked(spawn)).toHaveBeenCalledWith(command, args, {
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });
  });

  it('does not keep the server waiting on the opener', () => {
    openInBrowser(URL);

    expect(child.unref).toHaveBeenCalledOnce();
  });

  it('never uses execFile, which buffers the output and kills the child past its cap', () => {
    openInBrowser(URL);

    expect(vi.mocked(execFile)).not.toHaveBeenCalled();
  });

  it('reports a failure to start the opener to the caller', () => {
    const onError = vi.fn();
    openInBrowser(URL, onError);

    child.emit('error', new Error('spawn xdg-open ENOENT'));

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'spawn xdg-open ENOENT' })
    );
  });

  it('reports a spawn that throws to the caller', () => {
    vi.mocked(spawn).mockImplementation(() => {
      throw new Error('spawn EINVAL');
    });
    const onError = vi.fn();

    expect(() => openInBrowser(URL, onError)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'spawn EINVAL' }));
  });

  // An 'error' event with no listener is thrown by the emitter, taking the server down.
  it('handles a failure to start even with no caller listening', () => {
    openInBrowser(URL);

    expect(() => child.emit('error', new Error('spawn xdg-open ENOENT'))).not.toThrow();
  });

  it('does not report success as a failure', () => {
    const onError = vi.fn();
    openInBrowser(URL, onError);
    child.emit('exit', 0, null);

    expect(onError).not.toHaveBeenCalled();
  });

  // xdg-open and open exit non-zero when they cannot open the URL — no browser, no
  // handler for it — and the caller then prints the "open it manually" hint.
  it('reports an opener that exits non-zero, naming the command and the code', () => {
    const onError = vi.fn();
    openInBrowser(URL, onError);

    child.emit('exit', 3, null);

    const { command } = browserLaunchCommand(URL);
    expect(onError).toHaveBeenCalledOnce();
    const [error] = onError.mock.calls[0] as [Error];
    expect(error.message).toContain(command);
    expect(error.message).toContain('3');
  });

  it('reports a failure once when the opener fails to start and then exits', () => {
    const onError = vi.fn();
    openInBrowser(URL, onError);

    child.emit('error', new Error('spawn xdg-open ENOENT'));
    child.emit('exit', 1, null);

    expect(onError).toHaveBeenCalledOnce();
  });

  it('handles a non-zero exit with no caller listening', () => {
    openInBrowser(URL);

    expect(() => child.emit('exit', 1, null)).not.toThrow();
  });
});
