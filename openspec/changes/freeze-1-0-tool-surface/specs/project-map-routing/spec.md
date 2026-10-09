## MODIFIED Requirements

### Requirement: Unresolvable projects fail with an actionable error naming project_set

When no project can be resolved, every project-scoped tool SHALL fail with an error that names the remedies available to the caller: calling `project_set` with the caller's `cwd`, running the equivalent command, and committing a `formio.json`. The error SHALL echo the `cwd` that was searched when one was supplied, and SHALL say that the upward walk for a committed file found none. It SHALL describe what a Project URL is, with an example per deployment kind, because that is the value it is asking for.

It SHALL NOT recite the base-URL guidance. The base URL is derived from whichever project URL the user supplies, so guidance about it cannot be acted on before that answer exists, and carrying it here made the message ask for two values when one is needed. It SHALL NOT name a suggested project, because no variable offers one.

A committed file that is present but unusable SHALL fail with a DISTINCT error naming that file's path and the offending key, and SHALL NOT report the directory as unconfigured.

A project URL that resolves while its base URL does not SHALL fail at the point authentication needs the value. That error SHALL name `project_set` and its `baseUrl` argument, the `baseUrl` key of a committed file, SHALL echo the resolved project URL, and SHALL explain that a path-less project URL on a customer domain names its deployment nowhere. It SHALL NOT report the project as unconfigured. Because the base URL is read only by authentication, that failure SHALL be scoped to callers that authenticate with a JWT: a deployment configured with `FORMIO_API_KEY` SHALL complete its calls normally in this shape.

#### Scenario: The unset-project error asks for the project alone

- **WHEN** nothing resolves a project for `cwd` of `/work/app`
- **THEN** the tool fails with an error containing `project_set`, `formio.json`, and `/work/app`
- **AND** it describes what a Project URL is
- **AND** it does not ask for a base URL
- **AND** the server remains connected

#### Scenario: No suggested project appears in the error

- **WHEN** nothing resolves a project and `FORMIO_DEFAULT_PROJECT_URL` is set in the environment
- **THEN** the error names no suggested project
- **AND** the message is identical to the one raised when that variable is unset

#### Scenario: A broken committed file is distinguishable from an unmapped directory

- **WHEN** a `formio.json` is found for `cwd` but cannot be parsed
- **THEN** the error names that file's path
- **AND** it does not claim the directory is unconfigured

#### Scenario: A JWT call against a project with no derivable base URL is actionable

- **WHEN** the resolved project URL is `https://myproject.mysite.com`, no source supplies a base URL, and no `FORMIO_API_KEY` is set
- **THEN** the tool fails with an error naming `project_set`, `baseUrl`, and the `formio.json` key
- **AND** the error echoes `https://myproject.mysite.com`
- **AND** no portal-login browser window is opened and no request is made to `https://api.form.io`

#### Scenario: An API-key deployment is unaffected by an unresolved base URL

- **WHEN** `FORMIO_API_KEY` is set and the resolved project URL is `https://myproject.mysite.com` with no base URL from any source
- **THEN** `form_list` proceeds against the project URL and succeeds

#### Scenario: server_status needs no project

- **WHEN** nothing configures a project
- **AND** `server_status` is called
- **THEN** it succeeds, reporting `status: "not-configured"`
