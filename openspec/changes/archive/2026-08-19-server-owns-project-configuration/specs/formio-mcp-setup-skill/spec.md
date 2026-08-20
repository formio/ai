## MODIFIED Requirements

### Requirement: Every skill checks for the MCP server before its first tool call

Every `SKILL.md` in the library SHALL carry a preflight section in its **body** — not its frontmatter description, which is bound by the 1,024-character budget — instructing the agent to verify that the Form.io MCP tools are available before making its first Form.io tool call.

The preflight SHALL: name representative tools to look for (`form_list`, `form_create`, `project_import`, `project_set`); direct the agent to the `formio-mcp-setup` skill when they are absent; carry a fallback message for the case where that skill is not installed; and forbid working around missing tools with raw HTTP calls against a Form.io deployment.

The raw-HTTP prohibition is the load-bearing part. `formio-api` documents the entire REST surface, so an agent with no tools and no prohibition will hand-roll requests against a live deployment — a worse outcome than stopping.

There are twelve `SKILL.md` files under `plugin/skills/`, because the nested `formio-angular/formio-angular-resources/SKILL.md` is one of them and the recursive walk in the conformance suite includes it. Eleven carry the preflight; `formio-mcp-setup/SKILL.md` is the handoff target and is exempt.

Every skill that calls Form.io tools SHALL carry a **second** probe, run after the tools are confirmed present and before the first call that reads from or writes to a deployment: run `npx -y @formio/mcp@<pinned> project get --cwd <the user's working directory>`. On success the agent SHALL treat the printed URLs as the configuration and SHALL NOT ask the user to confirm or re-supply them. On a non-zero exit the agent SHALL:

1. Relay the message's own instruction to the user, asking for the one value it names — the project URL, or the base URL for the project URL it echoes.
2. Persist that value by running the `project set` command the message names.
3. Retry `project get`, and repeat if it names the second value.

The preflight SHALL carry exactly three things about the URLs themselves, and no more — this is the whole of what the skills library states about them, since no skill document owns the topic any longer:

1. A one-sentence definition of each: the Project URL is the full URL of the Form.io project the app reads and writes; the Base URL is the deployment hosting it. This exists so an agent can name what it is asking for without first provoking an error.
2. The two commands — `project get` to read, `project set` to write.
3. The prohibition on editing `~/.formio/projects.json` by any means other than those commands or the equivalent MCP tool.

The preflight SHALL NOT restate anything else. It SHALL NOT contain the three-valid-shapes enumeration, plain-language URL descriptions beyond the one-sentence definitions above, example URL values, URL validation rules, a Base-URL derivation table, or a `project get` exit-code table; those live in the server's instructions and error messages, which the agent relays verbatim. The preflight SHALL forbid guessing a base URL and reusing one from another project or an earlier session.

The probe is proactive so the common path does not need a failed tool call to discover a missing configuration. It is not the enforcement, though: the server raises the same messages when something calls a tool without probing, which is what makes an agent with no skills installed behave correctly too.

A skill whose request touches no deployment — an API-reference lookup, a schema question, an SDK question — is NOT required to run the probe before answering. The probe binds deployment-touching calls, so reference use stays free of a configuration round-trip.

`formio-resource-planner` SHALL be exempt from the probe entirely while keeping the tool-availability and raw-HTTP preflight. It calls no MCP tool by design — it writes `template.md` and `template.json` with local filesystem writes and states that stance explicitly — so a probe there checks a precondition it never uses. It is also invoked mid-flow by `formio-application`, whose own preflight has already resolved the configuration, so a probe would be a duplicate prompt in the library's most common path.

The probe requirement binds the **build-time** project mapping only. It SHALL NOT be read as governing the runtime URL configuration of a generated application: `Formio.setBaseUrl` / `Formio.setProjectUrl` calls in `formio-sdk`, `formio-form`, `formio-auth`'s Token Swap reference, and `formio-angular`'s `FormioAppConfig` documentation configure the app the user is building, not this session's mapping, and they legitimately show example URL values. This is the same build-time-versus-runtime boundary the existing conformance suite already guards.

#### Scenario: Every skill carries the preflight

- **WHEN** every `SKILL.md` under `plugin/skills/` is inspected
- **THEN** each body contains a preflight section naming `project_set` and the `formio-mcp-setup` skill

#### Scenario: Preflight forbids the HTTP workaround

- **WHEN** any skill's preflight section is inspected
- **THEN** it instructs the agent not to fall back to direct HTTP requests against a Form.io deployment when the MCP tools are missing

#### Scenario: Every tool-calling skill probes with project get

- **WHEN** every `SKILL.md` under `plugin/skills/` except `formio-mcp-setup/SKILL.md` is inspected
- **THEN** each preflight instructs running `project get` with the user's working directory before the first deployment-touching call
- **AND** each instructs relaying the command's own error and running the `project set` command that error names
- **AND** each forbids guessing a base URL, reusing another project's, or editing `~/.formio/projects.json`

