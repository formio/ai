## 1. tools/list headroom

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: no input or output schema in `tools/list` carries a `$schema` key

### Green

- [x] 1.2 Strip `$schema` at registration; shorten the shared "fields sent overwrite" sentence in the three update tools; confirm the budget test and every output-schema test pass

### Refactor

- [x] 1.3 Review implementation and refactor as needed

## 2. Skill text against tool schemas

<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing tests in `packages/mcp-server`: an unregistered tool name in `plugin/skills/` fails (with an explicit allowlist for look-alike variable names); an argument named beside a tool that its schema does not take fails; a documented enum value outside the schema fails — verified against a seeded bad fixture

### Green

- [x] 2.2 Implement the scanner over every markdown file under `plugin/skills/`; fix any real mismatch it finds in the skills

### Refactor

- [x] 2.3 Review implementation and refactor as needed

## 3. Writing-tools list from annotations

<!-- depends_on: none -->

### Red

- [x] 3.1 Rewrite `preflight-writing-tools.test.ts` to derive the set from the registered tools' annotations (`readOnlyHint === false && openWorldHint === true`) and fail on a copy that differs

### Green

- [x] 3.2 Make every preflight copy agree with the derived set

### Refactor

- [x] 3.3 Review implementation and refactor as needed

## 4. Skill examples against installed packages

<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing tests for the extractor: fenced-block extraction, self-contained detection, `<!-- example: fragment -->` skip
- [x] 4.2 Write failing tests: named imports in `formio-sdk`, `formio-form`, `formio-react-form` examples exist in the installed packages; self-contained `formio-sdk` TypeScript examples type-check (`tsc --noEmit`) against `@formio/js`
- [x] 4.3 Add `@formio/react` as a `skill-tests` dev dependency for the React import and prop checks

### Green

- [x] 4.4 Implement the extractor and both checks; mark genuine fragments; fix any real example error the checks find

### Refactor

- [x] 4.5 Review implementation and refactor as needed

## 5. Versions read at run time

<!-- depends_on: none -->

### Red

- [x] 5.1 Update `form-sub-skill.test.ts`, `angular-21.test.ts`, and add tests: `formio-react` and `formio-angular` version-dependent steps name the `npm view` read and state no fixed range, major, or size as fact

### Green

- [x] 5.2 Rewrite the version text in `formio-react/BOOTSTRAP.md`, `EXISTING.md`, `formio-react-form/references/environments.md`, `formio-angular/BOOTSTRAP.md`, `formio-angular-form/SKILL.md`, and the styling reference

### Refactor

- [x] 5.3 Review implementation and refactor as needed

## 6. Small corrections

<!-- depends_on: none -->

### Red

- [x] 6.1 Write failing grader check: a template whose login form carries only a Login action passes the Save assertion; a login-form Save with `settings.resource` fails the new assertion
- [x] 6.2 Write failing tests: no `0.9.0` or `>=0.9.0` in `formio-mcp-setup/SKILL.md` or `llms-install.md`, and no same-version-awaiting-publication sub-branch; both upgrade paths remain
- [x] 6.3 Move the `FORMIO_DEFAULT_PROJECT_URL` assertion into `project_set-registration.test.ts` (against the registered description) and delete the source-grepping block

### Green

- [x] 6.4 Fix `grade.py`; trim the too-old section and `llms-install.md`; update `mcp-setup-skill.test.ts` and `url-values-without-server.test.ts` expectations accordingly
- [x] 6.5 Remove `authenticate` from `CLAUDE.md`; update the three spec Purpose lines and `tool-path-arguments` scenario names to current tool names; retake the README's MCP Inspector screenshots — screenshots deferred to the release proposal: another Chrome extension blocks automated input on the Inspector page

### Refactor

- [x] 6.6 Review implementation and refactor as needed

## 7. Live tool runner

<!-- depends_on: 1 -->

### Red

- [x] 7.1 Write failing tests for the runner's guards (pure functions): an unlisted target is refused naming both URLs; coverage check fails for a registered tool with no case; clean-up plan lists every prefixed entity and the version to restore
- [x] 7.2 Write the live cases, one or more per registered tool, including the documented refusals

### Green

- [x] 7.3 Implement `pnpm test:live` (own Vitest config, stdio client, resolver-based target, allowlist, guaranteed clean-up); document it in `CONTRIBUTING.md`
- [x] 7.4 Run it against `https://form.test/sandbox`; every case passes and the project is left as found

### Refactor

- [x] 7.5 Review implementation and refactor as needed

## 8. Release and Definition of Done

<!-- depends_on: 1, 2, 3, 4, 5, 6, 7 -->

### Red

- [x] 8.1 Run the routing eval if any description changed; no prompt that passed before fails

### Green

- [x] 8.2 Add `.changeset/drift-guards.md` (`'@formio/mcp': patch`, `'@formio/ai': patch`)
- [x] 8.3 Run `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm check:releases`, and `openspec validate drift-guards --strict`; all pass

### Refactor

- [x] 8.4 Review implementation and refactor as needed
