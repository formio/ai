import { describe, it, expect } from 'vitest';
import { ERROR_META_KEY, toMcpError } from '../mcp-responses.js';
import { formioFetch } from '../formio-client.js';
import {
  FormioApiError,
  FormioNetworkError,
  ToolError,
  TOOL_ERROR_CODES,
  ToolErrorCode,
} from '../tool-errors.js';
import { ProjectNotConfiguredError, requireBaseUrl, resolveProject } from '../project-resolver.js';
import { ProjectMapUnreadableError } from '../project-map.js';
import { CommittedConfigUnusableError } from '../committed-config.js';
import { TEST_CONFIG, TEST_PROJECT_URL } from './test-helpers.js';

const URL_UNDER_TEST = `${TEST_PROJECT_URL}/form`;

function raised(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
}

function apiError(status: number, body?: string, location?: string): FormioApiError {
  return new FormioApiError({ status, url: URL_UNDER_TEST, body, location });
}

function structured(error: unknown) {
  return toMcpError(error)._meta[ERROR_META_KEY];
}

function text(result: ReturnType<typeof toMcpError>): string {
  return result.content.map((part) => part.text).join('\n');
}

describe('toMcpError returns a structured code beside the message', () => {
  it('leads the unchanged prose message with the code', () => {
    const result = toMcpError(new Error('something specific'));
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('[INTERNAL] something specific');
  });

  it('puts the code ahead of the notes, and the notes ahead of the message', () => {
    const result = toMcpError(new ProjectNotConfiguredError('the failure'), [
      'a note that explains it',
    ]);
    expect(text(result)).toBe('[NOT_CONFIGURED] a note that explains it\nthe failure');
  });

  // MCP clients validate structuredContent against the tool's success outputSchema
  // even on an error result, so the error payload travels in _meta instead.
  it('carries no structuredContent', () => {
    expect(toMcpError(new Error('x'))).not.toHaveProperty('structuredContent');
  });

  it('maps an error of no known class to INTERNAL with no status or body', () => {
    expect(structured(new Error('boom'))).toEqual({ code: 'INTERNAL' });
    expect(structured('a thrown string')).toEqual({ code: 'INTERNAL' });
  });

  it('passes a ToolError code through', () => {
    const codes: ToolErrorCode[] = ['INVALID_ARGUMENT', 'LICENSE_REQUIRED', 'NO_DRAFT'];
    for (const code of codes) {
      expect(structured(new ToolError({ code, message: 'x' }))).toEqual({ code });
    }
  });

  it('publishes the fixed code set', () => {
    expect([...TOOL_ERROR_CODES].sort()).toEqual(
      [
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
      ].sort()
    );
  });
});

describe('toMcpError maps the resolution errors', () => {
  it('maps ProjectNotConfiguredError to NOT_CONFIGURED', () => {
    expect(structured(new ProjectNotConfiguredError('nothing here'))).toEqual({
      code: 'NOT_CONFIGURED',
    });
  });

  it('maps an unresolved Base URL to BASE_URL_UNRESOLVED', () => {
    const error = raised(() =>
      requireBaseUrl({ projectUrl: 'https://myproject.mysite.com', cwd: '/workspace/x' })
    );
    expect(structured(error)).toEqual({ code: 'BASE_URL_UNRESOLVED' });
  });

  it('maps ProjectMapUnreadableError to CONFIG_UNREADABLE', () => {
    const error = new ProjectMapUnreadableError('/home/.formio/projects.json', new Error('bad'));
    expect(structured(error)).toEqual({ code: 'CONFIG_UNREADABLE' });
  });

  it('maps CommittedConfigUnusableError to CONFIG_UNREADABLE', () => {
    const error = new CommittedConfigUnusableError('/repo/formio.json', 'not JSON');
    expect(structured(error)).toEqual({ code: 'CONFIG_UNREADABLE' });
  });

  it('maps a relative cwd to INVALID_ARGUMENT', () => {
    const error = raised(() => resolveProject('relative/dir', {}));
    expect(structured(error)).toEqual({ code: 'INVALID_ARGUMENT' });
  });

  it('maps a request path outside the project to INVALID_ARGUMENT', async () => {
    const error = await formioFetch('../elsewhere/form', {}, TEST_CONFIG).catch(
      (failure: unknown) => failure
    );
    expect(structured(error)).toEqual({ code: 'INVALID_ARGUMENT' });
  });
});

describe('toMcpError maps Form.io responses', () => {
  it.each<[number, string | undefined, ToolErrorCode]>([
    [401, 'Unauthorized', 'AUTH_REQUIRED'],
    [403, 'Forbidden', 'FORBIDDEN'],
    [404, 'Not Found', 'NOT_FOUND'],
    [400, 'Invalid alias', 'NOT_FOUND'],
    [400, '{"message":"Form validation failed"}', 'VALIDATION_FAILED'],
    [422, '{"message":"Unprocessable"}', 'VALIDATION_FAILED'],
    [301, undefined, 'REDIRECTED'],
    [302, undefined, 'REDIRECTED'],
    [500, 'Internal Server Error', 'UPSTREAM_ERROR'],
    [503, 'Service Unavailable', 'UPSTREAM_ERROR'],
  ])('maps %i (%s) to %s', (status, body, code) => {
    expect(structured(apiError(status, body))).toEqual({
      code,
      status,
      ...(body === undefined ? {} : { body }),
    });
  });

  it('omits an empty body', () => {
    expect(structured(apiError(404, ''))).toEqual({ code: 'NOT_FOUND', status: 404 });
  });

  it('maps a request with no response to NETWORK_ERROR, naming the cause and URL', () => {
    const cause = new TypeError('fetch failed', {
      cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    });
    const result = toMcpError(new FormioNetworkError({ url: URL_UNDER_TEST, cause }));
    expect(result._meta[ERROR_META_KEY]).toEqual({ code: 'NETWORK_ERROR' });
    expect(text(result).startsWith('[NETWORK_ERROR] ')).toBe(true);
    expect(text(result)).toContain('ECONNREFUSED');
    expect(text(result)).toContain(URL_UNDER_TEST);
  });
});
