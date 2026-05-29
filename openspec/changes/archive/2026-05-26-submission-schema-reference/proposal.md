## Why

The `formio-schema` skill already partitions its `references/` tree by domain and ships a placeholder `references/submission/README.md` that punts to `formio-api`'s `runtime-submissions` endpoint reference. That placeholder is good enough for someone who wants to call the submission endpoint, but it does nothing for someone who wants to *interpret* or *construct* a Form.io submission JSON document — what `data` looks like for each component type, what `state` values are valid, what `metadata` carries, when `roles`/`owner` are populated, what `access` overrides at the row level, what `_fvid` ties to. Today Claude has no first-party answer when a user asks "what's in this submission JSON?" beyond a hand-wave back to the API endpoint.

The Form.io platform's own TypeScript source of truth for the submission shape lives at `~/Documents/formio/modules/nirvana/packages/core/src/types/Submission.ts`. Pairing that file against the user-facing user guide at `https://help.form.io/userguide/submissions` is enough to author a real reference now — no further research needed.

## What Changes

- Promote the submission domain from "not yet authored" placeholder to a fully authored reference set. Replace `plugin/skills/formio-schema/references/submission/README.md` with one or more proper reference files structured to mirror the form domain (one file per logical sub-topic, no YAML frontmatter, property tables for each documented type).
- Author the following submission reference files under `plugin/skills/formio-schema/references/submission/`:
  - `submission-definition.md` — top-level `Submission` envelope: `_id`, `_fvid`, `form`, `project`, `owner`, `roles`, `state`, `access`, `metadata`, `data`, `externalIds`, `externalTokens`, `permission`, `created`, `modified`, `deleted`.
  - `submission-metadata.md` — `SubmissionMetadata` shape, including documented properties (`timezone`, `offset`, `origin`, `referrer`, `browserName`, `userAgent`, `pathName`, `onLine`, `language`, `headers`, `ssoteam`, `memberCount`, `selectData`) and the open-ended `[key: string]: any` extension contract.
  - `submission-state.md` — `SubmissionState` lifecycle: `"draft"` (unsaved, server-persisted while user is editing) vs `"submitted"` (completed). Note the discrepancy that the TypeScript source declares only `"submitted"` but the user guide and production data also recognize `"draft"`; document both as valid string values a consumer may encounter.
  - `submission-access.md` — row-level `access` array of `{ type, roles, resources? }` entries, listing all `AccessType` values (`self`, `create_own`, `create_all`, `read_own`, `read_all`, `update_own`, `update_all`, `delete_own`, `delete_all`, `team_read`, `team_write`, `team_admin`, `team_access`). Document how this layers on top of the form's `submissionAccess` (form-level) — row-level overrides per-submission.
  - `submission-data.md` — the `data` object: how component `key`s map to data paths, how container / datagrid / editgrid / datamap / form components nest, how addresses store either autocomplete or manual mode, how `select` resource references store an embedded submission vs. an ID, how `file` components store array-of-upload-record shapes, and the relationship to `form.components` for interpreting any given `data` blob.
- Update `plugin/skills/formio-schema/SKILL.md`:
  - Promote the submission row in the "Submissions and Projects" table from a single "not yet authored" placeholder to a domain heading with its own multi-row reference table (mirroring the existing form-domain layout).
  - Update the trigger clause so submission-specific prompts (interpreting a submission, understanding `state`/`metadata`/`data` shape, decoding row-level access) clearly activate the skill.
- Update existing tests in `packages/mcp-server/src/__tests__/formio-schema-layout.test.ts`:
  - The `references/` directory layout test still asserts the subdirectories exactly `form/`, `submission/`, `project/`.
  - The submission placeholder test is replaced by an authored-reference test asserting each new `submission/*.md` file exists, is non-empty, and contains the headings expected by the spec.
  - Project placeholder remains as-is.

## Capabilities

### Modified Capabilities

- `formio-schema-skill`: Adds requirements that the submission domain has authored reference files (not a placeholder), enumerates the required submission reference files, and constrains the router SKILL.md to enumerate every submission reference (not a single placeholder row).

## Impact

- **Skill content**: `plugin/skills/formio-schema/references/submission/` gains five authored reference files. `README.md` is removed (or kept only as a brief index pointing at the five files — the spec will pick one; the design doc records the decision).
- **Skill router**: `plugin/skills/formio-schema/SKILL.md` gains a submission-domain reference table and updated trigger clause.
- **Tests**: `packages/mcp-server/src/__tests__/formio-schema-layout.test.ts` updated — submission placeholder assertion replaced by submission authored-reference assertions; project placeholder assertion unchanged.
- **No code changes**: No MCP tool, server, or build script changes are needed for this proposal.
- **External research**: The TypeScript type at `~/Documents/formio/modules/nirvana/packages/core/src/types/Submission.ts` (and its imports: `Access`, `DataObject`, `FormId`, `RoleId`, `ProjectId`) and the user guide at `https://help.form.io/userguide/submissions` are the only inputs needed.
