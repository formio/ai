## Why

The `formio-schema` skill now ships authored references for the `form` and `submission` domains, but `references/project/` is still a one-file `README.md` placeholder pointing back at `formio-api`'s `platform-projects` endpoint reference. That placeholder is useful for someone calling the project endpoint, but it gives Claude nothing when a user asks "what's in this project JSON?" — how to read `settings`, what `plan`/`type`/`framework` accept, how `access` differs from form/submission access, what `remote` means for stages, how `formDefaults` propagates, what `externalOwner` encodes for OIDC, what's encrypted at rest. The project envelope is the largest of the three top-level Form.io documents and is the one most often misread.

Two authoritative sources exist on the user's machine:

- `~/Documents/formio/modules/nirvana/packages/core/src/types/project/Project.ts` — the TypeScript declaration of `Project`, `ProjectType`, `ProjectPlan`, `ProjectFramework`, `ProjectUsage`, `ProjectBilling`, `ProjectApiCalls`, `ProjectRole`, `ProjectFormAccess`, `ProjectAccessInfo`, plus the imported `ProjectSettings` shape under `project/settings/`.
- `~/Documents/formio/modules/nirvana/apps/formio-server/src/models/Project.js` — the Mongoose schema used by the API server, which carries authoritative `description` strings on most fields, validation constraints (length limits, name regex, reserved-subdomain check), default values, the runtime-extended `plan` enum (adds `'archived'`), the `externalOwner` OIDC sub-document, and the `settings` encryption-at-rest contract.

Pairing the two is enough to author a real project-domain reference set now.

## What Changes

- Promote the project domain from "not yet authored" placeholder to a fully authored reference set under `plugin/skills/formio-schema/references/project/`. Delete the placeholder `README.md`.
- Author four reference files mirroring the form and submission domain pattern (each non-empty, no YAML frontmatter). Billing and usage statistics are deliberately out of scope — `billing`, `apiCalls`, `trial`, and the full `ProjectUsage` counter set get one-line rows in `project-definition.md`'s property table and nothing more; they are operator/SaaS concerns, not schema-authoring concerns, and the skill does not need to teach how to read them:
  - `project-definition.md` — top-level `Project` envelope: every TS-declared property plus the server-only `externalOwner` field, with type / required / description / constraint columns sourced from the Mongoose schema. Includes a worked example. Billing/usage fields appear as table rows only (`billing` and `apiCalls` get a one-line "server-managed billing/usage data — see your Form.io plan dashboard, not documented as schema" entry).
  - `project-type-and-framework.md` — two of the three discriminators: `type` (`project`/`stage`/`tenant`) and `framework` (the nine `ProjectFramework` values). Explicitly documents the two derived project patterns: a **Stage** sets `type: 'stage'` plus `project: <parent project ObjectId>` (the parent is typically the portal/primary project the stage belongs to); a **Tenant** sets `type: 'tenant'`. Includes a small JSON snippet for each pattern so an integrator can copy-paste the minimum required shape. The `plan` discriminator is intentionally NOT documented in depth — for self-hosted and on-prem deployments (the primary use case for these agentic skills) it is always `'commercial'`, and the SaaS plan tiers (`basic`/`independent`/`team`/`trial`) are out of scope.
  - `project-settings.md` — the `ProjectSettings` shape: `appOrigin`, `keys`, `cors`, `csp`, `secret`, PDF settings (`pdfserver`, `filetoken`), public config flags (`allowConfig`, `allowConfigToForms`), `custom` CSS/JS, `formModule`, every integration block (`email`, `captcha`, `recaptcha`, `esign`, `google`, `kickbox`, `sqlconnector`, `storage`), every authorization block (`tokenParse`, `oauth`, `ldap`, `saml`), and the encryption-at-rest contract (the entire `settings` blob is stored encrypted in MongoDB via the `EncryptedProperty` plugin).
  - `project-access.md` — project-level `access` array and the supporting `ProjectRole`, `ProjectFormAccess`, `ProjectAccessInfo` types. Explains how project-level `access` differs from form-level / submission-level access (project access governs who can see / modify the project itself; form-level governs form definitions; submission-level governs submission records).
- Update `plugin/skills/formio-schema/SKILL.md`:
  - Promote the project row from the still-placeholder section into its own multi-row reference table mirroring the existing submission table.
  - Update the trigger clause so project-specific prompts (project settings, stages, tenants, OAuth/LDAP/SAML config, file storage, project plan, project access) clearly activate the skill.
  - Drop the "Projects" placeholder section (no domains remain placeholders).
- Update `packages/mcp-server/src/__tests__/formio-schema-layout.test.ts`:
  - Remove the project entry from the `PLACEHOLDER_DOMAINS` constant — no placeholders remain.
  - Drop the entire "each placeholder domain README states not-yet-authored…" test (no placeholders left).
  - Drop the "body references each `references/<domain>/README.md` placeholder" router-body assertion (no placeholder paths left).
  - Add a project-domain `describe` block mirroring the submission-domain block: assert each new `project/*.md` file exists, is non-empty, carries no YAML frontmatter, and that `project/README.md` does not exist.
  - Add body-content assertions for the four project references — `project-definition.md` mentions every Project property name from the TS interface plus `externalOwner` and mentions that for deployed projects `plan` is always `'commercial'`; `project-type-and-framework.md` mentions every `ProjectType` and every `ProjectFramework` value (no `ProjectPlan` enumeration); `project-settings.md` mentions every documented `ProjectSettings` key plus a callout that `settings` is encrypted at rest; `project-access.md` mentions `ProjectRole`, `ProjectFormAccess`, and `ProjectAccessInfo`.
  - Add a router-body assertion that all four `references/project/project-*.md` paths appear and that `references/project/README.md` is absent.

## Capabilities

### Modified Capabilities

- `formio-schema-skill`: Adds requirements that the project domain has authored reference files (no longer a placeholder), enumerates the required project reference files, and constrains the router SKILL.md to enumerate every project reference. Removes the "placeholder domains" requirement since no domains remain unauthored.

## Impact

- **Skill content**: `plugin/skills/formio-schema/references/project/` gains four authored reference files; the placeholder `README.md` is deleted.
- **Skill router**: `plugin/skills/formio-schema/SKILL.md` gains a project-domain reference table, drops its "Projects" placeholder section, and broadens the trigger clause.
- **Tests**: `packages/mcp-server/src/__tests__/formio-schema-layout.test.ts` updated — placeholder-domain test removed, project authored-reference assertions added.
- **No code changes**: No MCP tool, server, or build script changes are needed.
- **External research**: `Project.ts` + `Project.js` (server Mongoose model) + `ProjectSettings.ts` and its `authorization/` and `integrations/` sub-types are the only inputs. The change does NOT depend on any public help.form.io page.
