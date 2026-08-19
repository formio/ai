## MODIFIED Requirements

### Requirement: Project resolution follows one precedence order for every client

The server SHALL resolve the target Form.io project for each tool call in this order, with no dependence on which agent or host launched it. The order is by SCOPE, narrowest first — the source most specific to the code wins, and a global default is the weakest:

1. `projectUrl` from the nearest committed `formio.json`, discovered by the upward walk in `committed-project-config`.
2. The `env.FORMIO_PROJECT_URL` of the `~/.formio/projects.json` entry keyed by the caller-supplied `cwd`, when a `cwd` was supplied and an entry exists.
3. `FORMIO_PROJECT_URL` from the environment, when set and non-empty.
4. Otherwise, resolution fails (see the actionable-error requirement below).

No other variable participates. In particular there SHALL be no variable that OFFERS a project without applying one: the environment is already the weakest source, so a project set there is overridden by both stronger sources and therefore suggests without pinning.

The base URL SHALL resolve through the SAME order, reading `baseUrl` from the committed file, then `env.FORMIO_BASE_URL` from the matched map entry, then `FORMIO_BASE_URL` from the environment. Trailing slashes SHALL be stripped from both resolved URLs.

`FORMIO_PROJECT_URL` is not a pin. It is the weakest source, so a committed file or a personal mapping overrides it, and `project_set` CAN redirect a directory whose environment names a different project. A deployment that must target one project deterministically SHALL supply only the source it wants used.

When no source supplies a base URL, the server SHALL derive it from the shape of the resolved project URL. There is no defaulting step: every base URL is either **derived** from the project URL or **absent and asked for**, which is what makes the Project URL the single configuration a user has to think about.

1. **Project URL on a `form.io` host** (the hosted cloud — `https://examples.form.io`) → the base URL is `https://api.form.io`, reported with source `derived`. The hosted cloud is the one deployment whose base URL is a constant, so this is a derivation from the host rather than a fallback.
2. **Project URL carrying a non-empty path** (sub-directory routing) → the base URL is that project URL **with its final path segment removed**, reported with source `derived`. The final segment is the project's name; everything preceding it is the deployment, which MAY itself be mounted at a sub-path. `https://forms.mysite.com/myproject` derives `https://forms.mysite.com`, and `https://forms.mysite.com/one/two` derives `https://forms.mysite.com/one`. The derived value SHALL NOT be reduced to the bare origin.
3. **Project URL with no path on any other host** (sub-domain routing — `https://myproject.mysite.com`) → the base URL is **unresolved**, reported with source `unresolved`. The deployment lives on a different host of the same parent domain and nothing in the project URL names it, so it SHALL NOT be guessed.

The reported project-URL source SHALL be one of `committed`, `mapping`, or `environment`. The reported base-URL source SHALL be one of `committed`, `mapping`, `environment`, `derived`, or `unresolved`. There SHALL be no `default` source: a value reported as a default reads as a guess, and after the shape rules no guess remains.

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

#### Scenario: No variable offers a project without applying one

- **WHEN** the resolution order is inspected
- **THEN** it names exactly three project sources
- **AND** none of them is a suggestion the agent must confirm before it takes effect

#### Scenario: A hosted-cloud project derives its base URL

- **WHEN** no source supplies a base URL and the resolved project URL is `https://examples.form.io`
- **THEN** the resolved base URL is `https://api.form.io`
- **AND** the reported base-URL source is `derived`, not `default`

#### Scenario: A deployment mounted at a sub-path keeps its parent path

- **WHEN** no source supplies a base URL and the resolved project URL is `https://forms.mysite.com/one/two`
- **THEN** the resolved base URL is `https://forms.mysite.com/one`
- **AND** the reported base-URL source is `derived`

#### Scenario: A sub-domain-routed project leaves the base URL unresolved

- **WHEN** no source supplies a base URL and the resolved project URL is `https://myproject.mysite.com`
- **THEN** resolution succeeds with the base URL absent
- **AND** the reported base-URL source is `unresolved`
- **AND** it is not `https://api.form.io`

#### Scenario: Trailing slashes are stripped from resolved URLs

- **WHEN** the resolved project URL is `https://my-project.form.io/`
- **THEN** the value used for requests is `https://my-project.form.io`

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

#### Scenario: hello needs no project

- **WHEN** nothing configures a project
- **AND** `hello` is called
- **THEN** it succeeds
