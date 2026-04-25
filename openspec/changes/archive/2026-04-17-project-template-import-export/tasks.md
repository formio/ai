## 1. formioFetch text response support
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: formioFetch returns parsed text when `responseType: 'text'` is passed in options

### Green

- [x] 1.2 Add `responseType?: 'text' | 'json'` to `FormioFetchOptions` and return `response.text()` when set to `'text'`; default to `'json'` for backward compatibility

### Refactor

- [x] 1.3 Review implementation and refactor as needed

## 2. project_export tool
<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing test: project_export tool is registered and appears in tool listing
- [x] 2.2 Write failing test: project_export calls GET /export and returns the template JSON
- [x] 2.3 Write failing test: project_export returns error response on API failure

### Green

- [x] 2.4 Implement `registerProjectExportTool` in `packages/mcp-server/src/tools/project_export.ts` and register it in `tools/index.ts`

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. project_import tool
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing test: project_import tool is registered with skill-referencing description
- [x] 3.2 Write failing test: project_import accepts a template object, wraps it in `{ "template": ... }`, and calls POST /import
- [x] 3.3 Write failing test: project_import returns "Ok" on successful import
- [x] 3.4 Write failing test: project_import returns error response on 400 (malformed template) or other API failure

### Green

- [x] 3.5 Implement `registerProjectImportTool` in `packages/mcp-server/src/tools/project_import.ts` and register it in `tools/index.ts`

### Refactor

- [x] 3.6 Review implementation and refactor as needed
