// The Form.io API answers `DELETE /form/:formId/action/:actionId` with the plain
// text body `OK`, not JSON. `formioRawFetch` calls `res.json()` unless the caller
// opts into `responseType: 'text'`, so the delete threw before it could report
// success:
//
//   Error: Unexpected token 'O', "OK" is not valid JSON
//
// This drives the REAL formioFetch. `action_delete.test.ts` mocks that module out,
// which is exactly why the defect shipped: the seam it stubs is the seam that parses
// the response, so every assertion there passed against a value no deployment sends.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestClient } from './test-helpers.js';

vi.mock('../ensure-auth.js', () => ({
  ensureAuthenticated: vi.fn(),
  resetAuthState: vi.fn(),
  invalidateJwtCache: vi.fn(),
}));

vi.mock('../token-cache.js', () => ({
  readToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
}));

const { registerActionDeleteTool } = await import('../tools/action_delete.js');

const FORM_ID = 'a'.repeat(24);
const ACTION_ID = 'b'.repeat(24);

describe('action_delete reads the body the deployment actually returns', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds when the response body is the plain text OK', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK'),
      // What the platform does with `OK`, so a regression fails here rather than
      // passing against a JSON body the API never sends.
      json: () => Promise.reject(new SyntaxError(`Unexpected token 'O', "OK" is not valid JSON`)),
    });

    const { client } = await createTestClient(registerActionDeleteTool);
    const result = await client.callTool({
      name: 'action_delete',
      arguments: { formId: FORM_ID, actionId: ACTION_ID },
    });

    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ ok: true });
  });

  it('reports the API status, not a parse error, when the deployment refuses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
      json: () => Promise.reject(new SyntaxError('json() must not be called')),
    });

    const { client } = await createTestClient(registerActionDeleteTool);
    const result = await client.callTool({
      name: 'action_delete',
      arguments: { formId: FORM_ID, actionId: ACTION_ID },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('404') }),
    ]);
  });

  it('issues a DELETE to the action path', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK'),
      json: () => Promise.reject(new SyntaxError('json() must not be called')),
    });

    const { client } = await createTestClient(registerActionDeleteTool);
    await client.callTool({
      name: 'action_delete',
      arguments: { formId: FORM_ID, actionId: ACTION_ID },
    });

    const [url, init] = mockFetch.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(url.pathname).toContain(`/form/${FORM_ID}/action/${ACTION_ID}`);
  });
});
