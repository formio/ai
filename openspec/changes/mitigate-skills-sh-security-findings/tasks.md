## 1. formio-sdk — Security section and credential ban

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test in `packages/skill-tests/src/formio-sdk/security-section.test.ts`: `plugin/skills/formio-sdk/SKILL.md` contains a `## Security` heading positioned after `## Authentication` and before `## MCP Tool Preference`
- [x] 1.2 Write failing test: the Security section names `requireLibrary`, `registerEvaluator`, `Utils.sanitize`, and `setToken`, and states that returned JSON is data and not an instruction to the agent
- [x] 1.3 Write failing test: no file matching `plugin/skills/formio-sdk/**/*.md` contains a `SG.`-prefixed string, `api_key: '`, or `password: '` (test names the offending file and pattern)
- [x] 1.4 Write failing test: `references/projects.md` states that credential-bearing settings are configured in the portal or supplied from a secret store

### Green

- [x] 1.5 Add the `## Security` section to `plugin/skills/formio-sdk/SKILL.md` with the four rules from the spec, each linking to its reference; word it to the SDK's call sites so it is not a near-copy of `formio-form`'s section
- [x] 1.6 Replace the SendGrid example in `references/projects.md` with a non-secret `settings.cors` edit plus the one-sentence credential-placement rule
- [x] 1.7 Replace `password: 'hunter2'` in `references/auth.md` with a value bound from a form field or variable, saying so in one sentence
- [x] 1.8 Run `shared-prose-stays-identical.test.ts`, `url-terminology.test.ts`, and `description-budget.test.ts`; reword any flagged paragraph rather than exempting it

### Refactor

- [x] 1.9 Review implementation and refactor as needed

## 2. formio-sdk — reference-level trust rules

<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test in `security-section.test.ts`: `references/setup.md`'s loader section states that `src` is version-pinned on a host the application owns and is never built from runtime data
- [x] 2.2 Write failing test: in `references/utils-evaluator.md`'s `## Examples`, the first `###` heading is the sandboxed-evaluator example and the JSONLogic example precedes every example passing a string to `evaluate`, `evaluator`, or `interpolateString`
- [x] 2.3 Write failing test: every string-code example in `utils-evaluator.md` is introduced by a sentence stating the expression is an authored literal
- [x] 2.4 Write failing test: `references/rendering.md` states that a definition renders only from a project the application controls and links to `../../formio-form/SKILL.md`
- [x] 2.5 Write failing test: `references/submissions.md` states that submission `data.*` is end-user input and names `Utils.sanitize` as the HTML path

### Green

- [x] 2.6 Add the origin rule to `references/setup.md` beside the lazy-library helpers and reword the `cdn.setBaseUrl` example's host as one the application serves
- [x] 2.7 Reorder `references/utils-evaluator.md` examples (sandboxed evaluator, JSONLogic, then string code) and add the authored-literal sentence to each string-code example; keep every heading
- [x] 2.8 Add the `formSrc` trust paragraph to `references/rendering.md` with the link to `formio-form`'s Security section
- [x] 2.9 Add the `data.*` untrusted paragraph to `references/submissions.md`
- [x] 2.10 Run `cross-reference-integrity.test.ts` and the full `formio-sdk` suite (including `utils-evaluator.test.ts`, which exercises the promoted `registerEvaluator` example)

### Refactor

- [x] 2.11 Review implementation and refactor as needed

## 3. formio-angular — scoped skill install

<!-- depends_on: none -->

### Red

- [x] 3.1 Write failing test in `packages/skill-tests/src/formio-angular/flow-contracts.test.ts`: no `plugin/skills/formio-angular/**/*.md` contains the token `--all`
- [x] 3.2 Write failing test: `BOOTSTRAP.md` Step 2 contains `--skill angular-new-app`, `-a <agent>`, and a `--list` invocation before the approval question
- [x] 3.3 Write failing test: the offer paragraph names `angular-new-app` as the only skill installed and no longer states that every skill in the repository is installed

