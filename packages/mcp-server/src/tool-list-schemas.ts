import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

// The SDK's JSON Schema conversion names the dialect (`$schema`) at the top of every
// input and output schema it emits for tools/list. A caller acts on none of them,
// and across this server's surface they cost about 2,500 characters of the tool-list
// budget every client reads on connect.

type Schema = ListToolsResult['tools'][number]['inputSchema'];
type ListHandler = (request: unknown, extra: unknown) => Promise<ListToolsResult>;

const LIST_TOOLS = 'tools/list';

function withoutDialect<T extends Schema>(schema: T): T {
  return Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$schema')) as T;
}

/** The tools/list result with the `$schema` key removed from every tool's schemas. */
export function withoutSchemaDialect(result: ListToolsResult): ListToolsResult {
  return {
    ...result,
    tools: result.tools.map((tool) => ({
      ...tool,
      inputSchema: withoutDialect(tool.inputSchema),
      ...(tool.outputSchema ? { outputSchema: withoutDialect(tool.outputSchema) } : {}),
    })),
  };
}

/**
 * Wraps the tools/list handler McpServer installed when the first tool was
 * registered, so every list it answers carries no `$schema` keys. The SDK exposes no
 * option for the conversion it runs, so the wrapper reads its private handler table.
 * The SDK is a caret dependency, so a newer release may move that table: when it is
 * not a Map holding a tools/list handler, the wrapper does nothing and the list is
 * answered as the SDK emits it. Trimming the list never stops the server; the budget
 * test fails if stripping stops working under the installed SDK.
 */
export function stripSchemaDialect(server: McpServer): void {
  const handlers: unknown = (server.server as unknown as Record<string, unknown>)?.[
    '_requestHandlers'
  ];
  if (!(handlers instanceof Map)) {
    return;
  }
  const original = handlers.get(LIST_TOOLS) as ListHandler | undefined;
  if (typeof original !== 'function') {
    return;
  }
  handlers.set(LIST_TOOLS, async (request: unknown, extra: unknown) =>
    withoutSchemaDialect(await original(request, extra))
  );
}
