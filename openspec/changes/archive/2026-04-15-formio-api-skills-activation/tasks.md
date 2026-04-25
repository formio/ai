## 1. Validator: library root and required directory set
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: `validateLibrary` scanning a fixture rooted at `.claude/skills/` reports no `library.required_file` issues when all 17 required `formio-api-<group>/SKILL.md` files are present and non-empty
- [x] 1.2 Write failing test: `validateLibrary` emits a `library.required_file` issue naming `plugin/skills/formio-api/references/project-forms.md` when that directory's `SKILL.md` is missing
- [x] 1.3 Write failing test: `validateLibrary` emits a `library.required_file` issue when `plugin/skills/formio-api/references/runtime-submissions.md` exists but is zero bytes
- [x] 1.4 Write failing test: `validateLibrary` emits `library.required_file` pointing at the `.claude/skills/` path even when the same content is present under a legacy `skills/formio-api/` fixture path

### Green

- [x] 1.5 Replace `REQUIRED_SKILL_FILES` with `REQUIRED_SKILL_DIRS` in `packages/mcp-server/src/skills-validator.ts`; enumerate the 17 `formio-api-<group>` directories from the discovery spec
- [x] 1.6 Update `validateRequiredFiles` (and rename to `validateRequiredDirs` if needed) to resolve each entry to `<libraryDir>/<dir>/SKILL.md` and check existence + non-empty
- [x] 1.7 Update the `validateLibrary` signature so `libraryDir` defaults to `<repoRoot>/.claude/skills` and the legacy `skills/formio-api` path is never probed

### Refactor

- [x] 1.8 Review implementation and refactor as needed

## 2. Validator: router skill contract
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: router `.claude/skills/formio-api/SKILL.md` with only `name` and `description` frontmatter passes all router-applicable rules
- [x] 2.2 Write failing test: router `SKILL.md` containing a `### GET ${FORMIO_PROJECT_URL}/form` heading emits an `index.no_endpoint_docs` issue
- [x] 2.3 Write failing test: router `SKILL.md` that omits a Markdown link to one of the 17 required capability-group directories emits `index.missing_link`
- [x] 2.4 Write failing test: router `SKILL.md` linking to a non-existent sibling directory emits `index.broken_link`

### Green

- [x] 2.5 Update `validateIndexSkill` to resolve links against directory-based sibling paths (`<name>/SKILL.md`) instead of flat `<name>.md` files
- [x] 2.6 Update `INDEX_FILENAME` and `validateSkillContent`'s router-skip logic so router validation runs only the router-applicable rule set

### Refactor

- [x] 2.7 Review implementation and refactor as needed

## 3. Validator: `## MCP Tool Preference` section
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing test: skill body containing `## Overview`, `## Root URL`, `## Authentication`, `## MCP Tool Preference`, `## Endpoints`, `## Related Skills` in order passes `validateRequiredHeadings`
- [x] 3.2 Write failing test: skill body omitting `## MCP Tool Preference` emits `headings.missing` naming that heading
- [x] 3.3 Write failing test: skill body placing `## MCP Tool Preference` after `## Endpoints` emits `headings.order`

### Green

- [x] 3.4 Insert `## MCP Tool Preference` into the exported `REQUIRED_HEADINGS` array between `## Authentication` and `## Endpoints`

### Refactor

- [x] 3.5 Review implementation and refactor as needed

## 4. Validator: description trigger and negative-trigger rules
<!-- depends_on: 1 -->

### Red

- [x] 4.1 Write failing test: description containing `"Use when the user asks to ..."` passes `validateDescriptionTriggers`
- [x] 4.2 Write failing test: description without any `use when` (case-insensitive) emits `description.trigger_phrase`
- [x] 4.3 Write failing test: router skill description without `use when` passes (router is exempt)
- [x] 4.4 Write failing test: `scope: project` skill description containing `"Not for: ..."` passes `validateDescriptionNegativeTrigger`
- [x] 4.5 Write failing test: `scope: runtime` skill description without `not for:` emits `description.negative_trigger`
- [x] 4.6 Write failing test: `scope: platform` skill description without `not for:` passes (platform is exempt)
- [x] 4.7 Write failing test: `scope: pdf` skill description without `not for:` passes (pdf is exempt)

### Green

