## MODIFIED Requirements

### Requirement: Project resolution follows one precedence order for every client

The server SHALL resolve the target Form.io project for each tool call in this order, with no dependence on which agent or host launched it. The order is by SCOPE, narrowest first — the source most specific to the code wins, and a global default is the weakest:

1. `projectUrl` from the nearest committed `formio.json`, discovered by the upward walk in `committed-project-config`.
2. The `env.FORMIO_PROJECT_URL` of the `~/.formio/projects.json` entry keyed by the caller-supplied `cwd`, when a `cwd` was supplied and an entry exists.
3. `FORMIO_PROJECT_URL` from the environment, when set and non-empty.
4. Otherwise, resolution fails (see the actionable-error requirement below).

The base URL SHALL resolve through the SAME order, reading `baseUrl` from the committed file, then `env.FORMIO_BASE_URL` from the matched map entry, then `FORMIO_BASE_URL` from the environment. Trailing slashes SHALL be stripped from both resolved URLs.

Resolving both halves the same way is a correction, not a new asymmetry: the project URL previously resolved environment-first while the base URL already resolved mapping-first, so one pair resolved in two directions.

`FORMIO_PROJECT_URL` is no longer a pin. It is the weakest source, so a committed file or a personal mapping overrides it, and `project_set` CAN now redirect a directory whose environment names a different project. A deployment that must target one project deterministically SHALL supply only the source it wants used: an environment value with no committed file in the checkout and no mapping for that directory resolves unambiguously. When the target is a property of what is being built, the branch-per-environment model this capability adopts covers it — the branch under build carries the target it should use.

When no source supplies a base URL, the server SHALL NOT substitute `https://api.form.io` unconditionally. That constant is correct for exactly one of the three deployment shapes, and applying it to the others points the portal-login URL and the token-cache key at a deployment the user does not use. The server SHALL instead decide by the shape of the resolved project URL:

1. **Project URL on a `form.io` host** (the hosted cloud — `https://examples.form.io`) → the base URL is `https://api.form.io`, reported with source `default`.
2. **Project URL carrying a non-empty path** (sub-directory routing) → the base URL is that project URL **with its final path segment removed**, reported with source `derived`. The final segment is the project's name; everything preceding it is the deployment, which MAY itself be mounted at a sub-path. A single-segment path therefore reduces to the origin, and a multi-segment path retains its parent path — `https://forms.mysite.com/myproject` derives `https://forms.mysite.com`, and `https://forms.mysite.com/one/two` derives `https://forms.mysite.com/one`. The derived value SHALL NOT be reduced to the bare origin, because a deployment mounted at `/one` does not serve the portal login or `/current` at the domain root.
3. **Project URL with no path on any other host** (sub-domain routing — `https://myproject.mysite.com`) → the base URL is **unresolved**, reported with source `unresolved`. The deployment lives on a different host of the same parent domain and nothing in the project URL names it, so it SHALL NOT be guessed.

The reported project-URL source SHALL be one of `committed`, `mapping`, or `environment`. The reported base-URL source SHALL be one of `committed`, `mapping`, `environment`, `derived`, `default`, or `unresolved`.

An unresolved base URL SHALL NOT fail resolution itself, and SHALL NOT prevent a tool call that does not need one. `baseUrl` is consumed only by authentication — keying the JWT cache, building the portal-login candidates, and forming the `${baseUrl}/current` validation request — while every Form.io API request is built from the project URL. The resolved configuration SHALL therefore represent the base URL as absent rather than as a substituted value, and the requirement for one SHALL be enforced at the point authentication reads it. In particular, a deployment authenticating with `FORMIO_API_KEY` never reads the base URL, and SHALL keep working in this shape.

#### Scenario: A committed file outranks a personal mapping

- **WHEN** `formio.json` names `https://committed.form.io` and the map entry for the caller's `cwd` names `https://mapped.form.io`
- **THEN** the resolved project URL is `https://committed.form.io`
- **AND** the reported project-URL source is `committed`

#### Scenario: A personal mapping outranks the environment

- **WHEN** no committed file is found, the map entry for the caller's `cwd` names `https://mapped.form.io`, and `FORMIO_PROJECT_URL` is `https://env-project.form.io`
- **THEN** the resolved project URL is `https://mapped.form.io`
- **AND** the reported project-URL source is `mapping`

#### Scenario: The environment is the weakest source

- **WHEN** no committed file is found and no map entry exists, and `FORMIO_PROJECT_URL` is `https://env-project.form.io`
- **THEN** the resolved project URL is `https://env-project.form.io`
- **AND** the reported project-URL source is `environment`

#### Scenario: A CI job with only the environment set resolves it

