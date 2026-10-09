## ADDED Requirements

### Requirement: Tool errors carry a structured code alongside the message

Every error a tool handler returns SHALL be a result with `isError: true`, a human-readable text message, and `structuredContent` of `{ code, status?, body? }`. `code` SHALL be one of: `NOT_CONFIGURED`, `BASE_URL_UNRESOLVED`, `CONFIG_UNREADABLE`, `INVALID_ARGUMENT`, `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `LICENSE_REQUIRED`, `HISTORY_NOT_ACCEPTED`, `NO_DRAFT`, `UNKNOWN_ACTION_TYPE`, `REDIRECTED`, `UPSTREAM_ERROR`, `NETWORK_ERROR`, `INTERNAL`. `status` SHALL be the Form.io HTTP status when the error came from a response. `body` SHALL be Form.io's response body, as text truncated to 2,000 characters, when one was returned. The message SHALL include Form.io's error message when the body carries one. Adding a code is a minor change; renaming or removing one is breaking.

The mapping from Form.io responses SHALL be: 401 after re-authentication → `AUTH_REQUIRED`; 403 → `FORBIDDEN`; 404, and 400 "Invalid alias" → `NOT_FOUND`; other 400 and 422 → `VALIDATION_FAILED`; 3xx → `REDIRECTED`; 5xx → `UPSTREAM_ERROR`; a request that received no response → `NETWORK_ERROR`, with the underlying cause (e.g. `ECONNREFUSED`, `ENOTFOUND`, a certificate error) in the message.

#### Scenario: A Form.io validation error keeps its message

- **WHEN** `form_create` is sent a form whose path is taken and Form.io answers 400 with a JSON body naming the path
- **THEN** the result has `isError: true`, `structuredContent.code` `VALIDATION_FAILED`, `status: 400`, and `body` holding Form.io's response
- **AND** the message includes Form.io's error text

#### Scenario: An unreachable deployment names the cause

- **WHEN** the deployment refuses the connection
- **THEN** the result has `structuredContent.code` `NETWORK_ERROR` and the message names `ECONNREFUSED` and the URL

#### Scenario: Resolution errors carry codes

- **WHEN** a project-scoped tool is called for a directory with no project
- **THEN** the result has `structuredContent.code` `NOT_CONFIGURED` and the existing remedy message
