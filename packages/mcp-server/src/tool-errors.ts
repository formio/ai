/**
 * The error contract every tool shares: a fixed set of codes a caller can branch on,
 * carried beside the prose message a model reads.
 *
 * Adding a code is a minor change; renaming or removing one is breaking.
 */
export const TOOL_ERROR_CODES = [
  'NOT_CONFIGURED',
  'BASE_URL_UNRESOLVED',
  'CONFIG_UNREADABLE',
  'INVALID_ARGUMENT',
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'LICENSE_REQUIRED',
  'HISTORY_NOT_ACCEPTED',
  'NO_DRAFT',
  'UNKNOWN_ACTION_TYPE',
  'REDIRECTED',
  'UPSTREAM_ERROR',
  'NETWORK_ERROR',
  'INTERNAL',
] as const;

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

/** How much of Form.io's response body an error carries. */
export const FORMIO_BODY_LIMIT = 2000;

export interface ToolErrorOptions {
  code: ToolErrorCode;
  message: string;
  cause?: unknown;
}

/** An error whose code is known where it is raised. */
export class ToolError extends Error {
  readonly code: ToolErrorCode;

  constructor({ code, message, cause }: ToolErrorOptions) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ToolError';
    this.code = code;
  }
}

/** The code a Form.io error response maps to. */
export function codeForResponse({
  status,
  body,
}: {
  status: number;
  body?: string;
}): ToolErrorCode {
  if (status >= 300 && status < 400) {
    return 'REDIRECTED';
  }
  if (status === 401) {
    return 'AUTH_REQUIRED';
  }
  if (status === 403) {
    return 'FORBIDDEN';
  }
  // Form.io answers an unknown form path alias with 400 "Invalid alias": the form
  // was not found, whatever the status says.
  if (status === 404 || (status === 400 && /invalid alias/i.test(body ?? ''))) {
    return 'NOT_FOUND';
  }
  if (status === 400 || status === 422) {
    return 'VALIDATION_FAILED';
  }
  return 'UPSTREAM_ERROR';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// Field-level messages: resourcejs reports a validation failure as an `errors` map
// keyed by field, and the submission validator as a `details` array.
function fieldMessages(record: Record<string, unknown>): string[] {
  const { errors, details } = record;
  const entries = [
    ...(isRecord(errors) ? Object.values(errors) : []),
    ...(Array.isArray(details) ? details : []),
  ];
  return entries.flatMap((entry) => {
    const message = isRecord(entry) ? stringField(entry, 'message') : undefined;
    return message ? [message] : [];
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const SHORT_TEXT_LIMIT = 200;

/**
 * Form.io's own explanation of a failed request, for the prose message: the JSON
 * `message` (or `name`) plus any field-level messages it does not already contain,
 * or a short plain-text body such as "Invalid alias". Undefined when the body
 * explains nothing a reader could use, such as an HTML error page.
 */
export function formioErrorText(body: string | undefined): string | undefined {
  const text = body?.trim();
  if (!text) {
    return undefined;
  }
  const parsed = parseJson(text);
  if (isRecord(parsed)) {
    const lead = stringField(parsed, 'message') ?? stringField(parsed, 'name');
    const extra = fieldMessages(parsed).filter((message) => !lead?.includes(message));
    const parts = [...(lead ? [lead] : []), ...new Set(extra)];
    return parts.length ? parts.join(' ') : undefined;
  }
  if (parsed !== undefined || text.startsWith('<') || text.length > SHORT_TEXT_LIMIT) {
    return undefined;
  }
  return text;
}

export interface FormioApiErrorOptions {
  status: number;
  url: string;
  /** The response body as text; truncated to FORMIO_BODY_LIMIT here. */
  body?: string;
  /** Where a 3xx pointed. */
  location?: string;
}

/** Form.io answered, and the answer was not a success. */
export class FormioApiError extends ToolError {
  readonly status: number;
  readonly url: string;
  readonly body?: string;

  constructor({ status, url, body, location }: FormioApiErrorOptions) {
    const kept = body ? body.slice(0, FORMIO_BODY_LIMIT) : undefined;
    const explanation = formioErrorText(body);
    const redirect = location
      ? ` | Redirected to ${location}, which is not followed: every request addresses the resolved project directly.`
      : '';
    super({
      code: codeForResponse({ status, body }),
      message: `Form.io API error: ${status} | URL: ${url}${redirect}${explanation ? ` | ${explanation}` : ''}`,
    });
    this.name = 'FormioApiError';
    this.status = status;
    this.url = url;
    this.body = kept;
  }
}

function errorCode(value: unknown): string | undefined {
  if (!isRecord(value) && !(value instanceof Error)) {
    return undefined;
  }
  const code = (value as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

// The system error behind a request that got no response. fetch reports every such
// failure as "fetch failed" and keeps the reason on `cause` — and a host that
// resolves to several addresses nests one error per address in an AggregateError.
function describeCause(error: unknown): string {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;
  const nested = cause instanceof AggregateError ? cause.errors : [];
  const code = errorCode(cause) ?? nested.map(errorCode).find(Boolean);
  const detail =
    (cause instanceof Error && cause.message) ||
    nested.map((inner) => (inner instanceof Error ? inner.message : '')).find(Boolean) ||
    (error instanceof Error ? error.message : String(error));
  return code && !detail.includes(code) ? `${code}: ${detail}` : detail;
}

/** The request to Form.io received no response. */
export class FormioNetworkError extends ToolError {
  readonly url: string;

  constructor({ url, cause }: { url: string; cause: unknown }) {
    super({
      code: 'NETWORK_ERROR',
      message: `Form.io request failed with no response (${describeCause(cause)}) | URL: ${url}`,
      cause,
    });
    this.name = 'FormioNetworkError';
    this.url = url;
  }
}

// A type alias rather than an interface, so it is assignable to the
// `Record<string, unknown>` an MCP result's `_meta` values are checked against.
export type ToolErrorDetails = {
  code: ToolErrorCode;
  status?: number;
  body?: string;
};

/** The structured half of a tool error: its code, and Form.io's status and body when it answered. */
export function toolErrorDetails(error: unknown): ToolErrorDetails {
  if (error instanceof FormioApiError) {
    return {
      code: error.code,
      status: error.status,
      ...(error.body ? { body: error.body } : {}),
    };
  }
  if (error instanceof ToolError) {
    return { code: error.code };
  }
  return { code: 'INTERNAL' };
}
