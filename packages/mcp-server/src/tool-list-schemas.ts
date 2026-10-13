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
 * option for the conversion it runs, so the wrapper reads its handler table — the
 * budget test fails if an SDK update moves it.
 */
export function stripSchemaDialect(server: McpServer): void {
  const handlers = server.server['_requestHandlers'] as unknown as Map<string, ListHandler>;
  const original = handlers.get(LIST_TOOLS);
  if (!original) {
    throw new Error('stripSchemaDialect must run after at least one tool is registered');
  }
  handlers.set(LIST_TOOLS, async (request, extra) =>
    withoutSchemaDialect(await original(request, extra))
  );
}
