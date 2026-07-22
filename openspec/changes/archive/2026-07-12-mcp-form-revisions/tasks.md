## 1. Revisions module (license + tracking gates, flows)
<!-- depends_on: none -->

### Red

- [x] 1.1 Test: `checkRevisionsLicensed` returns true when `/config.js` contains `sac = true`, false when `sac = false`, false on fetch failure; result cached per `baseUrl`.
- [x] 1.2 Test: license-gate `confirmProceedWithoutRevisions` throws USER CANCELLED on cancel; persists positive consent to `~/.formio/revisions-license-consent.json` with mode 0600; second call for the same `baseUrl` does not re-prompt.
- [x] 1.3 Test: `gateRevisionsLicense` throws when `requiresRevisions: true` and unlicensed; strips `revisions` from `form` when unlicensed and `requiresRevisions: false`; passes through unchanged when licensed.
- [x] 1.4 Test: per-form `gateRevisionsTracking` — no prompt when caller opted in (`revisions: 'original'|'current'`); no prompt when `licensed` is false; prompts when stored `revisions` is falsy; prompts even when caller passes `revisions: ''`; applies caller's choice (`original`/`current`/strip on proceed-without-history); throws on cancel; remembers proceed-without-history for that `formId`.
- [x] 1.5 Test: `saveDraft` rejects bodies with non-allowlisted fields; merges allowlisted fields over existing draft and stamps `_vnote` with `@formio/mcp:` prefix.
- [x] 1.6 Test: `publishDraft` throws when `_vid !== 'draft'`; PUTs live form overlaid with draft's allowlist; ignores caller `form`.
- [x] 1.7 Test: `revertToRevision` PUTs live form overlaid with revision's revert allowlist; ignores caller `form`.

### Green

- [x] 1.8 Implement `src/revisions/` (license.ts, tracking.ts, flows.ts, helpers.ts, browser-prompts.ts, index.ts) to pass 1.1–1.7.

### Refactor

- [x] 1.9 Review implementation and refactor as needed

## 2. form_revisions_list + form_revision_get tools
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Test: `form_revisions_list` issues `GET /form/{id}/v` for a Mongo id and `GET /{alias}/v` for a path alias; returns the response as MCP text content.
- [x] 2.2 Test: `form_revision_get` issues `GET /form/{id}/v/{version}` and returns the body as MCP text content.

### Green

- [x] 2.3 Implement `form_revisions_list.ts` and `form_revision_get.ts`; register both in `tools/index.ts`.

### Refactor

- [x] 2.4 Review implementation and refactor as needed

## 3. form_update — draft / publish / revert + gates
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Test: `draft`, `publish`, `revert` are mutually exclusive — passing two or more throws.
- [x] 3.2 Test: `revert: true` without `version` throws.
- [x] 3.3 Test: standard PUT runs the per-form tracking gate and applies its returned body, stamping `_vnote` with `@formio/mcp:` prefix so the server records the revision on a revisions-enabled form.
- [x] 3.4 Test: `draft`/`publish`/`revert` delegate to the corresponding flow function with `_vnote` set from `note`.
- [x] 3.5 Test: license gate throws for `draft`/`publish`/`revert` on unlicensed deployments and never PUTs.

### Green

- [x] 3.6 Update `form_update.ts` to wire the gates and flow functions; add `draft`, `publish`, `revert`, `version`, `note` to the schema.

### Refactor

- [x] 3.7 Review implementation and refactor as needed

## 4. form_get draft, form_create license/default
<!-- depends_on: 1 -->

### Red

- [x] 4.1 Test: `form_get` with `draft: true` fetches `/{base}/draft` and returns the body when `_vid === 'draft'`; throws "no draft exists" otherwise.
- [x] 4.2 Test: `form_create` on a licensed deployment defaults the POST body to `revisions: 'original'`; caller `revisions` overrides; strips `revisions` and runs license consent on unlicensed deployments; stamps `_vnote` when `note` is provided.

### Green

- [x] 4.3 Update `form_get.ts` and `form_create.ts` to match 4.1 and 4.2.

### Refactor

- [x] 4.4 Review implementation and refactor as needed
