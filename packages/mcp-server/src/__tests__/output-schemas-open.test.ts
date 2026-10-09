/**
 * Every published output schema is open at every level.
 *
 * A client that validates structuredContent against the published schema rejects
 * any property a closed object does not list, and Form.io documents carry fields no
 * schema here enumerates (`_vid`, `pdfComponents`, `controller`, `esign`, …). A
 * closed object anywhere in a tool's schema turns a successful call into a
 * validation failure the day such a field appears.
 */

import { describe, expect, it } from 'vitest';
import { registerAllTools } from '../tools/index.js';
import { connectTools } from './test-helpers.js';

interface ClosedObject {
  tool: string;
  path: string;
}

function closedObjects(node: unknown, tool: string, path: string): ClosedObject[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => closedObjects(item, tool, `${path}[${index}]`));
  }
  if (typeof node !== 'object' || node === null) {
    return [];
  }
  const record = node as Record<string, unknown>;
  const here = record.additionalProperties === false ? [{ tool, path }] : [];
  return [
    ...here,
    ...Object.entries(record).flatMap(([key, value]) =>
      closedObjects(value, tool, `${path}.${key}`)
    ),
  ];
}

describe('published output schemas', () => {
  it('leave additional properties open at every level of every tool', async () => {
    const client = await connectTools((server) => registerAllTools(server, {}));
    const { tools } = await client.listTools();

    const withSchemas = tools.filter((tool) => tool.outputSchema !== undefined);
    expect(withSchemas.length).toBe(tools.length);

    const closed = withSchemas.flatMap((tool) =>
      closedObjects(tool.outputSchema, tool.name, 'outputSchema')
    );
    expect(closed).toEqual([]);
  });
});
