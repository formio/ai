## ADDED Requirements

### Requirement: FORMIO_REQUEST_TIMEOUT sets the request timeout

The server SHALL read `FORMIO_REQUEST_TIMEOUT` as a number of seconds, parsed by the same helper as `FORMIO_AUTH_TIMEOUT` (a positive integer whose milliseconds a timer can hold — at most 2,147,483,647 ms; anything else is ignored and the default applies), and use it as the default timeout for Form.io requests in place of 60 seconds. `project_import` and `project_export` SHALL use it only when it is longer than their 300 seconds.

#### Scenario: Unset or invalid

- **WHEN** `FORMIO_REQUEST_TIMEOUT` is unset, `0`, or `abc`
- **THEN** the default timeout is 60 seconds

#### Scenario: Too long for a timer

- **WHEN** `FORMIO_REQUEST_TIMEOUT` is `2500000` or `5000000`
- **THEN** it is ignored and the default timeout is 60 seconds