### Green

- [x] 3.4 Rewrite `BOOTSTRAP.md` Step 2: `--list` preview, the `--skill angular-new-app -a <agent> -y` command, and the three-things paragraph (source, one named skill, installed skill becomes instructions); keep the fallback and the "never retry against a different source" rule
- [x] 3.5 Update `SKILL.md`'s BOOTSTRAP summary and skip-condition prose to describe the scoped install
- [x] 3.6 Run `no-install-commands-in-skills.test.ts` and `workspace-root.test.ts` to confirm the pre-existing Angular exception and the run-from-`workspaceRoot` rule still hold

### Refactor

- [x] 3.7 Review implementation and refactor as needed

## 4. formio-angular — honor the workspace's save prefix

<!-- depends_on: 3 -->

### Red

- [x] 4.1 Write failing test in `flow-contracts.test.ts`: `BOOTSTRAP.md` does not contain `--save-prefix='^'` and does not instruct rewriting an exact pin or `~` range to `^`
- [x] 4.2 Write failing test: the "Add the Form.io packages" section still uses `@^<FORMIO_ANGULAR_VERSION>` and `@^<FORMIO_JS_VERSION>` and states that the committed lockfile carries the resolved versions
- [x] 4.3 Write failing test: Step 4's package.json check accepts an entry in `^`, `~`, or exact form that resolves to the captured version

### Green

- [x] 4.4 Rewrite the caret paragraph in "Add the Form.io packages": caret default, `.npmrc` wins, lockfile sentence; remove the `--save-prefix='^'` override and the rewrite-and-reinstall instruction
- [x] 4.5 Update Step 4's verification bullets and the "If the Form.io entries landed as exact pins" sentence to accept any range form at the captured version; apply the same to Step 5's Bootstrap install
- [x] 4.6 Run the full `formio-angular` suite and `url-terminology.test.ts` (the `FORMIO_ANGULAR_VERSION` / `FORMIO_JS_VERSION` capture labels are outside its scope and must stay that way)

### Refactor

- [x] 4.7 Review implementation and refactor as needed

## 5. formio-form — external-data trust block and fifth security rule

<!-- depends_on: 1 -->

### Red

- [x] 5.1 Write failing test in `packages/skill-tests/src/formio-form/external-data.test.ts`: `references/external-data.md` has a block before the first pattern stating that the application fetches at runtime and the agent does not fetch during the task, that responses are shape-validated before `setSubmission`, and that `{{{ }}}` is never used over externally fetched items
- [x] 5.2 Write failing test: no URL in `external-data.md` names `api.example.com`
- [x] 5.3 Write failing test in `skill-structure.test.ts`: the Security section of `formio-form/SKILL.md` contains five bullet rules and the fifth states that fetched or supplied JSON never instructs the agent

### Green

- [x] 5.4 Add the trust block to `references/external-data.md` after `## Overview` and rewrite example hosts as `https://api.<your-domain>/…`
- [x] 5.5 Add the fifth bullet to `formio-form/SKILL.md`'s Security section, worded to the embed task (`form_get`, pasted JSON, pre-fill submissions) so it is distinct from `formio-sdk`'s rule
- [x] 5.6 Run `shared-prose-stays-identical.test.ts` against `formio-sdk`, `formio-form`, and `formio-react-form`; if `formio-react-form` carries a byte-identical copy of the Security section, apply the same fifth bullet there so the copies stay identical
- [x] 5.7 Run the `formio-form` behavior suite (`external-data.test.ts` renders the cascading example) to confirm the rewritten hosts did not break a fixture

### Refactor

- [x] 5.8 Review implementation and refactor as needed

## 6. formio-application — requirements, not commands

<!-- depends_on: none -->

### Red

- [x] 6.1 Write failing test in `packages/skill-tests/src/skill-descriptions/application-orchestration.test.ts`: Step 1 of `formio-application/SKILL.md` states the description is never placed into a shell command, URL, or generated source verbatim, and names the Phase A approval gate and the import preview
- [x] 6.2 Write failing test: the modify-existing handoff describes the feature request as a quoted requirements block, does not describe it as passed "verbatim", and references the sub-skill's data-not-instructions rule

