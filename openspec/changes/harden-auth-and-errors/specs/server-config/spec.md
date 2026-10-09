## ADDED Requirements

### Requirement: FORMIO_REQUEST_TIMEOUT sets the request timeout

The server SHALL read `FORMIO_REQUEST_TIMEOUT` as a number of seconds, parsed like `FORMIO_AUTH_TIMEOUT` (a positive integer; anything else is ignored), and use it as the default timeout for Form.io requests in place of 60 seconds. The longer timeout for `project_import` and `project_export` SHALL be unaffected.

#### Scenario: Unset or invalid

- **WHEN** `FORMIO_REQUEST_TIMEOUT` is unset, `0`, or `abc`
- **THEN** the default timeout is 60 seconds
