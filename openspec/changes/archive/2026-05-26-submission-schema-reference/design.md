## Context

The `formio-schema` skill ships a domain-partitioned `references/` tree as of the `merge-form-schema-skills` change (archived at `openspec/changes/archive/2026-05-26-merge-form-schema-skills/`). Today three domain subdirectories exist:

- `references/form/` — five fully authored references (form-definition, base-component, input-components, layout-components, data-components).
- `references/submission/` — single placeholder `README.md` that routes to `formio-api`'s `runtime-submissions` reference.
- `references/project/` — single placeholder `README.md` that routes to `formio-api`'s `platform-projects` reference.

The form domain is the model for what an "authored" domain looks like: small, focused files with property tables, examples, and cross-links — no YAML frontmatter on the reference files themselves; only the router `SKILL.md` carries frontmatter.

The user wants the submission domain promoted to that same authoring level, using the in-monorepo TypeScript source as the type spine and the public user guide for human-language descriptions. The source is at `~/Documents/formio/modules/nirvana/packages/core/src/types/Submission.ts` (outside this repo but on the user's machine), and the user guide is at `https://help.form.io/userguide/submissions`.

Reading both during exploration produced these inputs:

- The TypeScript `Submission` interface declares: `_id`, `_fvid`, `form`, `owner`, `roles`, `metadata`, `data`, `project`, `state`, `access`, `externalIds`, `externalTokens`, `permission`, `created`, `modified`, `deleted`.
- The TS `SubmissionState` only declares `'submitted'`. The user guide explicitly documents both `"draft"` and `"submitted"` as valid state values produced and consumed by the platform. Production data has both. The reference will treat both as the canonical set and call out that the TS type is currently narrower than the runtime contract.
- The TS `SubmissionMetadata` declares twelve documented keys plus an open-ended index signature `[key: string]: any` — the reference will list every documented key and explicitly call the metadata bag extensible.
- The TS `Access` type imported from `'types'` is `{ type: AccessType, roles: RoleId[], resources?: string[] }` with thirteen `AccessType` literal values. The reference will list all thirteen, and note the difference between form-level `access` / `submissionAccess` (the form definition's access controls) and row-level `access` (this same shape, applied per-submission). The row-level version overrides per submission.
- The TS `DataObject` is `{ [key: string]: unknown }` plus an `AddressComponentDataObject` discriminated union for the `address` component (`autocomplete` vs `manual` mode). The reference will document the data envelope and use the address shape as the worked example of how component types influence the stored value.
- The user guide identifies advanced features (submission revisions via `_fvid`; per-form custom MongoDB collections) — the reference will mention these but not re-document the API endpoints, which live in `formio-api`'s `runtime-submissions` and `project-forms` references.

## Goals / Non-Goals

**Goals:**

- Five focused reference files under `references/submission/`, each readable on its own, none larger than ~250 lines. The form-domain references are the size and style template.
- Every property declared in the TypeScript source has a row in a property table with: name, type, required/optional, one-sentence description grounded in either the type definition or the user guide. Where the user guide adds nuance (e.g., draft state, `data` interpretation), that nuance is captured.
- The submission `data` object reference cross-links to the form-domain references for component-by-component data shapes (e.g., "for what each component type stores in `data[key]`, see `references/form/input-components.md` and `references/form/data-components.md`"). It does not duplicate per-component value shapes — that work already lives in the form references.
- The router `SKILL.md` lists every submission reference with a one-line "Working on…" cue so Claude can pick the right file without loading everything.
- Tests assert the file layout, file non-emptiness, and presence of the key headings each reference must carry. They do NOT diff exact property tables — that brittle assertion would create test churn whenever the platform adds a documented field.

**Non-Goals:**

- Documenting the submission REST endpoints (verb, path, query params, status codes). That belongs to `formio-api`'s `runtime-submissions` reference and stays there.
- Documenting per-component value shapes (e.g., how `datagrid` rows store an array of nested objects in `data`). That already lives in `references/form/data-components.md`; the submission reference cross-links rather than duplicates.
- Generating the references from the TypeScript source at build time. The references are hand-authored Markdown — same authoring contract as every other file under `plugin/skills/formio-schema/references/`. Codegen would be a separate proposal.
- Fixing the TypeScript source. The discrepancy where `SubmissionState` declares only `'submitted'` but runtime includes `'draft'` is documented in the reference and noted here, but resolving it would require a PR against `nirvana`, which is out of scope for this proposal.
- Authoring the project domain. That stays as a placeholder for now; only the submission domain is being promoted.

## Decisions

### Decision: Replace `submission/README.md` with five focused files; do not keep README as an index

The form domain has no top-level `README.md` — its index lives entirely in the router `SKILL.md`. The submission domain follows the same pattern. The placeholder `README.md` is deleted (not kept as a redirect), because:

1. The router `SKILL.md`'s submission table becomes the authoritative index, exactly as it is for the form domain.
2. Keeping a `README.md` would create two places to discover submission references — a drift hazard the form domain deliberately avoids.
3. The `formio-schema-skill` spec's "Placeholder domains route to formio-api" scenario is dropped for `submission` (kept for `project`) — that scenario was for *unauthored* domains, which submission no longer is.

**Alternative considered:** Keep `submission/README.md` as a one-screen TOC. Rejected — duplicates the router and rots on every file rename.

### Decision: Five reference files, one per logical concern

| File                         | Covers                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| `submission-definition.md`   | The top-level `Submission` envelope and every property on it           |
| `submission-state.md`        | `state` lifecycle: `draft` vs `submitted`, when each is set            |
| `submission-metadata.md`     | The `metadata` bag — documented keys plus extension contract           |
| `submission-access.md`       | Row-level `access` array, all `AccessType` values, layering with form  |
| `submission-data.md`         | The `data` envelope, key paths, nesting, cross-links to form refs      |

**Why five not three or one:** The form domain has five files because each one is small enough to load on its own. Bundling `state` + `metadata` into `submission-definition.md` would push that file past the 200-line line. Splitting `data` out is non-negotiable because it's the largest concept and the only one that cross-references the form domain.

**Why not one per `SubmissionState` value or one per `AccessType`:** Over-partitioning. A page per state value would be three lines each.

### Decision: Document `"draft"` as a valid `state` value despite the TypeScript narrowing it to `"submitted"`

The user guide explicitly identifies `"draft"` as the value for unsaved submissions, and the platform writes that value to the database. The reference is for consumers reading and writing submission JSON — it must match what the runtime actually produces, not what one TypeScript declaration happens to narrow it to. The reference will state both values, then add a one-line note: "Note: the upstream TypeScript type currently declares only `'submitted'`; treat that as a known narrowing bug, not an authoritative restriction."

**Alternative considered:** Match the TypeScript exactly. Rejected — would teach users that `state: "draft"` is invalid when they have it in their database.

### Decision: Cross-link `submission-data.md` to the form domain rather than duplicate component value shapes

The form references already document, per component type, what gets stored in submission data (e.g., `signature` stores a base64 PNG data URL; `file` stores `[{ storage, name, url, size, type, originalName, hash }]`; `datagrid` stores an array of row objects). Reproducing that in `submission-data.md` would mean two places must update when, say, a new component type ships. Instead `submission-data.md` documents the envelope (key paths, nesting model, address discriminated union as the worked example) and cross-links to the form references for per-component value shapes.

### Decision: Tests assert structural presence, not exact property lists

The layout test today asserts file existence + non-emptiness + a couple of substring expectations (e.g., "not yet authored"). For the authored submission references, the test will assert:

- Each of the five `submission/*.md` files exists.
- Each is non-empty.
- Each carries the canonical top-level `# <Title>` heading expected for it (e.g., `submission-definition.md` starts with `# Submission Definition Reference`).
- `submission-definition.md` mentions every declared TS property name (`_id`, `_fvid`, `form`, `owner`, `roles`, `metadata`, `data`, `project`, `state`, `access`, `externalIds`, `externalTokens`, `permission`, `created`, `modified`, `deleted`) somewhere in its body. This is a regression net for the case where a property table row is accidentally deleted, without coupling to the exact format of the table.
- `submission-state.md` mentions both `draft` and `submitted`.
- `submission-access.md` mentions every `AccessType` value.
- `submission-metadata.md` mentions every documented `SubmissionMetadata` key.
- The router SKILL.md body links to all five new reference paths.

This is the same depth of structural test as the existing form-domain assertions in the layout file.

### Decision: Keep the project placeholder unchanged

The proposal explicitly scopes to the submission domain. The `references/project/README.md` placeholder stays. The existing layout test's "Placeholder domains route to formio-api" assertion narrows from "submission and project" to "project only" — submission is no longer a placeholder.

### Decision: No frontmatter on submission reference files

Same rule as the form domain. Only `SKILL.md` carries YAML frontmatter; reference files are pure Markdown. The layout test will gain a per-file assertion that none of the five new files starts with `---`.

## Risks / Trade-offs

- **Risk:** The TypeScript source at `~/Documents/formio/modules/nirvana/packages/core/src/types/Submission.ts` evolves and the reference drifts. → **Mitigation:** Author the references in the user-guide voice (what a developer experiences), not as a 1:1 type mirror. The structural test catches deletions but not additions; additions are caught by the standard skill-iteration practice (re-read the type when revisiting the skill). Codegen is explicitly out of scope.
- **Risk:** Documenting `"draft"` as a state value diverges from the upstream TypeScript and could be reverted by someone "fixing" the docs to match the type. → **Mitigation:** The reference contains an explicit one-line callout that the TS narrowing is a known gap, not authoritative. A reviewer who tries to delete `draft` will hit that callout.
- **Risk:** The cross-links from `submission-data.md` to `references/form/*` files break if the form references are renamed. → **Mitigation:** Cross-links use relative paths within the same skill. A rename of any form reference file would already break the router SKILL.md table and be caught by the existing layout test that asserts every `references/form/*.md` path in the router body.
- **Trade-off:** Five files is more navigation than one. We accept that — load-only-what-you-need is the form domain's pattern and the schema skill is designed to be selectively loaded.
- **Trade-off:** We are not authoring the project domain in this change. The proposal scope is intentionally narrow so review is small. Authoring `project/` is a follow-up.

## Migration Plan

1. Implement the five reference files, the router SKILL.md update, and the test updates on a feature branch.
2. Delete `plugin/skills/formio-schema/references/submission/README.md`.
3. Run `pnpm test`, `pnpm lint`, `pnpm format` — Definition of Done.
4. Merge. Next plugin build picks up the new references; no runtime migration required.
5. Rollback: revert the merge commit; the placeholder `README.md` returns and the router table reverts to the single-row placeholder.
