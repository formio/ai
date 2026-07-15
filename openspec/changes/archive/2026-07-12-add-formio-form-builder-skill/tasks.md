# Tasks: add `formio-form-builder` skill

## 1. Skill structure — directory, description, symlink
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing structural tests in `packages/skill-tests/src/formio-form-builder/skill-structure.test.ts` (mirror `packages/skill-tests/src/formio-form/skill-structure.test.ts`): `plugin/skills/formio-form-builder/SKILL.md` exists with frontmatter `name: formio-form-builder` and a non-empty `description`; step docs `FORM_TYPES.md`, `INTENT.md`, `SAVE.md`, `EMBED.md` exist, are non-empty, and do not start with `---`; the skill directory has no `references/` directory; `.claude/skills/formio-form-builder` is a symlink resolving to `plugin/skills/formio-form-builder/`
- [x] 1.2 Write failing tests for the three-clause description: contains `Use when the user asks to`; contains `Not for:` naming all five siblings; states the form-vs-resource boundary rule (standalone form vs data model/app). Use backtick-delimited matching (`` `formio-form` `` vs `` `formio-form-builder` ``) or word-boundary regex — no plain substring where the two names could be confused

### Green

- [x] 1.3 Create `plugin/skills/formio-form-builder/SKILL.md` — orchestrator router modeled on `plugin/skills/formio-application/SKILL.md`: three-clause frontmatter description (triggers: "build a form", "create a form", "I would like a new form", "multi-page form", "build a wizard", "create a survey / contact form / intake form / registration form / questionnaire", "pdf form"; boundary rule verbatim; `Not for:` naming `formio-form`, `formio-application`, `formio-resource-planner`, `formio-schema`, `formio-api`), stance, the four-step flow (INTENT → SCHEMA → SAVE → EMBED) with links to the step docs, SCHEMA delegation to `formio-schema` by name, URL terminology section (`baseUrl` = `FORMIO_BASE_URL` only; `projectUrl` = `FORMIO_PROJECT_URL` only), and the `## MCP Tool Preference` section (`form_create`, `form_get`, `authenticate`, canonical portal-login `x-jwt-token` paragraph, no PKCE/API keys)
- [x] 1.4 Create the dev symlink `.claude/skills/formio-form-builder -> ../../plugin/skills/formio-form-builder` and placeholder-free step docs so the layout tests pass (content lands in groups 2–3)

### Refactor

- [x] 1.5 Review implementation and refactor as needed

## 2. Step docs — FORM_TYPES, INTENT
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing tests: `FORM_TYPES.md` documents all three form types (webform, wizard, PDF form) with when-to-choose guidance and INTENT distinguishing signals; the wizard section covers nested/child wizard workflows; the PDF section states the PDF-document prerequisite
- [x] 2.2 Write failing tests: `INTENT.md` scripts a single batched `AskUserQuestion` capturing form type AND embed intent; instructs infer-and-confirm for unambiguous phrasing; references `FORM_TYPES.md` by path; states the EMBED step fires only on an explicit yes

### Green

- [x] 2.3 Author `FORM_TYPES.md` from the official docs — https://help.form.io/form-building/form-types, https://help.form.io/form-building/pdf-forms, https://help.form.io/how/nested-form-workflows/nested-wizard-workflow#create-child-wizard — covering what each type is, capabilities, when to choose it, and the phrasing signals INTENT uses (e.g., "multi-page form" ⇒ wizard)
- [x] 2.4 Author `INTENT.md` — the batched interview script mirroring `plugin/skills/formio-application/INTENT.md`'s shape: one `AskUserQuestion` with the form-type question (inferred recommendation first when unambiguous) and the embed-intent question (explicit yes gates EMBED; "no"/"later" ends the flow at SAVE)

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. Step docs — SAVE, EMBED
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing tests: `SAVE.md` scripts the approval gate (form title/path/type + target project), the `form_create` invocation, the saved-form confirmation including the full form URL under `FORMIO_PROJECT_URL`, and the auth-error branch routing through `authenticate` (`x-jwt-token`); no `formio-form-builder` doc mentions PKCE or API keys as auth mechanisms
- [x] 3.2 Write failing tests: `EMBED.md` defines the conditional handoff — only on explicit yes from INTENT — to `formio-form` with the saved form URL, and routes Angular-explicit requests through `formio-angular`; no `formio-form-builder` doc duplicates component JSON shapes or embed mechanics (defers to `formio-schema` / `formio-form` by name)

### Green

- [x] 3.3 Author `SAVE.md` — approval gate, `form_create` call (no MCP server changes; the tool already instructs `formio-schema` usage), success confirmation with `{FORMIO_PROJECT_URL}/{formPath}`, and error branches (auth failure → `authenticate` portal-login flow and retry; validation failure surfaced with retry/bail choice)
- [x] 3.4 Author `EMBED.md` — the handoff contract: fires only on the INTENT explicit yes, passes the saved form URL, `formio-form` handles unnamed-framework embedding, Angular-explicit routes through `formio-angular`

### Refactor

- [x] 3.5 Review implementation and refactor as needed

## 4. Sibling reverse pointers and handoffs
<!-- depends_on: 1 -->

### Red

- [x] 4.1 Write failing structural tests (in the group 1 test file): the `formio-application`, `formio-resource-planner`, and `formio-form` `SKILL.md` frontmatter descriptions each contain a `Not for:` clause naming the backtick-delimited `` `formio-form-builder` ``; assert `formio-schema`'s description does NOT contain the substring `formio-form` (the spec-forbidden string — no reverse pointer there)

### Green

- [x] 4.2 Update `plugin/skills/formio-application/SKILL.md`: add the `Not for:` pointer at `formio-form-builder` for standalone single-form creation, and add the mid-orchestration handoff note (standalone-form intent hands off to `formio-form-builder` instead of running the planner/import pipeline)
- [x] 4.3 Update `plugin/skills/formio-resource-planner/SKILL.md`: add the `Not for:` pointer at `formio-form-builder` for standalone single-form creation requests
- [x] 4.4 Update `plugin/skills/formio-form/SKILL.md`: add `formio-form-builder` to the `Not for:` clause (create-a-new-form requests; `formio-form` stays embed-only) and add the inbound-handoff guidance (form doesn't exist yet, or complex form needing form-type determination → route to `formio-form-builder` first, embedding resumes with the saved form URL)

### Refactor

- [x] 4.5 Review implementation and refactor as needed

## 5. Plugin packaging
<!-- depends_on: 1 -->

### Red

- [x] 5.1 Update `packages/mcp-server/src/__tests__/plugin-build.test.ts` assertion 1.3 to expect `formio-form-builder` in `dist/plugin/skills/` (fails until the skill directory exists and the plugin is rebuilt); verify no assertion excludes `formio-form-builder`

### Green

- [x] 5.2 Run `pnpm build:plugin` and confirm the bundled tree contains `skills/formio-form-builder/` with all step docs; make the updated build test pass (the build script copies `plugin/skills/` wholesale — no script change expected)

### Refactor

- [x] 5.3 Review implementation and refactor as needed

## 6. Definition of Done
<!-- depends_on: 1, 2, 3, 4, 5 -->

### Red

- [x] 6.1 Run the full suite (`pnpm test`) and capture any remaining failures across skill-tests and mcp-server tests — including the pre-existing `formio-form` structural suite, whose sibling-pointer assertions must not be weakened or vacuously satisfied by `formio-form-builder` mentions

### Green

- [x] 6.2 Fix any failures; then `pnpm test`, `pnpm lint`, and `pnpm format` all pass clean

### Refactor

- [x] 6.3 Review implementation and refactor as needed
