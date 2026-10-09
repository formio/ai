/**
 * The list contract every list tool shares: `limit` / `skip` / `sort` / `select`
 * in, the items plus `total` and `hasMore` out, and no `count`.
 */

import { describe, expect, it } from 'vitest';
import { registerAllTools } from '../tools/index.js';
import { listResult, pageOf } from '../tools/list-contract.js';
import { connectTools } from './test-helpers.js';

const PAGED = {
  form_list: 'forms',
  role_list: 'roles',
  action_list: 'actions',
  form_revision_list: 'revisions',
} as const;

interface JsonSchemaObject {
  properties?: Record<string, { default?: unknown; type?: string }>;
  required?: string[];
}

async function listedTools() {
  const client = await connectTools((server) => registerAllTools(server, {}));
  const { tools } = await client.listTools();
  return new Map(tools.map((tool) => [tool.name, tool]));
}

describe('the list contract', () => {
  it.each(Object.keys(PAGED))(
    '%s takes limit (default 100), skip (default 0), sort and select',
    async (name) => {
      const tool = (await listedTools()).get(name);
      const input = tool?.inputSchema as JsonSchemaObject;
      expect(input.properties?.limit?.default).toBe(100);
      expect(input.properties?.skip?.default).toBe(0);
      expect(input.properties).toHaveProperty('sort');
      expect(input.properties).toHaveProperty('select');
    }
  );

  it.each([...Object.entries(PAGED), ['action_type_list', 'actionTypes']])(
    '%s returns %s with total and hasMore, and no count',
    async (name, key) => {
      const tool = (await listedTools()).get(name);
      const output = tool?.outputSchema as JsonSchemaObject;
      expect(output.required).toEqual(expect.arrayContaining([key, 'hasMore']));
      expect(output.properties).toHaveProperty('total');
      expect(output.properties).not.toHaveProperty('count');
    }
  );

  // Form.io does not always report a Content-Range total. A count of the items seen
  // would read as the size of the collection, so the field is left out instead.
  it.each([...Object.keys(PAGED), 'action_type_list'])(
    '%s declares total optional, saying it is absent when Form.io reports none',
    async (name) => {
      const tool = (await listedTools()).get(name);
      const output = tool?.outputSchema as JsonSchemaObject & {
        properties?: Record<string, { description?: string }>;
      };
      expect(output.required ?? []).not.toContain('total');
      expect(output.properties?.total?.description).toMatch(/absent when Form\.io/i);
    }
  );

  describe('pageOf', () => {
    it('has more while skip plus the page is short of the total', () => {
      expect(pageOf({ items: [1, 2], total: 5, skip: 0, limit: 2 })).toEqual({
        items: [1, 2],
        total: 5,
        hasMore: true,
      });
      expect(pageOf({ items: [4, 5], total: 5, skip: 3, limit: 2 })).toMatchObject({
        hasMore: false,
      });
    });

    it('has no more past the end', () => {
      expect(pageOf({ items: [], total: 3, skip: 500, limit: 100 })).toEqual({
        items: [],
        total: 3,
        hasMore: false,
      });
    });

    it('leaves total out when Form.io reports none', () => {
      const page = pageOf({ items: [1, 2], total: undefined, skip: 10, limit: 5 });
      expect(page).toEqual({ items: [1, 2], hasMore: false });
      expect(page).not.toHaveProperty('total');
    });

    // A full page with no reported total says nothing about what follows it, so the
    // caller is told to ask for the next one rather than that the list has ended.
    it('has more when Form.io reports no total and the page is full', () => {
      expect(pageOf({ items: [1, 2], total: undefined, skip: 10, limit: 2 })).toEqual({
        items: [1, 2],
        hasMore: true,
      });
    });
  });

  describe('listResult', () => {
    it('carries total when the page has one', () => {
      expect(listResult('roles', { items: [1], total: 1, hasMore: false })).toEqual({
        roles: [1],
        total: 1,
        hasMore: false,
      });
    });

    it('leaves total out when the page has none', () => {
      const result = listResult('roles', { items: [1], hasMore: true });
      expect(result).toEqual({ roles: [1], hasMore: true });
      expect(result).not.toHaveProperty('total');
    });
  });
});
