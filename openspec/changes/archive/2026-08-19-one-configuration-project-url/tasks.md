## 1. Code — remove the offering variable
<!-- depends_on: none -->

### Red

- [x] 1.1 Rewrite `packages/mcp-server/src/__tests__/default-project-offer.test.ts` into its inverse: with `FORMIO_DEFAULT_PROJECT_URL` set, `getConfig()` exposes no `defaultProjectUrl`, resolution is unchanged, and neither the resolution error nor the server instructions mention it
- [x] 1.2 Write a failing test asserting the unset-project error names no suggested project even when that variable is set
- [x] 1.3 Update `config.test.ts` where it asserts the variable is read
- [x] 1.4 Update `project-command.test.ts` where `project get`'s output offers a suggested project
- [x] 1.5 Write a failing test asserting `server.json`'s registry environment list does not name the variable

### Green

- [x] 1.6 Remove the read from `config.ts` and the `defaultProjectUrl` field from `FormioConfig`
- [x] 1.7 Remove the `suggested` parameter and offer clause from `missingProjectError` in `project-resolver.ts`
- [x] 1.8 Remove the offer from `cli/project-command.ts` (both the `notConfigured` message and the `defaultProjectUrl` read)
- [x] 1.9 Remove the sentence naming it from `SERVER_INSTRUCTIONS`
- [x] 1.10 Remove it from `server.json`'s `environmentVariables`
- [x] 1.11 Delete `default-project-offer.test.ts` if nothing in it survives as an inverse assertion; otherwise rename it to say what it now guards

### Refactor

- [x] 1.12 Review and refactor as needed

## 2. Code — one base-URL model: derived, or asked
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write a failing test: a `form.io`-hosted project with no supplied base URL reports `sources.baseUrl === 'derived'`, with the value still `https://api.form.io`
- [x] 2.2 Write a failing test asserting `BaseUrlSource` admits no `'default'` member — grep the union, so the string cannot come back
- [x] 2.3 Write a failing test: `project get` describes the hosted-cloud base URL as derived from the project URL, not as a default
- [x] 2.4 Write a failing test: the unset-project error describes what a Project URL is with an example per deployment kind, and does NOT ask for a base URL or recite all three shapes
- [x] 2.5 Write a failing test: the base-URL error still explains that a path-less project URL on a customer domain names its deployment nowhere
- [x] 2.6 Write a failing test: `project_set`'s description says to pass `baseUrl` when the server reports it cannot be determined, and does not instruct passing it by deployment kind

### Green

- [x] 2.7 Replace `'default'` with `'derived'` in `BaseUrlSource` and at the hosted-cloud branch in `chooseBaseUrl`
- [x] 2.8 Update the `describe()` source wording in `cli/project-command.ts`
- [x] 2.9 Split `URL_SHAPES_GUIDANCE`: a project-URL description with per-deployment examples for the unset-project error and the instructions, and the sub-domain explanation for the base-URL error only
- [x] 2.10 Rewrite the `baseUrl` clauses of the `project_set` tool description

### Refactor

- [x] 2.11 Review and refactor as needed

## 3. Code — the desktop bundle
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Rewrite the `mcpb-build.test.ts` assertions so the bundle's project user-config maps to `FORMIO_PROJECT_URL` and references no offering variable
- [x] 3.2 Update `plugin-manifests.test.ts`'s desktop-bundle scenario to the same contract, keeping its `formio_base_url` assertion

### Green

- [x] 3.3 Re-point `scripts/build-mcpb.ts`: rename the user-config field, map it to `FORMIO_PROJECT_URL`, and rewrite its description to say a later `project_set` or committed `formio.json` overrides it

### Refactor

- [x] 3.4 Review and refactor as needed

## 4. Docs and skills — the Project URL is the configuration
<!-- depends_on: 2 -->

### Red