- [x] 4.8 Implement `validateDescriptionTriggers(file, data)` in `skills-validator.ts` that asserts `data.description` contains `use when` (case-insensitive) for non-router skills
- [x] 4.9 Implement `validateDescriptionNegativeTrigger(file, data)` that asserts `data.description` contains `not for:` (case-insensitive) when `data.scope` is `project` or `runtime`
- [x] 4.10 Compose both new rules into `validateSkillContent`

### Refactor

- [x] 4.11 Review implementation and refactor as needed

## 5. Physical relocation: move library content to `.claude/skills/`
<!-- depends_on: 1, 2, 3, 4 -->

### Red

- [x] 5.1 Write failing test: `validateLibrary(path.join(repoRoot, '.claude/skills'))` returns an empty issue array against the actual repository content
- [x] 5.2 Write failing test: a filesystem check asserts that `skills/formio-api/` does NOT exist in the repository

### Green

- [x] 5.3 For each capability-group file in `skills/formio-api/<group>.md`, create `.claude/skills/formio-api-<group>/SKILL.md` containing the file's existing body (unchanged for now)
- [x] 5.4 Create `.claude/skills/formio-api/SKILL.md` from the existing `skills/formio-api/README.md` content, with frontmatter `name: formio-api` and the original description
- [x] 5.5 Update every frontmatter `name` field in the 17 new `SKILL.md` files to the `formio-api-<group>` prefixed form
- [x] 5.6 Delete `skills/formio-api/` entirely

### Refactor

- [x] 5.7 Review implementation and refactor as needed

## 6. Content rewrite: description trigger + negative-trigger clauses
<!-- depends_on: 5 -->

### Red

- [x] 6.1 Write failing test: every capability-group skill's description, when run through `validateDescriptionTriggers`, emits no issue
- [x] 6.2 Write failing test: every `scope: project` or `scope: runtime` skill's description, when run through `validateDescriptionNegativeTrigger`, emits no issue

### Green

- [x] 6.3 Rewrite the `description` field of each of the 17 capability-group `SKILL.md` files to append (a) a "Use when the user asks to …" trigger clause with 3–6 action verbs and 2–3 user-language synonyms, and (b) where scope is `project` or `runtime`, a "Not for: …" clause naming the sibling skill(s) by `formio-api-`-prefixed identifier
- [x] 6.4 Preserve the capability clause — the existing description text stays as the first clause of the new composite description

### Refactor

- [x] 6.5 Review implementation and refactor as needed

## 7. Content rewrite: `## MCP Tool Preference` section per skill
<!-- depends_on: 5 -->

### Red

- [x] 7.1 Write failing test: `formio-api/references/project-forms.md` contains a `## MCP Tool Preference` section whose body includes `form_create`, `form_get`, `form_list`, and `form_update` as preferred tools
- [x] 7.2 Write failing test: `formio-api/references/runtime-reports.md` contains a `## MCP Tool Preference` section whose body is exactly the single sentence `No MCP tool covers this operation — use the HTTP endpoint directly.`
- [x] 7.3 Write failing test: every capability-group `SKILL.md` body passes `validateRequiredHeadings` (which now includes `## MCP Tool Preference` between Authentication and Endpoints)

### Green

- [x] 7.4 Insert a `## MCP Tool Preference` section into `formio-api/references/project-forms.md` between `## Authentication` and `## Endpoints` with the form_* MCP tool mapping table from design.md
- [x] 7.5 Insert a `## MCP Tool Preference` section into the remaining 16 capability-group `SKILL.md` files. Each section uses the uniform fallback sentence when no matching MCP tool exists

### Refactor

- [x] 7.6 Review implementation and refactor as needed

## 8. Documentation pointers
<!-- depends_on: 5 -->

### Red

- [x] 8.1 Write failing test: `CLAUDE.md` references `.claude/skills/` and does not reference `skills/formio-api/`
- [x] 8.2 Write failing test: `README.md` has no remaining link targeting `skills/formio-api/`

### Green

- [x] 8.3 Update `CLAUDE.md`'s "Skills Library" section to reference `.claude/skills/` as the library location and to point readers at the new router skill `.claude/skills/formio-api/SKILL.md`
- [x] 8.4 Update `README.md`'s skill-library pointers to the new location

### Refactor

- [x] 8.5 Review implementation and refactor as needed
