## MODIFIED Requirements

### Requirement: Project resolution follows one precedence order for every client

The server SHALL resolve the target Form.io project for each tool call in this order, with no dependence on which agent or host launched it:

1. `FORMIO_PROJECT_URL` from the environment, when set and non-empty.
2. The `env.FORMIO_PROJECT_URL` of the `~/.formio/projects.json` entry keyed by the caller-supplied `cwd`, when a `cwd` was supplied and an entry exists.
3. Otherwise, resolution fails (see the actionable-error requirement below).

The base URL SHALL resolve as: `env.FORMIO_BASE_URL` from the matched project-map entry, otherwise the configured base URL. Trailing slashes SHALL be stripped from both resolved URLs.

When neither the mapping nor the environment supplies a base URL, the server SHALL NOT substitute `https://api.form.io` unconditionally. That constant is correct for exactly one of the three deployment shapes, and applying it to the others points the portal-login URL and the token-cache key at a deployment the user does not use. The server SHALL instead decide by the shape of the resolved project URL:

1. **Project URL on a `form.io` host** (the hosted cloud — `https://examples.form.io`) → the base URL is `https://api.form.io`, reported with source `default`.
2. **Project URL carrying a non-empty path** (sub-directory routing) → the base URL is that project URL **with its final path segment removed**, reported with source `derived`. The final segment is the project's name; everything preceding it is the deployment, which MAY itself be mounted at a sub-path. A single-segment path therefore reduces to the origin, and a multi-segment path retains its parent path — `https://forms.mysite.com/myproject` derives `https://forms.mysite.com`, and `https://forms.mysite.com/one/two` derives `https://forms.mysite.com/one`. The derived value SHALL NOT be reduced to the bare origin, because a deployment mounted at `/one` does not serve the portal login or `/current` at the domain root.
3. **Project URL with no path on any other host** (sub-domain routing — `https://myproject.mysite.com`) → the base URL is **unresolved**, reported with source `unresolved`. The deployment lives on a different host of the same parent domain and nothing in the project URL names it, so it SHALL NOT be guessed.

The reported base-URL source SHALL therefore be one of `environment`, `mapping`, `derived`, `default`, or `unresolved`.

An unresolved base URL SHALL NOT fail resolution itself, and SHALL NOT prevent a tool call that does not need one. `baseUrl` is consumed only by authentication — keying the JWT cache, building the portal-login candidates, and forming the `${baseUrl}/current` validation request — while every Form.io API request is built from the project URL. The resolved configuration SHALL therefore represent the base URL as absent rather than as a substituted value, and the requirement for one SHALL be enforced at the point authentication reads it (see the actionable-error requirement below). In particular, a deployment authenticating with `FORMIO_API_KEY` never reads the base URL, and SHALL keep working in this shape.

#### Scenario: Environment wins over a stale map entry

- **WHEN** `FORMIO_PROJECT_URL` is `https://env-project.form.io`
- **AND** `~/.formio/projects.json` maps the caller's `cwd` to `https://mapped-project.form.io`
- **THEN** the resolved project URL is `https://env-project.form.io`

#### Scenario: Map is used when the environment is unset

- **WHEN** `FORMIO_PROJECT_URL` is unset
- **AND** `~/.formio/projects.json` maps `/work/app` to `https://mapped-project.form.io`
- **AND** a tool is called with `cwd` of `/work/app`
- **THEN** the resolved project URL is `https://mapped-project.form.io`

#### Scenario: Mapped base URL overrides the configured base URL

- **WHEN** `FORMIO_PROJECT_URL` is unset
- **AND** the map entry for the caller's `cwd` carries `FORMIO_BASE_URL` of `https://forms.example.com`
- **THEN** the resolved base URL is `https://forms.example.com`

#### Scenario: A sub-domain-routed customer project resolves against its own deployment host

- **WHEN** `FORMIO_PROJECT_URL` is unset
- **AND** the map entry for the caller's `cwd` carries `FORMIO_PROJECT_URL` of `https://myproject.mysite.com` and `FORMIO_BASE_URL` of `https://forms.mysite.com`
- **THEN** the resolved project URL is `https://myproject.mysite.com` and the resolved base URL is `https://forms.mysite.com`
- **AND** neither URL is reconstructed from the other — a customer deployment may route projects to sibling sub-domains rather than sub-directories, so the project host is not required to sit under the base host

#### Scenario: A hosted-cloud project with no supplied base URL keeps the default

- **WHEN** neither the environment nor the mapping supplies a base URL
- **AND** the resolved project URL is `https://examples.form.io`
- **THEN** the resolved base URL is `https://api.form.io`
- **AND** the reported base-URL source is `default`

#### Scenario: A single-segment sub-directory project derives the origin

- **WHEN** neither the environment nor the mapping supplies a base URL
- **AND** the resolved project URL is `https://forms.mysite.com/myproject`
- **THEN** the resolved base URL is `https://forms.mysite.com`
- **AND** the reported base-URL source is `derived`

#### Scenario: A deployment mounted at a sub-path keeps its parent path

