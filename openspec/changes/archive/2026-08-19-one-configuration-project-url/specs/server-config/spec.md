## MODIFIED Requirements

### Requirement: Server reads Form.io configuration from environment variables

The server SHALL read `FORMIO_BASE_URL` (optional), `FORMIO_PROJECT_URL` (optional), `FORMIO_API_KEY` (optional), `FORMIO_LOGIN_FORM` (optional), `FORMIO_AUTH_HOST` (optional), `FORMIO_AUTH_PORT` (optional), `FORMIO_AUTH_TIMEOUT` (optional, in seconds), `FORMIO_INSECURE_TLS` (optional), and `FORMIO_FORCE_BROWSER` (optional) from `process.env` and return them as a typed configuration object. The config SHALL include a mutable `jwt` field (initially `undefined`) that is set at runtime after login. Trailing slashes SHALL be stripped from both URLs.

It SHALL NOT read `FORMIO_DEFAULT_PROJECT_URL`, and the configuration object SHALL carry no `defaultProjectUrl` field. There is one project variable. Offering a project separately from setting one existed only because a set project could not be overridden; now that the environment is the weakest source, `FORMIO_PROJECT_URL` suggests without pinning, and a suggestion an agent might act on instead of asking is a liability rather than a convenience.

`baseUrl` SHALL be left undefined when the environment supplies nothing usable rather than defaulted here; resolution decides it last, from the shape of the resolved project URL.

#### Scenario: The offering variable is not read

- **WHEN** `FORMIO_DEFAULT_PROJECT_URL` is set in the environment
- **THEN** `getConfig()` returns a configuration with no `defaultProjectUrl`
- **AND** resolution behaves identically to when the variable is unset

#### Scenario: The defaults do not vary by host

- **WHEN** `FORMIO_PLUGIN_CONTEXT` is set to any value
- **THEN** the returned configuration is identical to when it is unset

### Requirement: A stand-alone server asks for both URLs before it needs them

The server SHALL be usable with no skills installed, so every piece of guidance an agent needs to configure a project SHALL come from the server itself. It SHALL declare MCP server `instructions` describing the **Project URL as the single configuration**: how to find what a directory resolves to, how to record a project, and that the Base URL is derived from the project URL wherever it can be and asked for only when it cannot. The instructions SHALL NOT name a client, skill, or plugin, and SHALL NOT name `FORMIO_DEFAULT_PROJECT_URL`.

The server's configuration **errors** SHALL be self-sufficient, because the skills library no longer restates this guidance and an agent may reach an error without having read the instructions. Each SHALL name the exact remedy command. They SHALL be split by where the guidance is actionable:

1. **No project URL resolves.** The error SHALL state that the project URL is not set and SHALL name `project set --project-url <project_url> --cwd <cwd>` in its runnable form alongside the `project_set` tool. It SHALL describe what a Project URL is and give an example per deployment kind. It SHALL NOT recite the full three-shape base-URL guidance: the base URL is derived from whatever project URL the user gives, so guidance about it cannot be acted on before that answer exists.
2. **A project URL resolves but the base URL cannot be determined.** The error SHALL state that the base URL cannot be determined **for that project URL**, SHALL echo the project URL, SHALL name `project set --base-url <base_url> --cwd <cwd>`, and SHALL explain that a path-less project URL on a customer domain names its deployment nowhere — the deployment is a sibling sub-domain. This is the only message where that explanation changes what the reader does, so it is the only message that carries it.

These SHALL be reported one at a time and in that order.

#### Scenario: Instructions present one configuration

- **WHEN** any MCP client reads the server's declared instructions
- **THEN** they describe the Project URL as the value to supply
- **AND** they state that the Base URL is derived from it wherever it can be
- **AND** they name no client, skill, or plugin

#### Scenario: Instructions do not mention an offering variable

- **WHEN** the server's declared instructions are searched
- **THEN** `FORMIO_DEFAULT_PROJECT_URL` does not appear

#### Scenario: The unset-project error asks for the project alone

- **WHEN** a project-scoped tool or `project get` fails because no project URL resolves
- **THEN** the message contains a runnable `project set --project-url` command including the `--cwd` that was searched
- **AND** it describes what a Project URL is with an example per deployment kind
- **AND** it does not ask for the base URL
- **AND** it does not name a suggested project

#### Scenario: The base-URL error carries the sub-domain explanation

- **WHEN** a project URL resolves, the base URL is unresolved, and something reads it
- **THEN** the message contains a runnable `project set --base-url` command
- **AND** it echoes the resolved project URL
- **AND** it explains that a path-less project URL on a customer domain names its deployment nowhere
- **AND** it does not state that the project URL is unset

#### Scenario: project_set asks for a base URL only when one is needed

- **WHEN** the `project_set` tool description is read
- **THEN** it says to pass `baseUrl` when the server reports that it cannot be determined
- **AND** it does not instruct passing it by deployment kind
- **AND** it states that the base URL is otherwise derived from the project URL
