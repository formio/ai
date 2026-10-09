## ADDED Requirements

### Requirement: The directory a call resolves against comes from the client when the caller gives none

Every tool that resolves a project SHALL choose the directory to resolve against in this order, and SHALL use the first that yields one:

1. the `cwd` argument, when the caller passes it;
2. the client's workspace roots, read with `roots/list` when the client declared the `roots` capability at initialization: a single root is used as is; with several roots, the one root whose directory resolves a project record (a committed `formio.json` found by the upward walk, or a directory mapping) is used;
3. the `CLAUDE_PROJECT_DIR` environment variable, when set to an absolute path;
4. the server process's own working directory.

Roots SHALL be read as `file://` URIs and converted to paths; a root that is not a `file://` URI SHALL be ignored. The server SHALL cache the roots it read and SHALL read them again after the client sends `notifications/roots/list_changed`. A `roots/list` request that fails or does not answer within 2 seconds SHALL be treated as no roots, and resolution SHALL continue with the next source.

When the client reports several roots, the caller passes no `cwd`, and either none or more than one of the roots resolves a project record, the tool SHALL refuse with code `INVALID_ARGUMENT` and a message listing the roots and asking for `cwd`.

The `cwd` argument SHALL stay optional on every tool. Its description SHALL say it defaults to the client's workspace root and when to pass it.

#### Scenario: A client with one root

- **WHEN** the client declares `roots` and reports `file:///work/app`, and a tool is called with no `cwd`
- **THEN** the project is resolved for `/work/app`

#### Scenario: Several roots, one with a project

- **WHEN** the client reports `file:///work/app` and `file:///work/lib`, only `/work/app` has a `formio.json`, and a tool is called with no `cwd`
- **THEN** the project is resolved for `/work/app`

#### Scenario: Several roots, ambiguous

- **WHEN** the client reports two roots and both, or neither, resolve a project record, and a tool is called with no `cwd`
- **THEN** the tool returns code `INVALID_ARGUMENT` listing both roots and asking for `cwd`

#### Scenario: An explicit cwd wins

- **WHEN** the client reports `file:///work/app` and a tool is called with `cwd: "/work/other"`
- **THEN** the project is resolved for `/work/other`

#### Scenario: No roots capability

- **WHEN** the client did not declare `roots`, `CLAUDE_PROJECT_DIR` is `/work/app`, and a tool is called with no `cwd`
- **THEN** the project is resolved for `/work/app`
- **AND** no `roots/list` request is sent

#### Scenario: The roots request does not answer

- **WHEN** the client declares `roots` but does not answer `roots/list` within 2 seconds
- **THEN** resolution continues with `CLAUDE_PROJECT_DIR`, then the server's working directory

#### Scenario: Roots change

- **WHEN** the client sends `notifications/roots/list_changed` after reporting a new root
- **THEN** the next call resolves against the new root

### Requirement: Project reports say where the directory came from

`project_get` and `server_status` SHALL report `cwdSource`, one of `argument`, `client-root`, `claude-project-dir`, `server`, naming which source in the order above supplied the directory. When `cwdSource` is `server`, the report SHALL say the directory is the server process's own working directory and that the agent should pass `cwd` on later calls: in its notes when a project resolves, and in its message, with no `remedy` keyed to that directory, when nothing is configured. A project from the environment whose deployment also resolves is the same answer for every directory, so it SHALL carry no such note. No other source SHALL produce that note.

#### Scenario: Resolved from the client's root

- **WHEN** `project_get` is called with no `cwd` and the client reports one root
- **THEN** the report has `cwdSource: "client-root"` and no note about the server's working directory

#### Scenario: Fell back to the server's directory

- **WHEN** `project_get` is called with no `cwd`, the client declares no `roots`, `CLAUDE_PROJECT_DIR` is unset, and a directory mapping for the server's own working directory supplies the project
- **THEN** the report has `cwdSource: "server"` and a note telling the agent to pass `cwd`
