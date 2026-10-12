# server-status Specification

## Purpose

Defines the `server_status` MCP tool: the server's name and version and the calling directory's project resolution, answered without a Form.io request.

## Requirements

### Requirement: server_status reports the server and the caller's project resolution

The server SHALL register a `server_status` tool, replacing `hello`, taking an optional `cwd`. It SHALL return the server's name and version and, for that `cwd`, the same resolution `project_get` reports (`status`, `projectUrl`, `baseUrl`, their sources). It SHALL make no Form.io request and SHALL succeed when no project is configured, reporting `status: "not-configured"`.

#### Scenario: No project configured

- **WHEN** nothing configures a project and `server_status` is called
- **THEN** it succeeds with the server version and `status: "not-configured"`

#### Scenario: A configured directory

- **WHEN** a directory maps `https://examples.form.io` and `server_status` is called with that `cwd`
- **THEN** it reports the server version, `status: "ok"`, and both URLs with their sources
- **AND** no request is made to Form.io

#### Scenario: hello is gone

- **WHEN** the tool list is read
- **THEN** it contains `server_status` and no `hello`

