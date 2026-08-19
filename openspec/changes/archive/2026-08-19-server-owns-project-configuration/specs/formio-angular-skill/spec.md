## MODIFIED Requirements

### Requirement: Parent skill orchestration order

The parent `formio-angular` `SKILL.md` SHALL instruct Claude to execute the following phases in the following strict order, with a user-approval gate between each:

1. **SETUP** — obtain the Form.io `Project URL` and `Base URL` by running `npx -y @formio/mcp@<pinned> project get --cwd <the workspace directory>`. On success the printed values ARE the configuration: confirm them in one short acknowledgement and proceed without interviewing. On failure, ask for the single value the message names, persist it with the `project set` command the message names, and re-run until it resolves. When `formio-application` handed these values in, the skill SHALL still confirm them against `project get` rather than trusting the handoff, because the mapping is what `@formio/angular` and every later tool call resolve against.
2. **CONFIG** — generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = the project URL and `apiUrl` = the base URL **as reported by `project get`**, and wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }`. Match the pattern at `https://github.com/formio/angular-demo/blob/master/src/app/config.ts` and `https://github.com/formio/angular-demo/blob/master/src/app/app-module.ts`.
3. **AUTH** — generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources and roles. Import `AuthModule` into `AppModule`.
4. **Resources** — delegate to the `formio-angular-resources` sub-skill with the accumulated context.

SETUP SHALL NOT carry its own URL interview wording. It SHALL NOT enumerate the valid URL shapes, restate plain-language URL descriptions, apply its own URL validation, derive a base URL itself, or reproduce a `project get` exit-code table — the server's message says what is missing and how to fix it, and SETUP relays it.

The skill SHALL NOT run an Inference phase (planner handoff). Planner invocation is `formio-application`'s responsibility. When `formio-angular` is invoked directly by a user (framework-explicit trigger), the skill SHALL expect an already-approved `template.json` and a workspace ready for file generation; if neither exists, it SHALL ask the user to invoke `formio-application` first rather than running the planner itself.

The skill SHALL NOT run an Import phase. Template import into a Form.io project is `formio-application`'s responsibility.

#### Scenario: Parent accepts handoff from formio-application

- **WHEN** `formio-application` invokes `formio-angular` after completing its Deployment and Import steps
- **THEN** `formio-angular` SHALL NOT run a URL interview
- **AND** it SHALL confirm the configuration by running `project get` for the workspace
- **AND** it SHALL proceed to CONFIG using the values that command reported

#### Scenario: SETUP completes a half-configured mapping without interviewing for both URLs

- **WHEN** SETUP runs `project get` and the command reports a resolved project URL with an unresolved base URL
- **THEN** SETUP asks only for the base URL
- **AND** it persists it with the `project set --base-url` command the message named
- **AND** it re-runs `project get` before generating `config.ts`

#### Scenario: CONFIG writes the URLs the server reported

- **WHEN** CONFIG generates `src/app/config.ts`
- **THEN** `appUrl` is the project URL reported by `project get` and `apiUrl` is the base URL it reported
- **AND** neither value is composed, derived, or defaulted by the skill

#### Scenario: SETUP carries no URL wording of its own

- **WHEN** `plugin/skills/formio-angular/SETUP.md` is read
- **THEN** it does not enumerate the valid URL shapes
- **AND** it contains no `project get` exit-code table, no URL validation rules, and no Base-URL derivation
- **AND** it does not reference another skill's document as the owner of that wording

#### Scenario: Parent rejects invocation without upstream plan

- **WHEN** a user invokes `formio-angular` directly with no approved `template.json` in scope
- **THEN** the skill asks the user to invoke `formio-application` first
- **AND** it does not run the planner itself

#### Scenario: Parent enforces phase order for file generation

- **WHEN** `formio-angular` runs its SETUP → CONFIG → AUTH → Resources sequence
- **THEN** each phase ends with an approval gate before files are written
- **AND** a declined gate stops the flow without writing partial state

### Requirement: Parent skill detects existing configuration

The parent `formio-angular` skill SHALL inspect the target workspace before each phase and skip phases whose outputs already exist and are correctly wired:

- If `src/app/config.ts` already exports a `FormioAppConfig` whose `appUrl` and `apiUrl` match the URLs `project get` reported in SETUP, skip the CONFIG phase.
- If `AppModule` already imports an `AuthModule` that configures `FormioAuthConfig`, skip the AUTH phase (but still offer to regenerate if the user asks).
- If neither condition holds, run the phase as normal.

A `config.ts` that exists but whose URLs DISAGREE with what `project get` reported SHALL NOT be treated as a skip. The workspace's committed configuration and the server's mapping are two different records of the same fact, and a silent skip leaves the app pointed at one deployment while every build-time tool call resolves another. The skill SHALL surface the mismatch — naming both pairs and which came from where — and ask the user which one is correct before writing or skipping.

When a phase is skipped, Claude MUST tell the user which phase was skipped and why (which existing file or import triggered the skip), so the user can override if needed.

#### Scenario: Existing config is detected and CONFIG phase is skipped

- **WHEN** the parent skill activates on a workspace whose `src/app/config.ts` already exports a `FormioAppConfig` with `appUrl: 'https://example.form.io'` and `apiUrl: 'https://api.form.io'`
- **AND** `project get` reports those same URLs
- **THEN** Claude notifies the user that CONFIG is being skipped because `src/app/config.ts` already matches
- **AND** Claude proceeds directly to the AUTH phase

#### Scenario: A config that disagrees with the mapping is surfaced, not skipped

- **WHEN** `src/app/config.ts` exports `appUrl: 'https://old.form.io'` and `project get` reports a project URL of `https://new.form.io`
- **THEN** Claude reports both pairs and which record each came from
- **AND** it asks the user which is correct before writing `config.ts` or skipping CONFIG
- **AND** it does not silently skip the phase
