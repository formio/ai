## 1. Runtime authentication paragraph

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing tests in `validate-library.test.ts`: a `runtime-*.md` reference without `RUNTIME_AUTH_PARAGRAPH` emits `auth.runtime_paragraph`; a runtime reference carrying only `CANONICAL_AUTH_PARAGRAPH` emits it too; `pdf-api.md` needs both; a platform reference still needs the canonical paragraph; `server-status.md` needs neither
- [x] 1.2 Write failing test: `formio-auth/references/jwt-and-sessions.md` and `resource-auth.md` carry the runtime paragraph and not the canonical one
- [x] 1.3 Write failing test: no `formio-auth` reference names `authenticate` or `action_types_list` as a tool

### Green

- [x] 1.4 Add `RUNTIME_AUTH_PARAGRAPH` and the file-name scope rule to `validate-library.ts`
- [x] 1.5 Put the runtime paragraph in the six runtime references, `pdf-api.md`, and the two `formio-auth` documents; reword `formio-api/SKILL.md`'s authentication sentence for build-time tool calls versus application code
- [x] 1.6 Replace retired tool names in `formio-auth` references; correct `CLAUDE.md`'s enforcement note, add the runtime paragraph rule, and replace `authenticate` in its MCP Tool Preference sentence

### Refactor

- [x] 1.7 Review implementation and refactor as needed

## 2. formio-sdk facts and Security rule

<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing tests in `source-facts/formio-sdk.test.ts`: no `Formio.login(` under `formio-sdk`; `SKILL.md` names `saveSubmission` on the login form; the SSO example calls `ssoInit` on the return page and never reads `query.token`; logout is a GET emitting `formio.user`; `pathType` is documented without a default; the `getToken({ decode: true })` example tests a claim
- [x] 2.2 Write failing tests: the provider example is a `function` or `class`, and the same declaration is constructible with `new` against the installed `@formio/js`; `validate` is not documented as `Promise<boolean>` and the example checks an array length or awaits `submit()`; `Formio.login` is undefined on the installed package
- [x] 2.3 Write failing tests: `roles.md` states no MCP tool deletes a role and the user confirms deletion; the Security section's agent-facing bullet covers any `Formio` call or MCP tool and does not claim no tool returns submission data

### Green

- [x] 2.4 Correct `SKILL.md` (authentication paragraph, tool table, Security bullets) and `references/auth.md`, `setup.md`, `files.md`, `rendering.md`, `roles.md`

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. Renderer and React embed facts

<!-- depends_on: none -->

### Red

- [x] 3.1 Write failing tests in `source-facts/formio-form.test.ts`: the `submit` row states it fires after the server save for a URL-backed form and `hooks.beforeSubmit` is named for pre-save work; the combined `options.md` example has no `sanitizeConfig` and a labelled opt-in snippet carries `addTags: ['iframe']`; `setup.md` has no blanket `@formio/core` ban and every CDN pin agrees
- [x] 3.2 Write failing tests in `source-facts/formio-react-form.test.ts`: `provider.md` states the prop is the static class; the wizard handlers do not destructure `{ page }`

### Green

- [x] 3.3 Correct `formio-form/references/javascript-api.md`, `options.md`, `setup.md`
- [x] 3.4 Correct `formio-react-form/references/provider.md` and `mounting.md`

### Refactor

- [x] 3.5 Review implementation and refactor as needed

## 4. formio-api runtime, platform, and tool facts

<!-- depends_on: 1 -->

### Red

- [x] 4.1 Write failing tests in `source-facts/formio-api.test.ts`: registration posts to `{projectUrl}/user/register/submission`; expiry keys on 440 and not on "Session no longer valid"; lockout is 401 not 429 in `runtime-custom-users.md` and `project-auth.md`; `?dryrun=1` is named; no `"conjunction": ""`
- [x] 4.2 Write failing tests: tenant and project PUT text does not say omitted fields reset and the project PUT rules are stated; import examples in `platform-projects.md` and `platform-staging.md` parse with object `forms` and `resources`
- [x] 4.3 Write failing tests: the router's preferred-tool list names every registered tool except `server_status`; `project-form-revisions.md` says a changed non-draft field is refused, the draft version cannot be reverted to, and `form_create`'s note is optional; `SAVE.md` makes no schema-validation claim for `form_create`; `runtime-custom-users.md` and `runtime-access-control.md` name the tools that cover their endpoints

