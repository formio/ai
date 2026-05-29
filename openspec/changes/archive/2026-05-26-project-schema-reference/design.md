## Context

The `formio-schema` skill's domain partitioning is now established: `form/` is fully authored (five files), `submission/` is fully authored (five files, as of the `submission-schema-reference` change archived at `openspec/changes/archive/2026-05-26-submission-schema-reference/`), and `project/` is the last remaining placeholder — currently a single `README.md` redirecting to `formio-api`'s `platform-projects` endpoint reference.

The Form.io project envelope is the largest of the three top-level Form.io documents and the only one with multiple discriminators (`type`, `plan`, `framework`), encrypted-at-rest sub-objects (`settings`), nested authentication configuration (`oauth`, `ldap`, `saml`), integration sub-objects (email, captcha, esign, google drive, kickbox, SQL connector, file storage), parent/child relationships (stages and tenants reference a primary project), and read-only server-managed fields (`apiCalls`, `billing`, `lastDeploy`, `trial`). It cannot be documented in a single file without bloating past the size of the existing form/submission references.

Two authoritative sources cover the envelope:

- `~/Documents/formio/modules/nirvana/packages/core/src/types/project/Project.ts` — the canonical TypeScript declaration of `Project` plus every supporting type.
- `~/Documents/formio/modules/nirvana/apps/formio-server/src/models/Project.js` — the Mongoose schema used by the API server, carrying authoritative `description` strings, length and regex constraints, default values, the `'archived'` plan extension, the `externalOwner` sub-document for OIDC, and the encryption-at-rest contract for `settings`.

The two sources diverge in a few small but important ways. The TS file declares `_id` as required and `deleted` as `Date | string`; the server stores `deleted` as a `Number`. The TS enum `ProjectPlan` does not include `'archived'`; the server enum does. The server adds an `externalOwner` field with `sub`/`iss`/`customIdClaim` shape that is not in the TS declaration. The reference will document the server's contract (it's the runtime truth) and call out divergences where they matter.

`ProjectSettings` and its `authorization/` and `integrations/` sub-types live in `~/Documents/formio/modules/nirvana/packages/core/src/types/project/settings/`. The reference will document `ProjectSettings` keys at one level of indirection — listing each integration / authorization block with a one-line role and pointer to the relevant `formio-api` reference for endpoint-specific behavior — rather than re-documenting every nested provider option (e.g., the OAuth client-secret rotation flow). The schema skill's job is "what's in the JSON," not "how does the integration work end-to-end."

## Goals / Non-Goals

**Goals:**

- Four focused project-domain references under `references/project/`, each readable on its own, each under ~250 lines. Same pattern as the submission domain (which itself mirrors the form domain). Billing and usage statistics are intentionally out of scope as authored content — they are operator/SaaS concerns, not schema-authoring concerns. The relevant fields appear as one-line rows in `project-definition.md`'s property table and nothing more.
- Every property declared on `Project` in the TS file has a row in a property table with type / required / description / constraint columns. Where the server model adds constraint detail (length limits, regex, validator messages, default values), the reference uses that detail. Where the server adds fields not in the TS file (notably `externalOwner`), the reference adds them with a footnote that the upstream TS declaration is currently narrower.
- The `settings` reference enumerates every documented `ProjectSettings` key but treats each integration / authorization block as a one-line entry pointing at where to look next (the relevant `formio-api` endpoint reference or the upstream type definition). It explicitly documents that `settings` is encrypted at rest via the server's `EncryptedProperty` plugin and that downstream consumers see decrypted JSON only when the server returns the project to an authorized caller.
- The router `SKILL.md` lists every project reference with a one-line "Working on…" cue.
- Tests assert structural presence (file existence + non-empty + no frontmatter + body mentions every enumerated value), not exact property-table formatting.

**Non-Goals:**

