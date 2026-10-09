import { z } from 'zod';
import { ResolvedFormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';

/**
 * The list contract every paged list tool shares.
 *
 * Form.io's index routes default to 10 items and impose no maximum, so `limit` and
 * `skip` are sent on every request: left to Form.io's default, a project with 11
 * roles came back with 10 and nothing said so. The total comes from the response's
 * Content-Range header, so `hasMore` says whether another page exists.
 */
export const DEFAULT_LIST_LIMIT = 100;

export interface ListArgumentDefaults {
  /** The `sort` sent when the caller gives none. */
  sort?: string;
  /** The `select` sent when the caller gives none. */
  select?: string;
}

/** The paging arguments, described with the defaults this tool applies. */
export function listArguments(defaults: ListArgumentDefaults = {}) {
  return {
    limit: z.number().int().positive().default(DEFAULT_LIST_LIMIT).describe('Page size'),
    skip: z.number().int().nonnegative().default(0).describe('Items to skip; page while `hasMore`'),
    sort: z
      .string()
      .optional()
      .describe(
        `Form.io sort, e.g. "-modified" for newest first${defaults.sort ? ` (default: ${defaults.sort})` : ''}`
      ),
    select: z
      .string()
      .optional()
      .describe(
        `Comma-separated fields to return${defaults.select ? ` (default: ${defaults.select})` : ''}`
      ),
  };
}

export interface ListQuery {
  limit: number;
  skip: number;
  sort?: string;
  select?: string;
}

export interface ListPage<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface PageOfRequest<T> {
  items: T[];
  /** The total Form.io reported; absent when it reported none. */
  total: number | undefined;
  skip: number;
  /** The page size requested. */
  limit: number;
}

/**
 * A page and where it sits. Without a reported total, the items seen so far are all
 * that is known to exist, and a full page may have more behind it — so `hasMore`
 * then says whether the page came back full.
 */
export function pageOf<T>({ items, total, skip, limit }: PageOfRequest<T>): ListPage<T> {
  const seen = skip + items.length;
  if (total === undefined) {
    return { items, total: seen, hasMore: items.length === limit };
  }
  return { items, total, hasMore: seen < total };
}

/** A page as a tool result: the items under the tool's own key, beside `total` and `hasMore`. */
export function listResult<T>(key: string, page: ListPage<T>): Record<string, unknown> {
  return { [key]: page.items, total: page.total, hasMore: page.hasMore };
}

export interface FetchListPageRequest {
  path: string;
  query: ListQuery;
  config: ResolvedFormioConfig;
  defaults?: ListArgumentDefaults;
  /** Tool-specific query filters, sent beside the paging parameters. */
  filters?: Record<string, string | undefined>;
}

export async function fetchListPage({
  path,
  query,
  config,
  defaults = {},
  filters = {},
}: FetchListPageRequest): Promise<ListPage<Record<string, unknown>>> {
  const params = {
    ...filters,
    limit: String(query.limit),
    skip: String(query.skip),
    sort: query.sort ?? defaults.sort,
    select: query.select ?? defaults.select,
  };
  const { data, total } = await formioFetch(path, params, config, { withMeta: true });
  const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  return pageOf({ items, total, skip: query.skip, limit: query.limit });
}
