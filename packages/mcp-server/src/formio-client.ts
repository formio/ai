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
  const parseResponse = (res: Response) =>
    options?.responseType === 'text' ? res.text() : res.json();

  if (!response.ok) {
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
      const retryResponse = await send(url, buildFetchInit(config, options));
      if (!retryResponse.ok) {
        throw await apiError(retryResponse, url);
      }
      return parseResponse(retryResponse);
    }
    throw await apiError(response, url);
  }

  return parseResponse(response);
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