- **WHEN** neither the environment nor the mapping supplies a base URL
- **AND** the resolved project URL is `https://forms.mysite.com/one/two`
- **THEN** the resolved base URL is `https://forms.mysite.com/one`
- **AND** it is NOT `https://forms.mysite.com`
- **AND** the reported base-URL source is `derived`

#### Scenario: A local sub-directory project derives its origin including the port

- **WHEN** neither the environment nor the mapping supplies a base URL
- **AND** the resolved project URL is `http://localhost:3000/authoring-abc123`
- **THEN** the resolved base URL is `http://localhost:3000`
- **AND** the reported base-URL source is `derived`

#### Scenario: A sub-domain-routed project leaves the base URL unresolved instead of defaulting

- **WHEN** neither the environment nor the mapping supplies a base URL
- **AND** the resolved project URL is `https://myproject.mysite.com`
- **THEN** resolution succeeds and the resolved project URL is `https://myproject.mysite.com`
- **AND** the resolved base URL is absent — in particular it is NOT `https://api.form.io`
- **AND** the reported base-URL source is `unresolved`
- **AND** no HTTP request is made to any deployment during resolution

#### Scenario: Trailing slashes are stripped from resolved URLs

- **WHEN** the resolved project URL is `https://my-project.form.io/`
- **THEN** the value used for requests is `https://my-project.form.io`

### Requirement: Unresolvable projects fail with an actionable error naming project_set

When no project can be resolved, every project-scoped tool SHALL fail with an error that names both remedies available to the caller: calling `project_set` with the caller's `cwd`, and setting `FORMIO_PROJECT_URL`. The error SHALL echo the `cwd` that was searched when one was supplied. The failure SHALL surface as a tool error; the server SHALL remain connected and able to serve subsequent calls.

A project URL that resolves while its base URL does not — the sub-domain-routed shape above — SHALL fail on the same terms, but at the point authentication needs the value rather than at resolution. That error SHALL name `project_set` and its `baseUrl` argument, SHALL echo the resolved project URL, and SHALL state why the value cannot be guessed: the deployment is a different host of the same parent domain, and substituting `https://api.form.io` would build the portal-login URL and key the token cache against a deployment the user does not use. It SHALL NOT report the project as unconfigured, because the project URL is configured and re-running the interview from scratch is not the fix.

Because the base URL is read only by authentication, that failure SHALL be scoped to callers that authenticate with a JWT. A tool call that needs no project at all SHALL be unaffected, and a deployment configured with `FORMIO_API_KEY` SHALL complete its calls normally in this shape — the API-key path returns before any base-URL read, so it SHALL NOT be made to fail for a value it never uses.

#### Scenario: Unmapped cwd with no environment project URL

- **WHEN** `FORMIO_PROJECT_URL` is unset
- **AND** a tool is called with `cwd` of `/work/app`, for which no map entry exists
- **THEN** the tool fails with an error containing `project_set`, `FORMIO_PROJECT_URL`, and `/work/app`
- **AND** the server remains connected

#### Scenario: No cwd and no environment project URL

- **WHEN** `FORMIO_PROJECT_URL` is unset
- **AND** a tool is called with no `cwd` argument
- **THEN** the tool fails with an error containing `project_set` and `FORMIO_PROJECT_URL`

#### Scenario: A JWT call against a project with no derivable base URL is actionable

- **WHEN** the map entry for the caller's `cwd` carries `FORMIO_PROJECT_URL` of `https://myproject.mysite.com` and no `FORMIO_BASE_URL`, the environment supplies none, and no `FORMIO_API_KEY` is set
- **AND** a project-scoped tool is called with that `cwd`
- **THEN** the tool fails with an error naming `project_set` and `baseUrl`
- **AND** the error echoes `https://myproject.mysite.com`
- **AND** the error does not claim that no project is configured
- **AND** no portal-login browser window is opened and no request is made to `https://api.form.io`
- **AND** the server remains connected

#### Scenario: An API-key deployment is unaffected by an unresolved base URL

- **WHEN** `FORMIO_API_KEY` is set and the resolved project URL is `https://myproject.mysite.com` with no base URL from either source
- **AND** `form_list` is called
- **THEN** the call proceeds against `https://myproject.mysite.com` and succeeds
- **AND** no base-URL error is raised

#### Scenario: Every project-scoped tool raises the same error

- **WHEN** `FORMIO_PROJECT_URL` is unset and the caller's `cwd` is unmapped
- **AND** each of `form_list`, `form_get`, `form_create`, `form_update`, `form_revisions_list`, `form_revision_get`, `role_list`, `role_create`, `role_update`, `action_types_list`, `action_type_get`, `action_list`, `action_get`, `action_create`, `action_update`, `action_delete`, `project_export`, and `project_import` is invoked
- **THEN** each returns the actionable resolution error rather than an HTTP failure or an unhandled exception

#### Scenario: hello needs no project

- **WHEN** `FORMIO_PROJECT_URL` is unset and no map entry exists
- **AND** `hello` is called
- **THEN** it succeeds
