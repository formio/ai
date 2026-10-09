import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formioFetch } from '../formio-client.js';
import { FormioApiError } from '../tool-errors.js';
import { TEST_CONFIG as config } from './test-helpers.js';

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

// Form.io index routes report the whole collection's size in Content-Range, as
// `{from}-{to}/{total}`, or `*/{total}` when the page is empty. A skip at or past
// the total is answered with 416 and `*/{total}`.
function indexResponse(status: number, items: unknown[], contentRange?: string): Response {
  return new Response(JSON.stringify(items), {
    status,
    headers: contentRange ? { 'Content-Range': contentRange } : {},
  });
}

describe('formioFetch with withMeta', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the items and the total read from a range Content-Range', async () => {
    const items = [{ _id: 'a' }, { _id: 'b' }];
    mockFetch.mockResolvedValue(indexResponse(206, items, '0-9/42'));

    const page = await formioFetch('role', {}, config, { withMeta: true });

    expect(page).toEqual({ data: items, total: 42 });
  });

  it('reads the total from an empty Content-Range', async () => {
    mockFetch.mockResolvedValue(indexResponse(200, [], '*/0'));

    const page = await formioFetch('role', {}, config, { withMeta: true });

    expect(page).toEqual({ data: [], total: 0 });
  });

  it('answers a 416 past the end as an empty page carrying the total', async () => {
    mockFetch.mockResolvedValue(indexResponse(416, [], '*/3'));

    const page = await formioFetch('role', { skip: '500' }, config, { withMeta: true });

    expect(page).toEqual({ data: [], total: 3 });
  });

  it('still raises a 416 that carries no total', async () => {
    mockFetch.mockResolvedValue(indexResponse(416, []));

    await expect(formioFetch('role', {}, config, { withMeta: true })).rejects.toBeInstanceOf(
      FormioApiError
    );
  });

  it('still raises any other error status', async () => {
    mockFetch.mockResolvedValue(indexResponse(404, [], '*/3'));

    await expect(formioFetch('role', {}, config, { withMeta: true })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('leaves the total undefined when the response reports none', async () => {
    const items = [{ _id: 'a' }];
    mockFetch.mockResolvedValue(indexResponse(200, items));

    const page = await formioFetch('role', {}, config, { withMeta: true });

    expect(page).toEqual({ data: items, total: undefined });
  });

  it('leaves the total undefined when Form.io reports it as unknown', async () => {
    mockFetch.mockResolvedValue(indexResponse(200, [], '0-9/*'));

    const page = await formioFetch('role', {}, config, { withMeta: true });

    expect(page).toEqual({ data: [], total: undefined });
  });

  it('returns the body alone without withMeta', async () => {
    const items = [{ _id: 'a' }];
    mockFetch.mockResolvedValue(indexResponse(200, items, '0-0/1'));

    expect(await formioFetch('role', {}, config)).toEqual(items);
  });
});
