const LIST_TOOLS = 'tools/list';
function withoutDialect(schema) {
    return Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$schema'));
}
/** The tools/list result with the `$schema` key removed from every tool's schemas. */
export function withoutSchemaDialect(result) {
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
export function stripSchemaDialect(server) {
    const handlers = server.server?.['_requestHandlers'];
    if (!(handlers instanceof Map)) {
        return;
    }
    const original = handlers.get(LIST_TOOLS);
    if (typeof original !== 'function') {
        return;
    }
    handlers.set(LIST_TOOLS, async (request, extra) => withoutSchemaDialect(await original(request, extra)));
}
