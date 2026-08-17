## ADDED Requirements

### Requirement: Project resolution follows one precedence order for every client

The server SHALL resolve the target Form.io project for each tool call in this order, with no dependence on which agent or host launched it:

1. `FORMIO_PROJECT_URL` from the environment, when set and non-empty.
2. The `env.FORMIO_PROJECT_URL` of the `~/.formio/projects.json` entry keyed by the caller-supplied `cwd`, when a `cwd` was supplied and an entry exists.
3. Otherwise, resolution fails (see the actionable-error requirement below).

The base URL SHALL resolve as: `env.FORMIO_BASE_URL` from the matched project-map entry, otherwise the configured base URL. Trailing slashes SHALL be stripped from both resolved URLs.

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

#### Scenario: Trailing slashes are stripped from resolved URLs

- **WHEN** the resolved project URL is `https://my-project.form.io/`
- **THEN** the value used for requests is `https://my-project.form.io`

### Requirement: Unresolvable projects fail with an actionable error naming project_set

When no project can be resolved, every project-scoped tool SHALL fail with an error that names both remedies available to the caller: calling `project_set` with the caller's `cwd`, and setting `FORMIO_PROJECT_URL`. The error SHALL echo the `cwd` that was searched when one was supplied. The failure SHALL surface as a tool error; the server SHALL remain connected and able to serve subsequent calls.

#### Scenario: Unmapped cwd with no environment project URL

- **WHEN** `FORMIO_PROJECT_URL` is unset
- **AND** a tool is called with `cwd` of `/work/app`, for which no map entry exists
- **THEN** the tool fails with an error containing `project_set`, `FORMIO_PROJECT_URL`, and `/work/app`
- **AND** the server remains connected

#### Scenario: No cwd and no environment project URL

- **WHEN** `FORMIO_PROJECT_URL` is unset
- **AND** a tool is called with no `cwd` argument
- **THEN** the tool fails with an error containing `project_set` and `FORMIO_PROJECT_URL`

#### Scenario: Every project-scoped tool raises the same error

- **WHEN** `FORMIO_PROJECT_URL` is unset and the caller's `cwd` is unmapped
- **AND** each of `form_list`, `form_get`, `form_create`, `form_update`, `form_revisions_list`, `form_revision_get`, `role_list`, `role_create`, `role_update`, `action_types_list`, `action_type_get`, `action_list`, `action_get`, `action_create`, `action_update`, `action_delete`, `project_export`, and `project_import` is invoked
- **THEN** each returns the actionable resolution error rather than an HTTP failure or an unhandled exception

#### Scenario: hello needs no project

- **WHEN** `FORMIO_PROJECT_URL` is unset and no map entry exists
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

This mirrors the resolution order above, where a mapped base URL outranks the configured one. Preferring the environment here would make the mapped-value fallback unreachable in a plugin or bundle install, whose manifests always set `FORMIO_BASE_URL` (defaulted to `https://api.form.io`): re-pointing a self-hosted directory at a sibling project would silently move it to the hosted cloud, sending its portal login to the wrong deployment and re-keying its token cache. Changing a directory's deployment therefore requires passing the base URL explicitly.

#### Scenario: Re-pointing a directory keeps its deployment

- **WHEN** `/work/crm` is mapped to `https://forms.example.com/old` with `FORMIO_BASE_URL` of `https://forms.example.com`
- **AND** `FORMIO_BASE_URL` in the environment is `https://api.form.io`
- **AND** `project_set` is called with that `cwd`, a `projectUrl` of `https://forms.example.com/new`, and no `baseUrl`
- **THEN** the entry's `env.FORMIO_BASE_URL` is still `https://forms.example.com`

#### Scenario: An explicit base URL replaces the mapped one

- **WHEN** a directory is mapped with `FORMIO_BASE_URL` of `https://forms.example.com`
- **AND** `project_set` is called with a `baseUrl` of `https://api.form.io`
- **THEN** the entry's `env.FORMIO_BASE_URL` becomes `https://api.form.io`

#### Scenario: The environment supplies the base URL for an unmapped directory

- **WHEN** no entry exists for the caller's `cwd`
- **AND** `FORMIO_BASE_URL` in the environment is `https://api.form.io`
- **AND** `project_set` is called with no `baseUrl`
- **THEN** the new entry's `env.FORMIO_BASE_URL` is `https://api.form.io`

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

The `cwd` parameter of project-scoped tools SHALL be an optional string that, when present, MUST be an absolute path. Its description SHALL state that it selects the mapped project from `~/.formio/projects.json` and that it is required when `FORMIO_PROJECT_URL` is not set. The schema SHALL NOT vary by host mode, and the server SHALL NOT build a different schema depending on when the process started.

#### Scenario: Relative cwd is rejected

- **WHEN** a tool is called with `cwd` of `./app`
- **THEN** the call fails with a validation error stating that `cwd` must be an absolute path

#### Scenario: Omitted cwd is accepted when the environment supplies the project

- **WHEN** `FORMIO_PROJECT_URL` is set
- **AND** a tool is called with no `cwd`
- **THEN** the call proceeds against the environment-supplied project
