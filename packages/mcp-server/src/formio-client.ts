import type { Dispatcher } from 'undici';
import { FormioConfig, ResolvedFormioConfig } from './config.js';
import { getAuthHeader } from './auth-header.js';
import { ensureAuthenticated, invalidateJwtCache } from './ensure-auth.js';
import { clearToken } from './token-cache.js';
import { requireBaseUrl } from './project-resolver.js';
import { checkCurrentUser } from './token-validation.js';
import {
  FormioApiError,
  FormioNetworkError,
  FormioPermissionError,
  ToolError,
} from './tool-errors.js';

export const MONGO_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isMongoId(value: string): boolean {
  return MONGO_ID_PATTERN.test(value);
}

/** How long a Form.io request may go unanswered, unless FORMIO_REQUEST_TIMEOUT says otherwise. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

/**
 * The least `project_import` and `project_export` wait: a large template legitimately
 * takes minutes, so FORMIO_REQUEST_TIMEOUT does not shorten these.
 */
const TEMPLATE_TRANSFER_TIMEOUT_MS = 300_000;

/**
 * How long a template transfer waits: TEMPLATE_TRANSFER_TIMEOUT_MS, or the configured
 * request timeout when that is longer — so FORMIO_REQUEST_TIMEOUT can lengthen a
 * transfer but never shorten one.
 */
export function templateTransferTimeoutMs(config: FormioConfig): number {
  return Math.max(
    TEMPLATE_TRANSFER_TIMEOUT_MS,
    config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  );
}

export interface FormioFetchOptions {
  method?: string;
  body?: unknown;
  responseType?: 'text' | 'json';
  signal?: AbortSignal;
  /** This request's timeout, in place of the configured or default one. */
  timeoutMs?: number;
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

interface ReadResponseRequest {
  response: Response;
  url: URL;
  options?: FormioFetchOptions;
}

async function readResponse({ response, url, options }: ReadResponseRequest): Promise<unknown> {
  if (options?.withMeta) {
    return readPage(response, url);
  }
  if (!response.ok) {
    throw await apiError(response, url);
  }
  return options?.responseType === 'text' ? response.text() : response.json();
}

interface ReadInTimeRequest extends ReadResponseRequest {
  timeoutMs: number;
}

// Whether a body read was cut off by the request's own timeout: the abort rejects the
// read with the timeout's TimeoutError. A caller's signal can carry a TimeoutError of
// its own, and that abort keeps it.
function isTimeoutAbort(error: unknown, signal: AbortSignal | undefined): boolean {
  const callerAborted = signal?.aborted === true && signal.reason === error;
  return error instanceof DOMException && error.name === 'TimeoutError' && !callerAborted;
}

// The timeout keeps running once the headers arrive, so it can cut off the body read
// as well; that is reported exactly like a request that received no response.
async function readInTime(request: ReadInTimeRequest): Promise<unknown> {
  try {
    return await readResponse(request);
  } catch (error) {
    if (isTimeoutAbort(error, request.options?.signal)) {
      throw new FormioNetworkError({
        url: request.url.toString(),
        cause: error,
        timeoutMs: request.timeoutMs,
      });
    }
    throw error;
  }
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

/**
 * The resolved deployment a request belongs to, and whether FORMIO_INSECURE_TLS asks
 * for its certificate to go unverified. A FormioConfig is one.
 */
export interface CertificateScope {
  insecureTls?: boolean;
  projectUrl?: string;
  baseUrl?: string;
}

export interface SendInit extends RequestInit {
  /** Aborts the request after this many milliseconds; DEFAULT_REQUEST_TIMEOUT_MS when absent. */
  timeoutMs?: number;
  /** Whose certificate setting applies; without one, the certificate is verified. */
  certificateScope?: CertificateScope;
}

function hostOf(raw: string | undefined): string | undefined {
  return raw && URL.canParse(raw) ? new URL(raw).host : undefined;
}

// Created on first use, so a server that never relaxes a certificate check never
// loads undici, and every relaxed request shares one connection pool.
let relaxedDispatcher: Promise<Dispatcher> | undefined;

function getRelaxedDispatcher(): Promise<Dispatcher> {
  relaxedDispatcher ??= import('undici').then(
    ({ Agent }) => new Agent({ connect: { rejectUnauthorized: false } })
  );
  return relaxedDispatcher;
}

/**
 * The dispatcher a request is sent with: one that accepts a self-signed certificate
 * when FORMIO_INSECURE_TLS is on and the request's host is the project URL's or the
 * Base URL's host; otherwise none, and fetch verifies the certificate as usual.
 */
export async function selectDispatcher(
  url: URL,
  scope: CertificateScope | undefined
): Promise<Dispatcher | undefined> {
  if (!scope?.insecureTls) {
    return undefined;
  }
  const hosts = [hostOf(scope.projectUrl), hostOf(scope.baseUrl)];
  return hosts.includes(url.host) ? getRelaxedDispatcher() : undefined;
}

/**
 * `fetch`, with a request that received no response raised as a FormioNetworkError
 * naming the cause and the URL — the one wrapper every Form.io request goes through,
 * and so the one place every request is given a timeout. A caller's own `signal`
 * still aborts it, and that abort keeps its own reason rather than reading as a
 * timeout.
 */
export async function send(
  url: URL,
  { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, certificateScope, ...init }: SendInit
): Promise<Response> {
  const dispatcher = await selectDispatcher(url, certificateScope);
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    return await fetch(url, { ...init, signal, ...(dispatcher ? { dispatcher } : {}) });
  } catch (cause) {
    const timedOut = timeout.aborted && signal.reason === timeout.reason;
    throw new FormioNetworkError({
      url: url.toString(),
      cause,
      ...(timedOut ? { timeoutMs } : {}),
    });
  }
}

function requestTimeoutMs(config: FormioConfig, options?: FormioFetchOptions): number {
  return options?.timeoutMs ?? config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
}

function buildFetchInit(config: FormioConfig, options?: FormioFetchOptions): SendInit {
  const hasBody = options?.body !== undefined;
  const headers: Record<string, string> = {
    ...getAuthHeader(config),
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  };

  const init: SendInit = {
    headers,
    redirect: 'manual',
    timeoutMs: requestTimeoutMs(config, options),
    certificateScope: config,
  };
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
  const timeoutMs = requestTimeoutMs(config, options);
  const response = await send(url, buildFetchInit(config, options));

  if (response.status === 401 && config.jwt) {
    // A jwt in hand means the auth path already ran, which means it already
    // demanded a base URL — so this is a re-read of a resolved value, not a
    // new requirement. Funnelled through the same guard rather than asserted,
    // so an unreachable state raises the actionable error instead of keying
    // the cache under "undefined".
    const baseUrl = requireBaseUrl(config);
    // Form.io also answers 401 to a signed-in account it refuses, so the token is
    // checked before it is discarded: one /current still accepts is kept, and the
    // refusal is reported rather than answered with a login that cannot change it.
    const current = await checkCurrentUser({ ...config, baseUrl });
    if (current.accepted) {
      throw new FormioPermissionError({
        url: url.toString(),
        account: current.account,
        body: await readBody(response),
        baseUrl,
      });
    }
    invalidateJwtCache(baseUrl);
    await clearToken(baseUrl);
    config.jwt = undefined;
    await ensureAuthenticated(config);
    return readInTime({
      response: await send(url, buildFetchInit(config, options)),
      url,
      options,
      timeoutMs,
    });
  }

  return readInTime({ response, url, options, timeoutMs });
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
