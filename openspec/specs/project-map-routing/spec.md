# project-map-routing Specification

## Purpose
Defines how every client resolves which Form.io project a tool call targets: one precedence order across the environment and the per-directory map, an actionable error when nothing resolves, `project_set` registered everywhere, base-URL fallback order, loud failure on an unreadable map, and one `cwd` schema for every client.
## Requirements
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
### Requirement: project_set is registered for every client

`project_set` SHALL be registered unconditionally in `registerAllTools`, with no dependence on any host-mode environment variable. It SHALL write the supplied project URL — and base URL when supplied — to `~/.formio/projects.json` under the caller's `cwd`, with file mode `0600`.

#### Scenario: project_set is listed regardless of environment

- **WHEN** the server is started with no Form.io environment variables set
- **AND** the client requests `tools/list`
- **THEN** `project_set` appears in the tool list

#### Scenario: project_set writes a routable mapping

- **WHEN** `project_set` is called with `cwd` of `/work/app` and `projectUrl` of `https://my-project.form.io`
- **THEN** `~/.formio/projects.json` contains an entry keyed `/work/app` whose `env.FORMIO_PROJECT_URL` is `https://my-project.form.io`
- **AND** a subsequent project-scoped tool call with `cwd` of `/work/app` resolves to that project when `FORMIO_PROJECT_URL` is unset

### Requirement: A written base URL falls back to the mapping before the environment

When `project_set` (and the equivalent `formio-mcp project set` command) is called without an explicit base URL, the value written SHALL be the base URL already mapped for that working directory when one exists, and only otherwise `FORMIO_BASE_URL` from the environment. Every value in the chain SHALL be tested for truthiness rather than nullishness, so an empty string — a host prompt the user cleared — falls through instead of erasing the mapping.

This mirrors the resolution order above, where a mapped base URL outranks the configured one. Preferring the environment here would make the mapped-value fallback unreachable wherever a host exports a `FORMIO_BASE_URL` of its own (the `.mcpb` desktop bundle sets one from its prompt): re-pointing a self-hosted directory at a sibling project would silently move it to whatever that global names, sending its portal login to the wrong deployment and re-keying its token cache. Changing a directory's deployment therefore requires passing the base URL explicitly.

The environment link SHALL be reached ONLY for a project URL that derives no base URL of its own — the path-less shape on a customer domain. A global `FORMIO_BASE_URL` is one value answering a per-project question: written into the mapping for a project whose shape derives its own deployment, it replaces a per-project-correct answer with a stale copy that then outranks derivation for that directory forever. `https://api.form.io` is the value most likely to be exported, so the failure this prevents is the same silent substitution the derivation rules exist to prevent — a hosted-cloud base URL persisted for a self-hosted project. Whether a project URL derives its own base URL SHALL be decided by the derivation rules above rather than by a separate test, so the two cannot drift.

#### Scenario: Re-pointing a directory keeps its deployment

- **WHEN** `/work/crm` is mapped to `https://forms.example.com/old` with `FORMIO_BASE_URL` of `https://forms.example.com`
- **AND** `FORMIO_BASE_URL` in the environment is `https://api.form.io`
- **AND** `project_set` is called with that `cwd`, a `projectUrl` of `https://forms.example.com/new`, and no `baseUrl`
- **THEN** the entry's `env.FORMIO_BASE_URL` is still `https://forms.example.com`

#### Scenario: An explicit base URL replaces the mapped one

- **WHEN** a directory is mapped with `FORMIO_BASE_URL` of `https://forms.example.com`
- **AND** `project_set` is called with a `baseUrl` of `https://api.form.io`
- **THEN** the entry's `env.FORMIO_BASE_URL` becomes `https://api.form.io`

#### Scenario: The environment supplies the base URL for a project that derives none

- **WHEN** no entry exists for the caller's `cwd`
- **AND** `FORMIO_BASE_URL` in the environment is `https://forms.mysite.com`
- **AND** `project_set` is called with a `projectUrl` of `https://myproject.mysite.com` and no `baseUrl`
- **THEN** the new entry's `env.FORMIO_BASE_URL` is `https://forms.mysite.com`

#### Scenario: The environment does not override a derivable base URL

- **WHEN** no entry exists for the caller's `cwd`
- **AND** `FORMIO_BASE_URL` in the environment is `https://api.form.io`
- **AND** `project_set` is called with a `projectUrl` of `https://forms.mysite.com/myproject` and no `baseUrl`
- **THEN** the new entry records the project URL alone, with no `env.FORMIO_BASE_URL`
- **AND** resolution derives `https://forms.mysite.com` for that directory rather than reading `https://api.form.io`

