import { FormioConfig, readBooleanEnv, ResolvedFormioConfig } from './config.js';
import { getAuthHeader } from './auth-header.js';
import { ensureAuthenticated, invalidateJwtCache } from './ensure-auth.js';
import { clearToken } from './token-cache.js';
import { requireBaseUrl } from './project-resolver.js';
import { FormioApiError, FormioNetworkError, ToolError } from './tool-errors.js';

// For a self-signed deployment, such as a local Form.io Enterprise server.
if (readBooleanEnv(process.env.FORMIO_INSECURE_TLS)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export const MONGO_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isMongoId(value: string): boolean {
  return MONGO_ID_PATTERN.test(value);
}

export interface FormioFetchOptions {
  method?: string;
  body?: unknown;
  responseType?: 'text' | 'json';
  signal?: AbortSignal;
  /** Return `{ data, total }`, reading the total from an index route's Content-Range. */
  withMeta?: boolean;
}

/** One page of an index route: the body, and the collection size Form.io reported. */
export interface FormioPage {
  data: unknown;
  /** Absent when the response reports no total. */
  total?: number;
}

// Form.io's index routes report the collection size as `{from}-{to}/{total}`, or
// `*/{total}` for an empty page; a total of `*` means it is not known.
function contentRangeTotal(header: string | null | undefined): number | undefined {
  const match = header?.trim().match(/^(?:items\s+)?(?:\d+-\d+|\*)\/(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

// A `skip` at or past the total is answered 416 with `*/{total}`: that is an empty
// page past the end, not a failure. Any other error status stays an error.
async function readPage(response: Response, url: URL): Promise<FormioPage> {
  const total = contentRangeTotal(response.headers?.get('content-range'));
  if (response.status === 416 && total !== undefined) {
    return { data: [], total };
  }
  if (!response.ok) {
    throw await apiError(response, url);
  }
  return { data: await response.json(), total };
}

async function readResponse(
  response: Response,
  url: URL,
  options?: FormioFetchOptions
): Promise<unknown> {
  if (options?.withMeta) {
    return readPage(response, url);
  }
  if (!response.ok) {
    throw await apiError(response, url);
  }
  return options?.responseType === 'text' ? response.text() : response.json();
}

// A redirect is reported rather than followed: fetch would re-send the request, with
// its x-jwt-token or x-token header, to wherever the Location header points.
async function apiError(response: Response, url: URL): Promise<FormioApiError> {
  const location =
    response.status >= 300 && response.status < 400 ? response.headers?.get('location') : null;
  return new FormioApiError({
    status: response.status,
    url: url.toString(),
    body: await readBody(response),
    location: location ?? undefined,
  });
}

// The body explains the failure, but reading it can fail too (a dropped connection,
// a stream already consumed); the status alone is still worth reporting then.
async function readBody(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

async function send(url: URL, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (cause) {
    throw new FormioNetworkError({ url: url.toString(), cause });
  }
}

function buildFetchInit(config: FormioConfig, options?: FormioFetchOptions): RequestInit {
  const hasBody = options?.body !== undefined;
  const headers: Record<string, string> = {
    ...getAuthHeader(config),
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  };

  const init: RequestInit = { headers, redirect: 'manual' };
  if (options?.method) {
    init.method = options.method;
  }
  if (hasBody) {
    init.body = JSON.stringify(options.body);
  }
  if (options?.signal) {
    init.signal = options.signal;
  }
  return init;
}

export async function formioRawFetch(
  url: URL,
  config: ResolvedFormioConfig,
  options?: FormioFetchOptions
): Promise<unknown> {
  const response = await send(url, buildFetchInit(config, options));

  if (response.status === 401 && config.jwt) {
    // A jwt in hand means the auth path already ran, which means it already
    // demanded a base URL — so this is a re-read of a resolved value, not a
    // new requirement. Funnelled through the same guard rather than asserted,
    // so an unreachable state raises the actionable error instead of keying
    // the cache under "undefined".
    const baseUrl = requireBaseUrl(config);
    invalidateJwtCache(baseUrl);
    await clearToken(baseUrl);
    config.jwt = undefined;
    await ensureAuthenticated(config);
    return readResponse(await send(url, buildFetchInit(config, options)), url, options);
  }

  return readResponse(response, url, options);
}

// Whether a built URL addresses the project: the same origin, and a path that IS
// the project's path or continues it at a segment boundary — so a sibling project
// sharing a prefix (`/myproject2` beside `/myproject`) is not under it.
function isUnderProject(url: URL, projectUrl: URL): boolean {
  const prefix = projectUrl.pathname.replace(/\/+$/, '');
  return (
    url.origin === projectUrl.origin &&
    (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))
  );
}

export function formioFetch(
  path: string,
  params: Record<string, string | undefined>,
  config: ResolvedFormioConfig,
  options: FormioFetchOptions & { withMeta: true }
): Promise<FormioPage>;
export function formioFetch(
  path: string,
  params: Record<string, string | undefined>,
  config: ResolvedFormioConfig,
  options?: FormioFetchOptions
): Promise<unknown>;
export async function formioFetch(
  path: string,
  params: Record<string, string | undefined>,
  config: ResolvedFormioConfig,
  options?: FormioFetchOptions
): Promise<unknown> {
  const base = config.projectUrl.replace(/\/*$/, '/');
  const url = new URL(path.replace(/^\//, ''), base);

  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  );
  for (const [key, value] of entries) {
    url.searchParams.set(key, value);
  }

  // Checked before the auth gate, so a request that would leave the project never
  // reaches a credential. The tool-argument rule refuses these values first and names
  // the argument; this holds for every caller, including ones that bypass it.
  if (!isUnderProject(url, new URL(base))) {
    throw new ToolError({
      code: 'INVALID_ARGUMENT',
      message: `Refusing the Form.io request for path ${JSON.stringify(path)}: it resolves to ${url.origin}${url.pathname}, which is not under the Project URL ${config.projectUrl}. Every request addresses the project this directory resolves to.`,
    });
  }

  await ensureAuthenticated(config);

  return formioRawFetch(url, config, options);
}