#### Scenario: No skill restates the build-time URL guidance the server owns

- **WHEN** every `SKILL.md` and sibling document under `plugin/skills/` is searched for build-time project-configuration guidance
- **THEN** none enumerates the three valid URL shapes as guidance for configuring this session's project
- **AND** none contains a Base-URL derivation table or a `project get` exit-code table
- **AND** none contains URL validation rules such as scheme checks, trailing-slash stripping, or a project-equals-base sanity check

#### Scenario: Runtime SDK URL documentation survives the sweep

- **WHEN** the same search runs over `formio-sdk`, `formio-form/references/setup.md`, `formio-auth/references/token-swap.md`, and `formio-angular`'s `CONFIG.md` / `AUTH.md` / `formio-angular-resources/references/app-integration.md`
- **THEN** their `Formio.setBaseUrl` and `Formio.setProjectUrl` documentation is unchanged, example URL values included
- **AND** no assertion treats a runtime SDK configuration example as build-time project guidance

#### Scenario: The planner keeps the tools preflight without the probe

- **WHEN** `plugin/skills/formio-resource-planner/SKILL.md` is inspected
- **THEN** it carries the tool-availability check and the raw-HTTP prohibition
- **AND** it does not instruct running `project get`

#### Scenario: Reference-only work needs no project

- **WHEN** a skill's request is answered entirely from its reference documents, with no deployment call
- **THEN** the preflight does not require running the probe or configuring a project

#### Scenario: Descriptions are untouched

- **WHEN** the frontmatter descriptions are measured after the preflight sections are added
- **THEN** every description is unchanged and still within the 1,024-character budget

#### Scenario: The setup skill exempts itself

- **WHEN** `plugin/skills/formio-mcp-setup/SKILL.md` is inspected
- **THEN** it does not direct the agent to load `formio-mcp-setup`, because it is that skill

### Requirement: The project-configuration step is skippable and never blocks setup

After writing the client configuration, `formio-mcp-setup` SHALL run `project get` for the user's working directory and SHALL interview only when that command fails. On success it SHALL report the resolved URLs in one line and proceed. On failure it SHALL ask for the one value the message names, persist it with the `project set` command the message names, and re-run the command until it resolves or the user declines.

The step SHALL NOT restate the URL guidance the server owns — the shapes, the plain-language descriptions, the example values — and SHALL NOT reference another skill's document for that wording, because no such document exists any more. It relays what the command says.

The configuration step SHALL remain optional. `formio-mcp-setup` fires from every Form.io skill's preflight, including requests that need no project at all — an API-reference question, a schema question — and from users who have not created a project yet. The step SHALL therefore state plainly that it can be skipped, and skipping SHALL NOT block the client configuration, the reload instruction, or the handoff back to the calling skill.

When the step is skipped, the skill SHALL say that the first Form.io tool call will raise the same actionable message, and SHALL name `project_set` as what will handle it. It SHALL NOT imply the setup failed.

#### Scenario: Setup probes before interviewing

- **WHEN** `formio-mcp-setup` reaches its project step
- **THEN** it runs `project get` with the user's working directory first
- **AND** it interviews only if that command exits non-zero

#### Scenario: User has no project yet

- **WHEN** the user cannot supply a Project URL
- **THEN** the step is skipped without an error
- **AND** the client configuration and the reload instruction are still delivered
- **AND** the skill names `project_set` as what will capture the project on the first tool call

#### Scenario: Request needs no project

- **WHEN** setup was reached from a preflight for a request that needs no project, such as an API-reference lookup
- **THEN** the skill presents the configuration step as optional rather than required

#### Scenario: A mapping already exists

- **WHEN** `project get --cwd <path>` already resolves a project for the working directory
- **THEN** the skill reports the resolved project and base URL in one line
- **AND** it does not interview

#### Scenario: A half-configured mapping is completed rather than re-interviewed

- **WHEN** `project get` reports a resolved project URL and an unresolved base URL
- **THEN** the skill asks only for the base URL
- **AND** it persists it with the `project set --base-url` command the message names
- **AND** it does not ask for the project URL again

#### Scenario: The step does not restate the server's URL guidance

- **WHEN** `plugin/skills/formio-mcp-setup/SKILL.md` is inspected
- **THEN** it does not enumerate the three valid URL shapes
- **AND** it does not point at another skill's document as the owner of that wording
- **AND** it contains no link to a `DEPLOYMENT.md`

#### Scenario: The preflight defines the URLs without cataloguing them

- **WHEN** any tool-calling skill's preflight is inspected
- **THEN** it defines the Project URL and the Base URL in one sentence each
- **AND** it names `project get` and `project set`
- **AND** it contains no shape enumeration, example URL values, or validation rules
