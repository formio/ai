## MODIFIED Requirements

### Requirement: Parent skill orchestration order

The parent `formio-angular` `SKILL.md` SHALL instruct Claude to execute the following phases in the following strict order, with a user-approval gate between each:

1. **SETUP** — obtain the Form.io `Project URL` and `Base URL` by calling the `project_get` tool with `cwd` set to the workspace root. On `ok` the reported values ARE the configuration: confirm them in one short acknowledgement and proceed without interviewing. Otherwise ask for the single value the report names, record it with `project_set`, and call again until it resolves. `formio-application` hands in no URLs — its handoff names the workspace directory — so SETUP is always where the values come from. After BOOTSTRAP creates the workspace, the skill SHALL call `project_get` for it again; when that no longer resolves — a new `.git` ends the server's lookup above an ancestor's mapping — it SHALL record the Project URL SETUP resolved with `project_set` for the workspace root before CONFIG.
2. **CONFIG** — generate `src/app/config.ts` exporting `AppConfig: FormioAppConfig` with `appUrl` = the project URL and `apiUrl` = the base URL **as reported by `project_get`**, and wire it into `AppModule` via `{ provide: FormioAppConfig, useValue: AppConfig }`. Match the pattern at `https://github.com/formio/angular-demo/blob/master/src/app/config.ts` and `https://github.com/formio/angular-demo/blob/master/src/app/app-module.ts`.
3. **AUTH** — generate `src/app/auth/auth.module.ts` configuring `FormioAuthConfig` from the `template.json` auth resources and roles. Import `AuthModule` into `AppModule`.
4. **Resources** — delegate to the `formio-angular-resources` sub-skill with the accumulated context.

SETUP SHALL NOT carry its own URL interview wording. It SHALL NOT enumerate the valid URL shapes, restate plain-language URL descriptions, apply its own URL validation, derive a base URL itself, or reproduce a `project get` exit-code table — the server's message says what is missing and how to fix it, and SETUP relays it.

The skill SHALL NOT run an Inference phase (planner handoff). Planner invocation is `formio-application`'s responsibility. When `formio-angular` is invoked directly by a user (framework-explicit trigger), the skill SHALL expect an already-approved `template.json` and a workspace ready for file generation; if neither exists, it SHALL hand the request to `formio-application` with Angular named as the framework — after telling the user in one line that planning comes first — rather than running the planner itself or asking the user to re-invoke anything.

The skill SHALL NOT run an Import phase. Template import into a Form.io project is `formio-application`'s responsibility.

#### Scenario: Parent accepts handoff from formio-application

- **WHEN** `formio-application` invokes `formio-angular` after completing its Deployment and Import steps
- **THEN** `formio-angular` SHALL NOT run a URL interview
- **AND** it SHALL resolve the configuration by calling `project_get` for the workspace
- **AND** it SHALL proceed to CONFIG using the values that command reported

#### Scenario: SETUP completes a half-configured mapping without interviewing for both URLs

- **WHEN** SETUP calls `project_get` and the report is `base-url-unresolved`
- **THEN** SETUP asks only for the base URL
- **AND** it records it with `project_set` passing `baseUrl`
- **AND** it calls `project_get` again before generating `config.ts`

#### Scenario: CONFIG writes the URLs the server reported

- **WHEN** CONFIG generates `src/app/config.ts`
- **THEN** `appUrl` is the project URL reported by `project_get` and `apiUrl` is the base URL it reported
- **AND** neither value is composed, derived, or defaulted by the skill

#### Scenario: SETUP carries no URL wording of its own

- **WHEN** `plugin/skills/formio-angular/SETUP.md` is read
- **THEN** it does not enumerate the valid URL shapes
- **AND** it contains no exit-code table, no URL validation rules, and no Base-URL derivation
- **AND** it does not reference another skill's document as the owner of that wording

#### Scenario: Parent rejects invocation without upstream plan

- **WHEN** a user invokes `formio-angular` directly with no approved `template.json` in scope
- **THEN** the skill hands the request to `formio-application` with Angular as the framework
- **AND** it does not run the planner itself

#### Scenario: Scaffolding keeps the workspace on its project

- **WHEN** the project resolved from a mapping on the workspace's parent directory and BOOTSTRAP's scaffold created `.git` in the workspace
- **THEN** the next `project_get` for the workspace is checked before CONFIG
- **AND** if it no longer resolves, the skill records the Project URL SETUP resolved with `project_set` for the workspace root

#### Scenario: Parent enforces phase order for file generation

- **WHEN** `formio-angular` runs its SETUP → CONFIG → AUTH → Resources sequence
- **THEN** each phase ends with an approval gate before files are written
- **AND** a declined gate stops the flow without writing partial state

## ADDED Requirements

### Requirement: formio-angular-resources asks no URL question and creates no workspace

`formio-angular-resources` SHALL NOT ask for a Project URL or Base URL in any question round; it resolves them with `project_get`. Its first round SHALL ask only for the workspace root (and the design language), and when that root holds no Angular workspace it SHALL stop and route to `formio-angular`, which creates workspaces. An existing Angular workspace whose `AppModule` is not yet wired with `FormioAppConfig` SHALL be extended and wired here, as before. It SHALL carry no new-workspace mode, and its plan template and worked example SHALL describe extending an existing workspace only.

#### Scenario: No URL in the batched round

- **WHEN** `formio-angular-resources` round 1 is read
- **THEN** it asks for the workspace root and no URL

#### Scenario: No Angular workspace routes to formio-angular

- **WHEN** the given root holds no `angular.json`
- **THEN** the sub-skill stops and routes to `formio-angular`
- **AND** it does not print an `ng new` command

#### Scenario: An unwired workspace is wired, not refused

- **WHEN** the given root holds an Angular workspace with no `FormioAppConfig`
- **THEN** the plan marks `AppModule` as MODIFY and wires it