- [x] 4.1 Write a failing sweep asserting no skill document presents the Base URL as a value the user routinely supplies — no two-value configuration tables, no "ask for both URLs"
- [x] 4.2 Write a failing sweep asserting no skill document or README names `FORMIO_DEFAULT_PROJECT_URL`
- [x] 4.3 Write the companion assertion that protects the exclusion: the eight `formio-api` platform references still carry their `${FORMIO_BASE_URL}` endpoint roots, and the count has not dropped
- [x] 4.4 Write a failing assertion that the shared preflight clause presents the Project URL as the configuration and the Base URL as derived-or-asked

### Green

- [x] 4.5 Rewrite the shared preflight clause across the ten tool-calling skills, worded identically
- [x] 4.6 Rewrite `formio-angular/SETUP.md`'s two-value table and the `appUrl`/`apiUrl` alias note so the derived-or-asked story is explicit
- [x] 4.7 Update `formio-mcp-setup/SKILL.md`'s project step to ask for the Project URL and treat the base URL as the rare second round
- [x] 4.8 Update the environment tables in `README.md`, `plugin/README.md`, and `packages/mcp-server/README.md`, removing the offering variable's row
- [x] 4.9 Leave every `${FORMIO_BASE_URL}` endpoint root untouched

### Refactor

- [x] 4.10 Review and refactor as needed

## 5. Docs and skills — one spelling per job
<!-- depends_on: 4 -->

### Red

- [x] 5.1 Enforce the target shape in the skill-tests content sweeps FIRST, so the rename lands against a test that knows it: reject `${FORMIO_PROJECT_URL}` / `${FORMIO_BASE_URL}` as endpoint roots, require `{projectUrl}` / `{baseUrl}`, and keep rejecting unresolved Postman `{{…}}` placeholders. NOTE: the `api-skills-validation` spec describes a `skills-validator` module that no longer ships — its source was removed by `prune-shipped-surface`, leaving only an untracked `dist/` artifact — so the enforcement lives in the sweeps rather than in that validator. Pre-existing spec drift, recorded here, not fixed by this change
- [x] 5.2 Write a failing assertion that no `FORMIO_*` name is used as an endpoint root anywhere under `plugin/skills`
- [x] 5.3 Write a failing assertion that no `FORMIO_*` name is used to name a value passed between phases — the "stash under the variable names" and handoff-payload cases
- [x] 5.4 Write a failing assertion that `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` still appear where the subject IS the environment: the `env`-block warning in `formio-mcp-setup`, and the environment tables
- [x] 5.5 Write the count assertion that distinguishes a rename from a deletion: the eight `formio-api` platform references carry the same number of endpoint roots after the change as before, in the new spelling

### Green

- [x] 5.6 Script the substitution across `plugin/skills/**/*.md` — 171 project-URL slots and 68 base-URL slots — rather than hand-editing, then read the diff for malformed roots
- [x] 5.7 Rewrite the ~35 phase-passing mentions in prose: "the Project URL" / "the Base URL", and payload fields named `projectUrl` / `baseUrl`
- [x] 5.8 Leave every environment-subject mention verbatim
- [x] 5.9 Grep beyond `plugin/skills` — `packages/skill-tests` fixtures, eval harness inputs, `llms-install.md` — for the old root spelling

### Refactor

- [x] 5.10 Review and refactor as needed

## 6. Specs, changeset, and repo checks
<!-- depends_on: 1, 2, 3, 4, 5 -->

### Green

- [x] 6.1 Apply the five delta specs, and DELETE `openspec/specs/default-project-offer/` — the capability is removed, not modified
- [x] 6.2 Check no surviving spec references the removed capability, the removed variable, or the `${FORMIO_*}` endpoint-root form
- [x] 6.3 Write a changeset: `FORMIO_DEFAULT_PROJECT_URL` removed and why it is now vestigial, the desktop bundle re-pointed, the `default` → `derived` source rename called out as a reported-string change, and the endpoint-root rename noted for anyone consuming the reference docs
- [x] 6.4 Run `pnpm test`, `pnpm lint`, `pnpm format`; prose-wrap only the skill markdown this change edits

### Refactor

- [x] 6.5 Review and refactor as needed
