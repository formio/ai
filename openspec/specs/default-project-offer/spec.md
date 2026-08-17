# default-project-offer Specification

## Purpose
Defines the difference between offering a project and pinning one: `FORMIO_DEFAULT_PROJECT_URL` names a suggestion the agent must confirm and persist, `FORMIO_PROJECT_URL` pins the server and cannot be redirected, and an install-time prompt must never turn the former into the latter.
## Requirements
### Requirement: A configured project may be offered without being applied

The server SHALL read `FORMIO_DEFAULT_PROJECT_URL` and treat it as a **suggestion**. It SHALL NOT participate in project resolution: the precedence order stays `FORMIO_PROJECT_URL` from the environment, then the working-directory mapping, then an error. A tool call SHALL resolve identically whether or not the variable is set.

Where the server already tells an agent how to configure a project, it SHALL name the suggested value when one is configured — in the resolution error raised when no project resolves, and in the `instructions` declared at initialize. Both SHALL instruct the agent to confirm the value with the user and persist it with `project_set`, rather than assuming it.

#### Scenario: The offer does not change resolution

- **WHEN** `FORMIO_DEFAULT_PROJECT_URL` is set and a working directory has no mapping
- **THEN** a project-scoped tool call still fails to resolve
- **AND** the failure is the same actionable error as when the variable is unset

#### Scenario: The offer appears in the error

- **WHEN** `FORMIO_DEFAULT_PROJECT_URL` is set and no project resolves for the caller's working directory
- **THEN** the error names that URL as the suggested project
- **AND** it instructs confirming it with the user and persisting it with `project_set`

#### Scenario: No offer, no mention

- **WHEN** `FORMIO_DEFAULT_PROJECT_URL` is unset
- **THEN** the resolution error names no suggested project
- **AND** it still names `project_set` and the base URL as before

#### Scenario: A pinned project is unaffected

- **WHEN** `FORMIO_PROJECT_URL` is set in the environment
- **THEN** tools resolve to it regardless of `FORMIO_DEFAULT_PROJECT_URL`
- **AND** no suggestion is offered, because a project is already resolved

### Requirement: The pinning and offering variables are distinguished in writing

`FORMIO_PROJECT_URL` and `FORMIO_DEFAULT_PROJECT_URL` have opposite effects and SHALL be documented as such wherever either appears. The pinning variable takes precedence over every working-directory mapping, so `project_set` cannot redirect a server launched with it. The offering variable changes nothing until an agent acts on it.

Conflating the two is what allowed an install-time prompt to silently defeat `project_set`, so any surface that collects a project URL at install or configuration time SHALL state which of the two it sets.

`FORMIO_BASE_URL` SHALL NOT gain an offering counterpart: it is already a fallback rather than a pin, since a directory's mapping supplies its own base URL and takes precedence over the environment value.

#### Scenario: Environment tables distinguish them

- **WHEN** an environment-variable table documenting either variable is read
- **THEN** it states that `FORMIO_PROJECT_URL` pins the server and cannot be overridden by `project_set`
- **AND** it states that `FORMIO_DEFAULT_PROJECT_URL` is only offered and can be overridden per directory

#### Scenario: The project_set description names the distinction

- **WHEN** the `project_set` tool description is read
- **THEN** it names `FORMIO_PROJECT_URL` as the value that takes precedence over any mapping it writes
- **AND** it does not claim the same of `FORMIO_DEFAULT_PROJECT_URL`

### Requirement: An install-time project prompt never pins the server

A client manifest that collects a project URL at install time SHALL feed it to `FORMIO_DEFAULT_PROJECT_URL`, not to `FORMIO_PROJECT_URL`. An answer given once at install must not silently override a per-directory mapping the user sets later, because the two are configured in different places at different times and the user has no way to see the conflict.

A manifest that deliberately pins — a single-project deployment, CI — MAY set `FORMIO_PROJECT_URL`, and its prompt SHALL say that `project_set` will not redirect it.

#### Scenario: The Cursor manifest offers rather than pins

- **WHEN** `plugin/.cursor-plugin/plugin.json` is parsed
- **THEN** its `mcpServers.formio-mcp.env` maps the install-time project variable to `FORMIO_DEFAULT_PROJECT_URL`
- **AND** it does not map any install-time variable to `FORMIO_PROJECT_URL`

#### Scenario: The prompt describes what it does

- **WHEN** the Cursor manifest's project variable description is read
- **THEN** it says the value is a default that `project_set` can override per directory
- **AND** it does not promise behaviour the wiring contradicts

#### Scenario: Leaving the prompt blank stays safe

- **WHEN** the install-time project variable is left blank
- **THEN** the server resolves from the working-directory mapping as though the variable were unset

