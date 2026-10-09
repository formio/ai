# tool-path-arguments Specification

## Purpose

Defines the one rule every MCP tool applies to an argument before it becomes part of a request path — an allowlist of path segments — and the single-segment rule for arguments that name one resource.

## Requirements

### Requirement: Tool arguments that become request paths are validated by one rule

Every tool argument that is joined into a request path SHALL be checked by one shared rule before the handler resolves a project or makes any request. The rule SHALL be an allowlist: the value is one or more `/`-separated segments, and every segment consists only of ASCII letters, digits, `-` and `_` — the characters Form.io accepts in a form path, plus `_`. A value that is empty, begins with `/`, has an empty segment, or has a segment holding any other character — a scheme's `:`, a `.` or `..` segment, a percent-encoded `%2e%2e`, a `?` or `#`, a backslash — SHALL be refused. A refusal SHALL be returned as a tool error with `isError: true` that names the argument and the value, and SHALL say what shape the argument accepts. No request SHALL be made for a refused value.

The rule applies to: `formIdOrPath` on `form_get`, `form_revisions_list` and `form_revision_get`; `formId` on every `action_*` tool; `actionId` on `action_get`, `action_update` and `action_delete`; `actionName` on `action_type_get`; and `version` on `form_revision_get` and `form_update`. Arguments that already require a 24-character hex ObjectId — `formId` on `form_update` and `roleId` on `role_update` — SHALL keep that check, which this rule does not loosen.

#### Scenario: A form path with separators is accepted

- **WHEN** `form_get` is called with `formIdOrPath: "user/login"`
- **THEN** the request is made to `{projectUrl}/user/login`

#### Scenario: A form ObjectId is accepted

- **WHEN** `form_get` is called with `formIdOrPath: "65a1b2c3d4e5f60718293a4b"`
- **THEN** the request is made to `{projectUrl}/form/65a1b2c3d4e5f60718293a4b`

#### Scenario: A value carrying a scheme is refused

- **WHEN** `form_get` is called with `formIdOrPath: "https://example.com/x"`
- **THEN** the tool returns `isError: true` naming `formIdOrPath`
- **AND** no request is made

#### Scenario: A value beginning with a slash is refused

- **WHEN** `form_get` is called with `formIdOrPath: "//example.com/x"` or `"/user/login"`
- **THEN** the tool returns `isError: true` naming `formIdOrPath`
- **AND** no request is made

#### Scenario: A dot segment is refused

- **WHEN** `form_revisions_list` is called with `formIdOrPath: "user/../../other"`
- **THEN** the tool returns `isError: true` naming `formIdOrPath`
- **AND** no request is made

#### Scenario: A percent-encoded dot segment is refused

- **WHEN** `action_delete` is called with a valid `formId` and `actionId: "%2e%2e"`
- **THEN** the tool returns `isError: true` naming `actionId`
- **AND** no request is made

#### Scenario: A query or fragment character is refused

- **WHEN** `action_delete` is called with `formId: "65a1b2c3d4e5f60718293a4b#"` or `"65a1b2c3d4e5f60718293a4b?"`
- **THEN** the tool returns `isError: true` naming `formId`
- **AND** no request is made

#### Scenario: A revert version is checked by the same rule

- **WHEN** `form_update` is called with `revert: true` and `version: "../../export"`
- **THEN** the tool returns `isError: true` naming `version`
- **AND** no request is made

#### Scenario: A backslash or an empty segment is refused

- **WHEN** `form_get` is called with `formIdOrPath: "user\\login"` or `"user//login"`
- **THEN** the tool returns `isError: true` naming `formIdOrPath`

### Requirement: Arguments that name one resource accept a single segment

`formId` on the `action_*` tools, `actionId`, `actionName`, and `version` each name ONE resource, so in addition to the shared rule each SHALL refuse a value containing `/`. The refusal SHALL name the argument.

#### Scenario: A multi-segment action ID is refused

- **WHEN** `action_get` is called with `formId: "65a1b2c3d4e5f60718293a4b"` and `actionId: "abc/def"`
- **THEN** the tool returns `isError: true` naming `actionId`
- **AND** no request is made

#### Scenario: A revision number is accepted

- **WHEN** `form_revision_get` is called with `formIdOrPath: "user/login"` and `version: "3"`
- **THEN** the request is made to `{projectUrl}/user/login/v/3`

#### Scenario: An action type name is accepted

- **WHEN** `action_type_get` is called with a valid `formId` and `actionName: "email"`
- **THEN** the request is made to `{projectUrl}/form/{formId}/actions/email`