- Authoring a billing-and-usage reference. The `billing`, `apiCalls`, `trial`, and `lastDeploy` fields are server-managed read-only stats consumed by the Form.io plan dashboard, not values an integrator would hand-author or hand-interpret. They get one-line rows in `project-definition.md`'s property table; there is no separate file and no `ProjectUsage` counter deep-dive.
- Documenting the `plan` discriminator in depth. The primary use case for these agentic skills is self-hosted / on-prem Form.io deployments, where `plan` is always `'commercial'`. The SaaS plan tiers (`basic`, `independent`, `team`, `trial`) and the server-only `'archived'` value are out of scope. `plan` appears as a one-line row in `project-definition.md`'s property table stating "for deployed projects this is always `'commercial'`" and nothing more.
- Documenting the project REST endpoints (verb, path, query params, status codes). That belongs to `formio-api`'s `platform-projects` reference and stays there.
- Documenting the full integration provider config matrix (every OAuth provider's exact field set, every file-storage provider's bucket-config block). The reference points at the upstream sub-types; deep-diving each provider would belong in the relevant integration's own documentation page.
- Documenting the project-template envelope (`Template.ts`). That's a separate artifact — used by `project_import` / `project_export` — and is large enough to deserve its own promotion from this domain in a follow-up change. The reference will mention the template envelope's existence and route to `formio-api`'s `platform-projects` for endpoint details.
- Fixing the TS / server-model divergences upstream. The reference documents both contracts and notes the gaps; resolving them would require PRs against `nirvana` and is out of scope.
- Generating the references from the TS source at build time. Hand-authored Markdown stays the authoring contract.

## Decisions

### Decision: Four reference files, one per logical concern

| File                            | Covers                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `project-definition.md`         | Top-level `Project` envelope and every declared property                              |
| `project-type-and-framework.md` | `type` / `framework` discriminators and the stage / tenant parent-child relationship  |
| `project-settings.md`           | `ProjectSettings` shape, every documented key, encryption-at-rest contract            |
| `project-access.md`             | Project-level `access` array, `ProjectRole`, `ProjectFormAccess`, `ProjectAccessInfo` |

**Why four not three or one:** Project is the largest envelope. Bundling `settings` into `project-definition.md` would push the definition file past 400 lines just from the settings tables. Splitting `type`/`framework` into their own file lets consumers who only want to know "what does `'tenant'` mean" load a one-screen reference.

**Why no billing/usage file:** The `billing`, `apiCalls`, `trial`, and `lastDeploy` fields are server-managed read-only stats — operator/SaaS concerns, not schema-authoring concerns. They appear as one-line rows in `project-definition.md` (so the envelope is documented in full) but the skill does NOT teach how to read `ProjectUsage` counters, the `billing` exceeds-flag semantics, or trial-period mechanics. A reader who needs that should check their Form.io plan dashboard or the platform billing API, not a schema reference.

**Why no `plan` section:** Same logic. The primary audience for this skill is self-hosted / on-prem Form.io deployments where every project's `plan` is `'commercial'`. The SaaS tier ladder (`basic` → `independent` → `team` → `trial`, plus the server-only `'archived'`) is a billing concern the agent never needs to reason about. `plan` gets one row in `project-definition.md` saying "for deployed projects this is always `'commercial'`; SaaS tier values exist but are not covered by this skill."

### Decision: Document the Stage and Tenant creation patterns as explicit copy-paste snippets

`type` alone is not enough to make a working stage or tenant — a Stage also requires `project` to point at its parent project (typically the portal/primary project). The `project-type-and-framework.md` reference includes two side-by-side JSON snippets:

```json
{ "type": "stage", "project": "<parent project ObjectId>" }
```

```json
{ "type": "tenant" }
```

