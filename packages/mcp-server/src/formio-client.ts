import { FormioConfig, ResolvedFormioConfig } from './config.js';
import { getAuthHeader } from './auth-header.js';
import { ensureAuthenticated, invalidateJwtCache } from './ensure-auth.js';
import { clearToken } from './token-cache.js';

// Accept the common truthy spellings ("true", "TRUE", "1") so a self-signed
// deployment (e.g. a local Form.io Enterprise server) is not rejected over a
// trivial casing/format mismatch in the env value.
export function isInsecureTlsEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

if (isInsecureTlsEnabled(process.env.FORMIO_INSECURE_TLS)) {
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

function formatApiError(status: number, url: URL): string {
  return `Form.io API error: ${status} | URL: ${url.toString()}`;
}

function buildFetchInit(config: FormioConfig, options?: FormioFetchOptions): RequestInit {
  const hasBody = options?.body !== undefined;
  const headers: Record<string, string> = {
    ...getAuthHeader(config),
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  };

  const init: RequestInit = { headers };
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
  const response = await fetch(url, buildFetchInit(config, options));
  const parseResponse = (res: Response) =>
    options?.responseType === 'text' ? res.text() : res.json();

  if (!response.ok) {
    if (response.status === 401 && config.jwt) {
      invalidateJwtCache(config.baseUrl);
      await clearToken(config.baseUrl);
      config.jwt = undefined;
      await ensureAuthenticated(config);
      const retryResponse = await fetch(url, buildFetchInit(config, options));
      if (!retryResponse.ok) {
        throw new Error(formatApiError(retryResponse.status, url));
      }
      return parseResponse(retryResponse);
    }
    throw new Error(formatApiError(response.status, url));
  }

  return parseResponse(response);
}

export async function formioFetch(
  path: string,
  params: Record<string, string | undefined>,
  config: ResolvedFormioConfig,
  options?: FormioFetchOptions
): Promise<unknown> {
  await ensureAuthenticated(config);

  const base = config.projectUrl.replace(/\/*$/, '/');
  const url = new URL(path.replace(/^\//, ''), base);

  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  );
  for (const [key, value] of entries) {
    url.searchParams.set(key, value);
  }

  return formioRawFetch(url, config, options);
}