- **WHEN** no committed file is found, no map entry exists for the caller's `cwd`, and `FORMIO_PROJECT_URL` is `https://ci-target.form.io`
- **THEN** the resolved project URL is `https://ci-target.form.io`
- **AND** determinism comes from being the only source present, not from ranking above the others

#### Scenario: project_set can now redirect a directory whose environment names another project

- **WHEN** `FORMIO_PROJECT_URL` is set and `project_set` maps the caller's `cwd` to a different project
- **THEN** subsequent calls from that `cwd` resolve the mapped project
- **AND** the environment value no longer takes precedence

#### Scenario: Both halves come from the committed file

- **WHEN** `formio.json` names both `projectUrl` and `baseUrl`, and the environment sets `FORMIO_BASE_URL` to something else
- **THEN** both resolved values come from the file
- **AND** the reported base-URL source is `committed`

#### Scenario: A committed project with no committed base URL still derives

- **WHEN** `formio.json` names only `projectUrl` of `https://forms.mysite.com/one/two` and nothing supplies a base URL
- **THEN** the resolved base URL is `https://forms.mysite.com/one`
- **AND** the reported base-URL source is `derived`

#### Scenario: Trailing slashes are stripped from resolved URLs

- **WHEN** the resolved project URL is `https://my-project.form.io/`
- **THEN** the value used for requests is `https://my-project.form.io`

### Requirement: Unresolvable projects fail with an actionable error naming project_set

When no project can be resolved, every project-scoped tool SHALL fail with an error that names the remedies available to the caller: calling `project_set` with the caller's `cwd`, running the equivalent command, and committing a `formio.json`. The error SHALL echo the `cwd` that was searched when one was supplied, and SHALL say that the upward walk for a committed file found none. The failure SHALL surface as a tool error; the server SHALL remain connected and able to serve subsequent calls.

A committed file that is present but unusable — unparseable, missing `projectUrl`, or holding a URL that fails validation — SHALL fail with a DISTINCT error naming that file's path and the offending key. It SHALL NOT report the directory as unconfigured: a file is present, the remedy is to fix it, and sending the caller to `project_set` would leave the broken file in place to shadow whatever mapping they then write.

A project URL that resolves while its base URL does not — the sub-domain-routed shape — SHALL fail on the same terms, but at the point authentication needs the value rather than at resolution. That error SHALL name `project_set` and its `baseUrl` argument, the `baseUrl` key of a committed file, SHALL echo the resolved project URL, and SHALL state why the value cannot be guessed. It SHALL NOT report the project as unconfigured.

Because the base URL is read only by authentication, that failure SHALL be scoped to callers that authenticate with a JWT. A tool call that needs no project at all SHALL be unaffected, and a deployment configured with `FORMIO_API_KEY` SHALL complete its calls normally in this shape.

#### Scenario: Unmapped cwd with no committed file and no environment project URL

- **WHEN** no committed file is found, no map entry exists for `cwd` of `/work/app`, and no environment project URL is set
- **THEN** the tool fails with an error containing `project_set`, `formio.json`, `FORMIO_PROJECT_URL`, and `/work/app`
- **AND** the server remains connected

#### Scenario: A broken committed file is distinguishable from an unmapped directory

- **WHEN** a `formio.json` is found for `cwd` but cannot be parsed
- **THEN** the error names that file's path
- **AND** it does not claim the directory is unconfigured
- **AND** it does not instruct calling `project_set` as the fix

#### Scenario: Every project-scoped tool raises the same error

- **WHEN** nothing resolves a project for the caller's `cwd`
- **AND** each of `form_list`, `form_get`, `form_create`, `form_update`, `form_revisions_list`, `form_revision_get`, `role_list`, `role_create`, `role_update`, `action_types_list`, `action_type_get`, `action_list`, `action_get`, `action_create`, `action_update`, `action_delete`, `project_export`, and `project_import` is invoked
- **THEN** each returns the actionable resolution error rather than an HTTP failure or an unhandled exception

#### Scenario: A JWT call against a project with no derivable base URL is actionable

- **WHEN** the resolved project URL is `https://myproject.mysite.com`, no source supplies a base URL, and no `FORMIO_API_KEY` is set
- **THEN** the tool fails with an error naming `project_set`, `baseUrl`, and the `formio.json` key
- **AND** the error echoes `https://myproject.mysite.com`
- **AND** no portal-login browser window is opened and no request is made to `https://api.form.io`

#### Scenario: An API-key deployment is unaffected by an unresolved base URL

- **WHEN** `FORMIO_API_KEY` is set and the resolved project URL is `https://myproject.mysite.com` with no base URL from any source
- **AND** `form_list` is called
- **THEN** the call proceeds against `https://myproject.mysite.com` and succeeds
- **AND** no base-URL error is raised

#### Scenario: hello needs no project

- **WHEN** nothing configures a project
- **AND** `hello` is called
- **THEN** it succeeds
