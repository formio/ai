import { spawn } from 'child_process';
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
export function browserLaunchCommand(url, platform = process.platform) {
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
 * Opens `url` in the default browser without a shell. A failure — the opener cannot
 * start, or exits non-zero — goes to `onError`, once; the caller decides how to tell the
 * user, since only it knows what the page was for.
 *
 * Detached, with every stream ignored and the child unreferenced: `xdg-open` can keep
 * the browser as its own child, and a launcher that buffers that output, waits on it,
 * or caps it would hold — or terminate — the browser mid-login. The exit is observed
 * without being waited on: `open` and `xdg-open` exit non-zero when nothing can open
 * the URL. A zero exit is not proof a browser opened (Windows' `rundll32` reports
 * nothing either way), so the caller prints the URL every time.
 */
export function openInBrowser(url, onError) {
    const { command, args } = browserLaunchCommand(url);
    let reported = false;
    const report = (err) => {
        if (!reported) {
            reported = true;
            onError?.(err);
        }
    };
    try {
        const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
        // Always listened for: an 'error' with no listener is thrown, taking the server down.
        child.on('error', report);
        child.on('exit', (code) => {
            if (code !== null && code !== 0) {
                report(new Error(`${command} exited with code ${code}`));
            }
        });
        child.unref();
    }
    catch (err) {
        report(err instanceof Error ? err : new Error(String(err)));
    }
}
