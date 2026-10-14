## 1. Action conditions

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing tests: a portal-shaped condition (`conjunction: ''`, `custom`), a `custom` with `all`, a legacy `field`/`eq` condition, `condition: null`, and `settings: null` are accepted by `action_create` and `action_update` and posted unchanged; an unknown row operator is still refused

### Green

- [x] 1.2 Loosen the condition schema in `action-schema.ts` per design Decision 1

### Refactor

- [x] 1.3 Review implementation and refactor as needed

## 2. Strict top-level arguments

<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing tests: every tool's serialized input schema has `additionalProperties: false` at the top level; `form_update` with `projectUrl` is refused naming it and makes no request; `form_update` with an unlisted field inside `form` is accepted and sent

### Green

- [x] 2.2 Wrap every registration's `inputSchema` in `z.strictObject`; fix tests that pass undeclared arguments; confirm the budget test

### Refactor

- [x] 2.3 Review implementation and refactor as needed

## 3. project_import annotation and live case

<!-- depends_on: 1, 2 -->

### Red

- [x] 3.1 Write failing test: `project_import`'s annotations have `idempotentHint: false`
- [x] 3.2 Add a live case: `action_create` with a portal-shaped condition holding `custom`, `action_get`, `action_update` with the read action unchanged, `action_get` again — `custom` preserved

### Green

- [x] 3.3 Set the annotation; run the full suite and the live suite on `https://form.test/sandbox`

### Refactor

- [x] 3.4 Review implementation and refactor as needed

## 4. Release

<!-- depends_on: 1, 2, 3 -->

### Red

- [x] 4.1 Confirm `pnpm check:releases` with the changeset

### Green

- [x] 4.2 Add `.changeset/tighten-1-0-tool-surface.md` (`'@formio/mcp': patch`); run `pnpm test`, `pnpm lint`, `pnpm format`, `openspec validate tighten-1-0-tool-surface --strict`

### Refactor

- [x] 4.3 Review implementation and refactor as needed
