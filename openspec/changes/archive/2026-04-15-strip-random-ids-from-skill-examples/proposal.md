## Why

The Form.io API skills under `.claude/skills/formio-api-*/SKILL.md` carry example values that leaked from the Postman collection's collision-avoidance scheme — `"title": "Employee 775"`, `"name": "employee-510"`, `"path": "user/login-374"`, `"machineName": "example-906:example-771:save"`, and similar. Postman adds those suffixes so two people running the same request in the same project don't overwrite each other; skills serve the opposite purpose — they teach Claude what a canonical Form.io request looks like. The suffixes make examples noisier, invite copy-paste of nonsense identifiers into real projects, and risk nudging Claude toward generating randomized values where clean slugs are expected. A scan of the library finds ~19 affected lines across `formio-api/references/pdf-api`, `formio-api/references/project-actions`, `formio-api/references/project-form-revisions`, `formio-api/references/project-roles`, `formio-api/references/runtime-access-control`, `formio-api/references/runtime-custom-users`, and others.

## What Changes

- Remove trailing integer suffixes from example identifier values in every `.claude/skills/formio-api-*/SKILL.md` file. Applies to the following JSON/YAML-like keys: `title`, `name`, `path`, `key`, `machineName`. Example transformations:
  - `"title": "Employee 775"` → `"title": "Employee"`
  - `"name": "employee-510"` → `"name": "employee"`
  - `"path": "user/login-374"` → `"path": "user/login"`
  - `"machineName": "example-906:example-771:save"` → `"machineName": "example:example:save"`
- Preserve integer suffixes that are semantically meaningful: MongoDB ObjectIds (24-char hex), UUIDs, PDF overlay numeric fields like `"key": "f1010"` (which are positional PDF-field identifiers, not collision suffixes), and any numeric fragment inside an HTTP URL path that represents a resource ID rather than a name suffix.
- Add a validator rule `validateNoRandomIdSuffixes` in `packages/mcp-server/src/skills-validator.ts` that scans every capability-group `SKILL.md` for example values containing the banned pattern (a known identifier key followed by a slug ending in `-[0-9]{2,}` or a title ending in ` [0-9]{2,}`), and emits a validation issue when one is found. This prevents regression the next time skills are regenerated from Postman or authored by hand.
- Extend the skills-library Vitest suite with fixtures exercising the new rule (positive match on `Employee 775`, no match on a 24-char ObjectId, no match on `f1010`).
- **Non-goals**: no changes to the endpoint documentation itself, no change to the real library-checkin content other than the suffix removal, no changes to frontmatter, required headings, auth paragraph, description rules, or scope map.

## Capabilities

### New Capabilities

<!-- None. This change adds enforcement inside the existing api-skills-authoring capability. -->

### Modified Capabilities

- `api-skills-authoring`: add a requirement forbidding random collision-avoidance integer suffixes in example values, with the validator rule listed above.

## Impact

- **Content rewritten** across the ~7 skill files where suffixes appear: `formio-api/references/pdf-api`, `formio-api/references/project-actions`, `formio-api/references/project-form-revisions`, `formio-api/references/project-roles`, `formio-api/references/runtime-access-control`, `formio-api/references/runtime-custom-users`, and any others discovered during implementation.
- **Validator**: new rule in `skills-validator.ts`, wired into `validateSkillContent`.
- **Tests**: new fixtures in `packages/mcp-server/src/__tests__/skills-library.test.ts` covering the rule's positive and negative matches, plus the real-library assertion picks up any missed suffix during the check-in.
- **Docs**: no changes required — `CLAUDE.md`'s existing Skills Library section already points at the validator as the source of truth.
- **No runtime code changes** in the MCP server.
- **Dependencies**: none added.
