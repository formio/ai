export const DEFAULT_BASE_URL = 'https://api.form.io';

// Form.io URLs are compared and concatenated in several places, so they are
// stored without a trailing slash wherever they enter the process.
export function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

// Shared by the project_set tool and the bin's project command, so one
// definition of "a usable Form.io URL" serves both entry points.
//
// What comes back is what new URL() made of the input, never the raw input.
// Everything downstream compares these strings — the pinned project against the
// mapped one, the token cache against its key — and concatenates them into
// request URLs, so anything the parser considers insignificant has to be gone by
// then. Whitespace around a pasted URL passes validation but breaks fetch;
// host case is significant to string equality and to no one else, so
// https://Examples.form.io and https://examples.form.io must not be two
// deployments, two cache entries, or two projects. The parser normalizes both.
export function normalizeHttpUrl(input: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error(`${label} must be a valid URL, got: ${input}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https, got: ${parsed.protocol}`);
  }
  return stripTrailingSlashes(parsed.href);
}

export interface FormioConfig {
  baseUrl?: string;
  projectUrl?: string;
  defaultProjectUrl?: string;
  apiKey?: string;
  loginFormUrl?: string;
  jwt?: string;
  authHost?: string;
  authPort?: number;
  authTimeoutMs?: number;
  forceBrowser?: boolean;
}

// After resolveProjectConfig has merged in the cwd's mapped project URL.
// baseUrl is guaranteed there: resolution applies DEFAULT_BASE_URL last, once
// the mapping has had its say.
export interface ResolvedFormioConfig extends FormioConfig {
  baseUrl: string;
  projectUrl: string;
}

// One behavior for every agent: no environment variable switches the defaults,
// because a server that reads its own launch mode cannot be packaged for hosts
// that have no way to set it.
export function getConfig(): FormioConfig {
  const apiKey = process.env.FORMIO_API_KEY;
  const loginFormUrl = process.env.FORMIO_LOGIN_FORM;
  // Validated for the same reason the suggested project is: both plugin
  // manifests set this from a host variable, and an unsubstituted
  // "${FORMIO_BASE_URL}" is truthy. Taken raw it keys the token cache and builds
  // the portal-login URL, surfacing much later as an opaque "Failed to parse
  // URL" out of fetch.
  //
  // Left undefined when the environment supplies nothing usable, rather than
  // defaulted here. resolveProjectConfig applies DEFAULT_BASE_URL last, so a
  // deployment mapped for the directory still outranks silence from the
  // environment — which a pre-filled default made indistinguishable from an
  // explicit FORMIO_BASE_URL=https://api.form.io.
  const baseUrl = readHttpUrlEnv({ raw: process.env.FORMIO_BASE_URL, name: 'FORMIO_BASE_URL' });
  // Deliberately optional. Clients and directory crawlers launch the server with
  // no configuration to read tools/list, so failing at startup made it look like
  // a server with no tools. resolveProjectConfig raises the error instead, at
  // the point the project URL is actually needed and with guidance the caller
  // can act on.
  //
  // Anything unusable — empty because the user cleared an optional prompt, or a
  // literal the client never substituted — is dropped rather than kept, because
  // this field PINS the server: kept, it would resolve to nothing on every call
  // and no project_set mapping could redirect it.
  const projectUrl = readHttpUrlEnv({
    raw: process.env.FORMIO_PROJECT_URL,
    name: 'FORMIO_PROJECT_URL',
  });

  return {
    baseUrl,
    projectUrl,
    defaultProjectUrl: readHttpUrlEnv({
      raw: process.env.FORMIO_DEFAULT_PROJECT_URL,
      name: 'FORMIO_DEFAULT_PROJECT_URL',
    }),
    apiKey: apiKey || undefined,
    loginFormUrl: loginFormUrl || undefined,
    jwt: undefined,
    authHost: process.env.FORMIO_AUTH_HOST || undefined,
    authPort: parsePositiveInt(process.env.FORMIO_AUTH_PORT),
    authTimeoutMs: toMilliseconds(parsePositiveInt(process.env.FORMIO_AUTH_TIMEOUT)),
    forceBrowser: process.env.FORMIO_FORCE_BROWSER === '1',
  };
}

// Every URL this server reads from its environment arrives through a host that
// substitutes a variable into a manifest, so a value can be absent, empty, or a
// literal "${...}" the client never expanded. None of those is a URL. A bad one
// is dropped with a note on stderr rather than carried into a token-cache key, a
// login URL, or a suggestion the agent offers the user and then persists.
//
// Exported because it is the only sanctioned way to read one of these variables:
// every entry point that reads the environment directly — project_set, the bin's
// project command — has to drop an unusable value the same way, or the same
// literal that getConfig shrugs off fails their handler outright.
//
// onIgnored exists because not every caller may write to the process streams: the
// bin's project command returns its whole outcome in a result object, and a note
// written straight to process.stderr escapes that contract and is invisible to
// its tests. The server itself has nowhere else to put it, so stderr stays the
// default.
export interface ReadHttpUrlEnvOptions {
  raw: string | undefined;
  name: string;
  onIgnored?: (message: string) => void;
}

export function readHttpUrlEnv({
  raw,
  name,
  onIgnored = (message) => process.stderr.write(`${message}\n`),
}: ReadHttpUrlEnvOptions): string | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return normalizeHttpUrl(raw, name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onIgnored(`Ignoring ${name}: ${message}`);
    return undefined;
  }
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function toMilliseconds(seconds: number | undefined): number | undefined {
  return seconds === undefined ? undefined : seconds * 1000;
}