### Requirement: An unreadable project map fails loudly instead of reading as empty

A `~/.formio/projects.json` that exists but cannot be read or parsed SHALL raise a distinguishable error from every read and every write, naming the file and how to recover. A missing file remains the ordinary first-run state and SHALL still resolve to "no entry".

This SHALL hold per entry as well as for the file: an entry that is not an object with an `env` object of string values is unreadable, and SHALL raise the same error naming the directory. Every caller reaches straight for `entry.env.FORMIO_BASE_URL`, so an unvalidated entry surfaced as a bare `TypeError` reported as a generic failure. Validation SHALL be lazy — the map is shared, so a malformed entry for one directory SHALL NOT fail another directory's lookup or block mapping it.

Reporting a corrupt map as an empty one made every directory look unmapped, and the documented recovery — interview the user, then `project set` — rewrote the file from scratch, discarding every other directory's mapping. Refusing the write keeps the file intact for repair.

#### Scenario: A truncated map is not reported as an unmapped directory

- **WHEN** `~/.formio/projects.json` contains truncated JSON
- **AND** `formio-mcp project get` runs for a directory the file was mapping
- **THEN** it exits `2` naming `projects.json`, rather than reporting that no project is configured

#### Scenario: A malformed entry names the directory instead of throwing a TypeError

- **WHEN** `~/.formio/projects.json` maps `/work` to a string, or to an object with no `env` block
- **AND** an entry is read or written for `/work`
- **THEN** it raises the unreadable-map error naming `/work` and the file, and the file is left intact

#### Scenario: One malformed entry does not take the other directories down

- **WHEN** `~/.formio/projects.json` holds a malformed entry for `/broken` and a well-formed one for `/good`
- **THEN** reading and writing `/good` succeed, and `/broken` travels through the write verbatim

### Requirement: The project command distinguishes "nothing mapped" from "could not run"

`formio-mcp project` SHALL use three exit codes: `0` when it answered, `1` when the command ran and nothing is configured for the directory, and `2` when the command could not answer — a usage error, a malformed URL, a relative `--cwd`, or an unreadable project map. Skill documentation SHALL branch on the code rather than on a substring of the message.

Collapsing every non-zero exit into "nothing is mapped" sends the caller into an interview whose `project_set` then fails for the same unreported reason, so the user sees an interview-then-error loop that never names the cause.

#### Scenario: An unmapped directory is an answer

- **WHEN** `formio-mcp project get` runs for a directory with no entry and no environment pin
- **THEN** it exits `1` with a message naming `project set`

#### Scenario: A relative cwd is a failure, not an unmapped directory

- **WHEN** `formio-mcp project get --cwd relative/path` runs
- **THEN** it exits `2` with a message naming the absolute-path requirement

#### Scenario: A corrupt map is never overwritten

- **WHEN** `~/.formio/projects.json` contains truncated JSON
- **AND** a mapping write is attempted
- **THEN** the write fails and the file's contents are unchanged

### Requirement: The cwd parameter has one schema and one description for every client

The `cwd` parameter of project-scoped tools SHALL be an optional string that, when present, MUST be an absolute path. Its description SHALL name every source a project can come from, in the precedence order above — a committed `formio.json`, then the working-directory mapping, then `FORMIO_PROJECT_URL` as the weakest — and SHALL say that it should be passed on every call.

It SHALL NOT say that any environment variable removes the need for it, and SHALL NOT describe `FORMIO_PROJECT_URL` as a pin or as taking precedence over a mapping. The description is read on every tool call, more reliably than the server's `instructions`, so a stale precedence claim there is the most-read wrong answer the server ships.

The schema SHALL NOT vary by host mode, and the server SHALL NOT build a different schema depending on when the process started.

#### Scenario: Relative cwd is rejected

- **WHEN** a tool is called with `cwd` of `./app`
- **THEN** the call fails with a validation error stating that `cwd` must be an absolute path

#### Scenario: The cwd description carries the same precedence the resolver implements

- **WHEN** the `cwd` parameter's description is read
- **THEN** it names a committed `formio.json`, the working-directory mapping, and `FORMIO_PROJECT_URL`
- **AND** it identifies the environment as the weakest of the three
- **AND** it does not claim any variable pins the project or replaces `cwd`

#### Scenario: Omitted cwd is accepted when the environment supplies the project

- **WHEN** `FORMIO_PROJECT_URL` is set
- **AND** a tool is called with no `cwd`
- **THEN** the call proceeds against the environment-supplied project