These are the minimum required shapes. The reference also notes that the parent of a Stage is typically the portal project (the primary project the stage's environment branches from), and that Tenants do not require a parent reference in `project` because their multi-tenancy model is keyed differently.

**Why explicit snippets, not just prose:** Stages and tenants are the most-asked-about derived project types and the easiest to misconstruct (forgetting the `project` ObjectId on a stage is the classic mistake). A copy-paste-ready snippet is the fastest path to "right on first try."

### Decision: Document the server-extended `plan` enum and `externalOwner` field even though they aren't in the TS declaration

The Mongoose model is the runtime truth — the database accepts `'archived'` as a plan value and stores `externalOwner` on OIDC-owned projects. A reference that mirrors only the TS file would teach readers to reject valid production data. The reference includes both, marked with a one-line footnote: "Server-only — not in the upstream TypeScript declaration."

### Decision: Treat each integration / authorization block as a one-line entry with a pointer, not a full table

`ProjectSettings` has eight integration blocks and three authorization blocks. Each one has its own sub-type with its own field set (OAuth provider, LDAP server, SAML IdP metadata, etc.). Fully expanding all eleven would push `project-settings.md` past 400 lines and duplicate documentation that already lives in the upstream type files. Instead each block gets one row in a top-level `ProjectSettings` table — "what it's for, where to look next" — and the rest is left to either the upstream types (which the reference cites) or to the relevant `formio-api` endpoint reference.

**Alternative considered:** Author one sub-file per integration (`project-settings-oauth.md`, `project-settings-email.md`, …). Rejected — over-partitioning. The router table would balloon to twenty rows, and most readers want a single page with the keys, not a per-integration deep dive.

### Decision: Document `settings` as encrypted-at-rest with a one-paragraph callout

The Mongoose model installs the `EncryptedProperty` plugin against `settings`. Consumers who write the project JSON via the API send plaintext settings, and the server encrypts them. Consumers who read via the API receive plaintext settings (decrypted by the server, subject to authorization). Direct database access sees ciphertext. This is the kind of behavior a schema reference must document because it changes how the field round-trips. The `project-settings.md` reference contains a top-of-file paragraph stating exactly this.

### Decision: Cross-link to upstream type files using stable repo paths

Cross-links from project references to the relevant TS source (e.g., `oauth.ts`, `email.ts`) use the repo-relative path under `~/Documents/formio/modules/nirvana/packages/core/src/types/project/settings/`. The skill is consumed inside a Claude session where the user is working with that repo on their machine; the stable absolute path lets the user (or Claude) jump straight to the source. We accept that the path is machine-specific — every other reference cross-link in the skill is intra-repo, so this is the first time the schema skill points at an external path. This is documented in the file itself with a one-line note.

**Alternative considered:** Link to a public GitHub URL for the `nirvana` repo. Rejected — `nirvana` is the closed-source platform monorepo. A public link would 404 for external readers.

### Decision: Tests assert structural presence, not exact property lists

Same test contract as the submission domain. The tests will assert:

- Each project reference file exists, is non-empty, carries no YAML frontmatter.
- `project/README.md` no longer exists.
- `project-definition.md` mentions every TS-declared property name plus `externalOwner`.
- `project-type-and-framework.md` mentions every `ProjectType` and every `ProjectFramework` value. No `ProjectPlan` enumeration is required — that discriminator is intentionally out of scope.
- `project-definition.md` mentions `commercial` in the body, capturing the "deployed projects are always commercial" claim made in the `plan` row.
- `project-settings.md` mentions every documented `ProjectSettings` key and the word "encrypted" (covering the at-rest callout).
- `project-access.md` mentions `ProjectRole`, `ProjectFormAccess`, and `ProjectAccessInfo`.
- The router SKILL.md body references all four project reference paths and does NOT reference `project/README.md`.

### Decision: Drop the entire "placeholder domains" test once project is authored

After this change, no domains under `references/` remain placeholders. The existing layout test's `PLACEHOLDER_DOMAINS` constant becomes empty, and the corresponding `it('each placeholder domain README states not-yet-authored…')` block becomes meaningless. Removing them in this change keeps the test suite from carrying dead-code constants. The router body assertion for placeholder paths (`references/<domain>/README.md`) similarly disappears.

## Risks / Trade-offs

- **Risk:** Project envelope evolves and the reference drifts. → **Mitigation:** Same as form/submission domains — author in user-experience voice, not a 1:1 type mirror. Structural tests catch deletions but not additions; additions are caught by the standard skill-iteration practice.
- **Risk:** Documenting `'archived'` plan and `externalOwner` field diverges from the upstream TS. → **Mitigation:** Each reference contains an explicit footnote naming the divergence. A reviewer trying to delete them on the basis of "TS doesn't have these" will hit the footnote.
- **Risk:** `settings` encryption-at-rest claim becomes wrong if the platform changes its persistence model. → **Mitigation:** The claim is sourced from `Project.js` line ~240 (`model.schema.plugin(EncryptedProperty, { … plainName: 'settings' })`). If the line moves, the reference moves with it. The structural test asserts the word "encrypted" appears, but does not lock the exact phrasing — so a wording update doesn't require a code change.
- **Trade-off:** Five files is more navigation than one. We accept that — same pattern as form and submission domains.
- **Trade-off:** Treating integrations as one-line entries means a reader who wants OAuth provider config still has to load `oauth.ts` directly. The router cross-links to it; we accept the indirection in exchange for keeping `project-settings.md` under 250 lines.

## Migration Plan

1. Read every `ProjectSettings` sub-file under `~/Documents/formio/modules/nirvana/packages/core/src/types/project/settings/integrations/` and `~/.../authorization/` during apply phase so descriptions are sourced, not invented.
2. Implement the five reference files, the router SKILL.md update, and the test updates on a feature branch.
3. Delete `plugin/skills/formio-schema/references/project/README.md`.
4. Run `pnpm test`, `pnpm lint`, `pnpm format` — Definition of Done.
5. Rollback: revert the merge commit; the placeholder `README.md` returns.