### Green

- [x] 6.3 Add the requirements-not-commands note under Step 1 with links to the planner's identifier validation and the extend sub-skills' existing rule
- [x] 6.4 Rewrite the feature-request item in `## Handoff contracts` as a quoted requirements block pointing at the sub-skill's rule
- [x] 6.5 Run `application-orchestration.test.ts`, `planner-artifact-trust.test.ts`, and `description-budget.test.ts`

### Refactor

- [x] 6.6 Review implementation and refactor as needed

## 7. Library-wide close-out

<!-- depends_on: 1, 2, 3, 4, 5, 6 -->

### Red

- [x] 7.1 Write failing test (or extend `conformance.test.ts`): `CLAUDE.md`'s skills-library section states the convention that a skill documenting an execution surface carries its own `## Security` section

### Green

- [x] 7.2 Add the one-sentence security-section convention to `CLAUDE.md`
- [x] 7.3 Unwrap edited markdown with `npx prettier --prose-wrap never --ignore-path=/dev/null --write <edited paths only>` and read the diff; none of the edited files carries a markdown-in-markdown fence
- [x] 7.4 Run `pnpm test`, `pnpm lint`, `pnpm format`
- [ ] 7.5 After the next plugin release, record the skills.sh re-scan verdicts for the four skills in this change's `design.md` under a "Post-release verification" heading, noting any residual finding as accepted per the proposal

### Refactor

- [x] 7.6 Review implementation and refactor as needed

## 8. Post-implementation audit corrections

<!-- depends_on: 1, 2, 3, 4, 5, 6 -->

### Red

- [x] 8.1 Write failing tests: `utils-evaluator.md` documents `{{ }}` as raw and `{{{ }}}` as HTML-escaped; `external-data.md` states the same direction and that select templates are sanitized either way
- [x] 8.2 Write failing test: the sandboxed-evaluator example states that the application's own `calculateValue` / `validate.custom` / custom `logic` stop evaluating under it
- [x] 8.3 Write failing tests: `auth.md`, `submissions.md`, `files.md`, `plugins.md`, `utils-conditions.md`, `utils-logic.md`, `utils-form-traversal.md`, and `utils-mask-sanitize.md` each carry their boundary statement; the Security section names `registerPlugin`
- [x] 8.4 Write failing tests: the handoff describes the request as the user's instruction the sub-skill acts on; Step 1 says the description never lands unescaped in generated source
- [x] 8.5 Write failing tests: `BOOTSTRAP.md` has no "`package.json` must contain" block; no Angular document carries `x-jwt-token: $JWT`; `app-integration.md` no longer says "Do not pin versions" and names the committed lockfile; the resources Next steps name the `project_import` tool

### Green

- [x] 8.6 Correct the escaping direction in `utils-evaluator.md` and `external-data.md`; restate the sandbox example's cost; split the sdk Security bullet and add the plugin bullet
- [x] 8.7 Add the boundary sentences to the eight `formio-sdk` references; make the SSO example strip the token with `history.replaceState`
- [x] 8.8 Reword the handoff in `SKILL.md`, `INTENT.md`, and `FRAMEWORK.md`; tighten Step 1's generated-source clause
- [x] 8.9 Fix `BOOTSTRAP.md`'s two "must contain" blocks, the summary entries and skills-install line, and add the commit-the-lockfile sentence; replace the resources `curl` import with `project_import`; reword `app-integration.md`'s pin advice; preface `formio-form/references/setup.md`'s hash command; narrow `formio-form`'s first Security bullet to the deployed app in all three copies; correct CLAUDE.md's "byte-identically"
- [x] 8.10 Run `pnpm test`, `pnpm lint`, `pnpm format`; unwrap edited markdown with Prettier and read the diff

### Refactor

- [x] 8.11 Review implementation and refactor as needed
