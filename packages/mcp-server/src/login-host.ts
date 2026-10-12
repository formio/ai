/**
 * Which Host headers the local login server answers, decided by where it is bound.
 *
 * - Loopback — the default, or FORMIO_AUTH_HOST naming a loopback address: the page is
 *   for a browser on this machine, which addresses the server as `localhost`,
 *   `127.0.0.1` or `[::1]` at the port it listens on. Anything else is refused.
 * - Every interface — FORMIO_AUTH_HOST `0.0.0.0` or `::`: the user has opted into
 *   access from another host, such as a devcontainer or Codespaces forwarded port that
 *   serves the page under a name and port this server cannot know. The Host header is
 *   not checked; `/callback` still requires the per-login value.
 * - A specific other host: that host or a loopback name, at any port, since a
 *   forwarded port may be remapped.
 */
export interface LoginHostCheck {
  /** The request's Host header, as received. */
  host: string | undefined;
  /** The port the login server is listening on. */
  port: number;
  /** FORMIO_AUTH_HOST, when set. */
  configuredHost?: string;
}

const LOOPBACK_NAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

const WILDCARD_HOSTS: ReadonlySet<string> = new Set(['0.0.0.0', '[::]']);

// A host as a URL spells it: lower-cased, and an IPv6 address in brackets.
const urlHostname = (host: string): string | undefined => {
  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  try {
    return new URL(`http://${bracketed}`).hostname;
  } catch {
    return undefined;
  }
};

// The Host header as a URL reads it, or undefined when it is absent or malformed.
const addressedTo = (host: string | undefined): URL | undefined => {
  if (!host) {
    return undefined;
  }
  try {
    return new URL(`http://${host}`);
  } catch {
    return undefined;
  }
};

export function acceptsLoginHost({ host, port, configuredHost }: LoginHostCheck): boolean {
  const bound = configuredHost ? urlHostname(configuredHost) : undefined;
  if (bound !== undefined && WILDCARD_HOSTS.has(bound)) {
    return true;
  }
  const addressed = addressedTo(host);
  if (addressed === undefined) {
    return false;
  }
  if (bound !== undefined && !LOOPBACK_NAMES.has(bound)) {
    return addressed.hostname === bound || LOOPBACK_NAMES.has(addressed.hostname);
  }
  // A URL drops the scheme's default port, so an absent one means 80.
  return LOOPBACK_NAMES.has(addressed.hostname) && (addressed.port || '80') === String(port);
}
