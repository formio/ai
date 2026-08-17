import fs from 'fs';

// No platform field: the only thing the platform ever decided was whether a
// missing DISPLAY counted against the host, and it no longer does.
export interface BrowserEnvironment {
  env: Record<string, string | undefined>;
  hasContainerMarker: boolean;
}

// Consent, not detection: the caller has bound the login server to an address
// its user can reach (FORMIO_AUTH_HOST plus FORMIO_AUTH_PORT), so "this host
// cannot show a browser" no longer implies "this login cannot complete".
export interface BrowserAvailabilityOptions {
  publishedLoginEndpoint?: boolean;
}

const CONTAINER_MARKER = '/.dockerenv';

// A devcontainer, a Codespace, or any workspace opened over VS Code Remote: the
// editor forwards the ports its workspace listens on automatically, and the
// browser is on the user's own machine. Auto-forwarding sets neither
// FORMIO_AUTH_HOST nor FORMIO_AUTH_PORT, so without these markers the container
// check blocked precisely the users the published-endpoint exemption was written
// to spare — and blocked them before the port was bound, so the login URL they
// could have opened was never printed.
const EDITOR_FORWARDED_MARKERS = ['CODESPACES', 'REMOTE_CONTAINERS', 'VSCODE_IPC_HOOK_CLI'];

function hasDisplay(env: Record<string, string | undefined>): boolean {
  return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

function hasEditorForwardedPorts(env: Record<string, string | undefined>): boolean {
  return EDITOR_FORWARDED_MARKERS.some((marker) => Boolean(env[marker]));
}

// Returns a human-readable reason when the host cannot present a browser to the
// user, or null when it can. Deliberately biased towards "a browser exists":
// a false negative costs one login timeout, while a false positive would block
// a desktop user who has no API key.
export function browserlessReason(
  { env, hasContainerMarker }: BrowserEnvironment,
  { publishedLoginEndpoint = false }: BrowserAvailabilityOptions = {}
): string | null {
  if (env.CI && env.CI !== 'false' && env.CI !== '0') {
    return 'this looks like a CI runner (CI is set)';
  }
  // Everything below this line asks one question: can THIS host open a browser?
  // Publishing the login endpoint — or running under an editor that forwards
  // ports for you — answers a different and sufficient one: the browser is on
  // the user's machine and can reach us, so that settles all of them at once. A
  // container, a remote shell, and a host with no display server are the same
  // situation once the page is reachable, and this is the remedy the error text
  // itself recommends. CI is the exception above: nobody is watching a runner,
  // whatever it publishes.
  if (publishedLoginEndpoint || hasEditorForwardedPorts(env)) {
    return null;
  }
  // Displayless, like the remote-shell check below it. A container is evidence
  // that the browser is probably elsewhere, never that it certainly is: a dev
  // container started with the host's X socket shared in (docker run -e DISPLAY=:0
  // -v /tmp/.X11-unix:/tmp/.X11-unix) opens the user's own browser and carries
  // none of the editor-forwarding markers above. Answering here before the display
  // was consulted failed that login outright — and failed it before the port was
  // bound, so the login URL the caller prints never reached the user either.
  if ((hasContainerMarker || env.container) && !hasDisplay(env)) {
    return 'this looks like a container with no display';
  }
  if ((env.SSH_CONNECTION || env.SSH_TTY) && !hasDisplay(env)) {
    return 'this looks like a remote shell (SSH with no display)';
  }
  // A missing DISPLAY is deliberately NOT a reason on its own. An agent started
  // from a systemd user unit, or in a tmux session that predates the graphical
  // login, inherits no display variable and still has a browser one loopback
  // away — and failing here happens before the port is bound, so the login URL
  // this module's caller always prints never reaches the user. The environments
  // where the browser really is elsewhere each have their own signal above.
  return null;
}

export function currentBrowserEnvironment(): BrowserEnvironment {
  return {
    env: process.env,
    hasContainerMarker: fs.existsSync(CONTAINER_MARKER),
  };
}
