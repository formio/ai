# live-tool-tests Specification

## Purpose

Defines the opt-in live test runner: `pnpm test:live` calls every registered MCP tool against a real Form.io project the repository folder resolves to, guarded by an explicit allowlist, with guaranteed clean-up.

## Requirements
### Requirement: An opt-in runner calls every tool against a real Form.io project

`pnpm test:live` SHALL build `@formio/mcp`, start its stdio server, and call every registered tool through an MCP client against a real Form.io project. It SHALL NOT run as part of `pnpm test` or CI by default. The project SHALL be the one the server resolves for the repository folder — a `project_set` mapping, a committed `formio.json`, or `FORMIO_PROJECT_URL` — read with `project_get`, and the runner SHALL refuse to start unless that Project URL equals `FORMIO_LIVE_TEST_PROJECT`. Authentication SHALL be the server's own: the cached portal-login token (a browser login on first use) or a project API key bound to that URL.

#### Scenario: An unlisted target is refused

- **WHEN** the folder resolves to `https://acme.form.io` and `FORMIO_LIVE_TEST_PROJECT` is unset or names another project
- **THEN** the runner exits before calling any tool that reaches the deployment, naming both URLs

#### Scenario: Not part of the default suite

- **WHEN** `pnpm test` runs
- **THEN** no live case runs

### Requirement: Every registered tool has a live case

The live suite SHALL hold at least one case per registered tool, exercising its documented behaviour and the refusals a caller is told to expect, and a check SHALL fail when `tools/list` names a tool with no case.

#### Scenario: A new tool without a case

- **WHEN** a tool is registered and the live suite has no case naming it
- **THEN** the coverage check fails naming the tool

### Requirement: The runner cleans up after itself

Every entity the run creates SHALL carry a per-run prefix, and clean-up SHALL run whether or not the cases pass: it deletes the run's forms, roles, and version tags through the Form.io API and restores the project's current version to what it was before the run.

#### Scenario: A failing case still cleans up

- **WHEN** a case fails after forms and a tag were created
- **THEN** the run's forms, roles, and tags are deleted and the project's version is restored before the runner exits

