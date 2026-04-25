## Why

Developers building Form.io applications need a way to discover and browse forms in their project directly from their AI-assisted development environment. Currently, they must switch context to the Form.io portal or manually construct API calls. An MCP tool that lists forms eliminates this friction and lays the foundation for deeper Form.io integration.

## What Changes

- Add fail-fast configuration module that reads `FORMIO_PROJECT_URL` and `FORMIO_API_KEY` from environment variables and validates them at server startup
- Add shared Form.io HTTP client with base URL resolution and `x-token` authentication
- Add `form_list` tool that retrieves a summary list of forms (no components) from the Form.io API with full query parameter support (type, limit, skip, sort, select, tags)
- Update `.mcp.json` to include `env` block for Form.io configuration

## Capabilities

### New Capabilities

- `server-config`: Fail-fast environment variable configuration and validation for Form.io project URL and API key
- `formio-client`: Shared HTTP client for authenticated requests to the Form.io API
- `form-list`: MCP tool that lists forms from a Form.io project with filtering, pagination, and field selection

### Modified Capabilities

<!-- None — this is the first feature beyond the hello tool -->

## Impact

- `src/config.ts` — new module for env var validation
- `src/formio-client.ts` — new shared HTTP client
- `src/tools/form_list.ts` — new tool registration
- `src/tools/index.ts` — modified to register form_list
- `src/server.ts` — modified to validate config at startup
- `.mcp.json` — modified to add env vars
- No new runtime dependencies (uses native `fetch`)
