import { execFile } from 'child_process';

export interface BrowserLaunchCommand {
  command: string;
  args: readonly string[];
}

/**
 * The program that opens `url` in the user's default browser, with the URL as
 * its own argument.
 *
 * Windows deliberately avoids `start`. It is a cmd.exe built-in, so it needs a
 * shell, and it reads its first quoted argument as a window title: `start
 * "http://…"` opens an empty console titled with the URL and launches nothing.
 * The URL protocol handler opens the default browser directly, with no shell to
 * parse the URL and no title slot for it to fall into.
 */
export function browserLaunchCommand(
  url: string,
  platform: NodeJS.Platform = process.platform
): BrowserLaunchCommand {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: [url] };
    case 'win32':
      return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
    default:
      return { command: 'xdg-open', args: [url] };
  }
}

/**
 * Opens `url` in the default browser without a shell. A launch failure goes to
 * `onError`; the caller decides how to tell the user, since only it knows what
 * the page was for.
 */
export function openInBrowser(url: string, onError?: (err: Error) => void): void {
  const { command, args } = browserLaunchCommand(url);
  execFile(command, args, { windowsHide: true }, (err) => {
    if (err) {
      onError?.(err);
    }
  });
}