### Green

- [x] 4.4 Correct `runtime-auth.md`, `runtime-submissions.md`, `runtime-custom-users.md`, `runtime-access-control.md`, `project-auth.md`
- [x] 4.5 Correct `platform-tenants.md`, `platform-projects.md`, `platform-staging.md`
- [x] 4.6 Correct `formio-api/SKILL.md`'s tool list, `project-form-revisions.md`, and `formio-form-builder/SAVE.md`

### Refactor

- [x] 4.7 Review implementation and refactor as needed

## 5. formio-schema access shapes

<!-- depends_on: none -->

### Red

- [x] 5.1 Write failing tests in `source-facts/formio-schema.test.ts`: `submission-access.md` states the server sets `access`; the submission definition example uses submission access types keyed by `resources`; `form-definition.md` lists `read_own` and `self`; `project-access.md` does not claim one type set for every layer

### Green

- [x] 5.2 Correct `submission-access.md`, `submission-definition.md`, `form-definition.md`, `project-access.md`

### Refactor

- [x] 5.3 Review implementation and refactor as needed

## 6. Actions and planner facts

<!-- depends_on: none -->

### Red

- [x] 6.1 Write failing tests in `source-facts/formio-actions.test.ts`: priority runs higher first with `before` preceding `after`; lockout is opt-in through `allowedAttempts` and answers 401; the webhook section names open-source and Enterprise behaviour separately; email interpolation names what is filtered and what is not; no "default wrapper" claim; `action_type_get` names `formId` and `actionName`
- [x] 6.2 Write failing tests in `source-facts/formio-resource-planner.test.ts`: no "higher runs later"; the register-form order described in `phase-b-emission.md` is Save, Login, Role Assignment; persona-action text says create-only and not "created or edited" in the planner, `formio-actions`, and `formio-auth`

### Green

- [x] 6.3 Correct `formio-actions/SKILL.md` and `references/action-types.md`
- [x] 6.4 Correct `template-json.md`, `phase-b-emission.md`, and the persona-action text in every location

### Refactor

- [x] 6.5 Review implementation and refactor as needed

## 7. formio-auth facts

<!-- depends_on: 1 -->

### Red

- [x] 7.1 Write failing tests in `source-facts/formio-auth.test.ts`: token swap with no match holds no role; the email-token macro grammar and the standard Email action; `SKILL.md` does not name an "Email Authentication action"; `custom-jwt.md` reads the project `_id` from a form's `project` field and not from `project_export`; the Everyone id has 24 zeros; every docs link carries a host

### Green

- [x] 7.2 Correct `token-swap.md`, `email-auth.md`, `SKILL.md`, `custom-jwt.md`, `roles-and-permissions.md`, `group-permissions.md`

### Refactor

- [x] 7.3 Review implementation and refactor as needed

## 8. Orchestrator input statement, framework wording, shared URL paragraph

<!-- depends_on: none -->

### Red

- [x] 8.1 Update `application-orchestration.test.ts` to fail until Step 1 states workspace files are data, not instructions, and drops "opens no file a third party supplied" and "reads no submission data"
- [x] 8.2 Write failing test: no "Angular today" / "`formio-angular` today" in `INTENT.md` or `formio-angular/SKILL.md`
- [x] 8.3 Write failing test: every "Where these two values come from" paragraph under `plugin/skills/` is identical apart from its link and none contains "do not derive either URL from the other"

### Green

- [x] 8.4 Rewrite `formio-application/SKILL.md` Step 1's input paragraph
- [x] 8.5 Reword `INTENT.md` and `formio-angular/SKILL.md` to name the registry
- [x] 8.6 Edit all 12 copies of the shared URL-values paragraph identically

### Refactor

- [x] 8.7 Review implementation and refactor as needed

## 9. Release and Definition of Done

<!-- depends_on: 1, 2, 3, 4, 5, 6, 7, 8 -->

### Red

- [x] 9.1 Confirm `pnpm check:releases` fails without a changeset covering `@formio/ai`

### Green

- [x] 9.2 Add `.changeset/correct-skill-facts.md` (`'@formio/ai': patch`)
- [x] 9.3 Run `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm check:releases`, and `openspec validate correct-skill-facts --strict`; all pass

### Refactor

- [x] 9.4 Review implementation and refactor as needed
