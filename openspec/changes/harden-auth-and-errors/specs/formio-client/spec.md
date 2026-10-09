## MODIFIED Requirements

### Requirement: HTTP error handling with re-auth on 401

The `formioFetch` function SHALL throw a descriptive error when the API returns a non-OK response. In JWT mode, a 401 response SHALL first be checked against the deployment: the client SHALL request `{baseUrl}/current` with the same token, not following redirects and with a timeout of 10 seconds. When `/current` answers 2xx, the token is valid and the 401 is a permission refusal: the token SHALL be kept (in memory and on disk), no login SHALL start, and the error SHALL carry code `FORBIDDEN` and status 401, naming the signed-in account (the `/current` response's `data.email`, or its `_id` when there is no email) and the URL refused. When `/current` does not answer 2xx, the 401 SHALL trigger re-authentication and a single retry of the original request.

#### Scenario: 401 with a token the deployment still accepts

- **WHEN** the Form.io API responds with status 401, `config.jwt` is set, and `{baseUrl}/current` answers 200 for that token with `data.email` `ann@example.com`
- **THEN** `formioFetch` throws a `FORBIDDEN` error with status 401 naming `ann@example.com` and the request URL
- **AND** the cached token is not cleared and no login flow starts

#### Scenario: 401 in JWT mode triggers re-auth and retry

- **WHEN** the Form.io API responds with status 401, `config.jwt` is set, and `{baseUrl}/current` refuses the token
- **THEN** `formioFetch` triggers the login flow to get a new JWT
- **AND** retries the original request with the new JWT
- **AND** returns the result of the retry

#### Scenario: 401 retry also fails

- **WHEN** the original request returns 401, `/current` refuses the token, re-auth succeeds, but the retry also returns 401
- **THEN** `formioFetch` throws an error containing the status code (no infinite retry loop)

#### Scenario: 401 in API key mode throws without retry

- **WHEN** the Form.io API responds with status 401 and `config.apiKey` is set (no JWT)
- **THEN** `formioFetch` throws an error containing the status code without attempting re-auth or calling `/current`

#### Scenario: API returns 400 Bad Request

- **WHEN** the Form.io API responds with status 400
- **THEN** `formioFetch` throws an error containing the status code

## ADDED Requirements

### Requirement: Every Form.io request has a timeout

Every request the client sends to a Form.io deployment SHALL be aborted when it has not completed within its timeout: 60 seconds by default, 300 seconds for `project_import` and `project_export`, or the number of seconds `FORMIO_REQUEST_TIMEOUT` names when it is set to a positive integer (which replaces the 60-second default, not the 300-second one). A caller-supplied `signal` SHALL still abort the request. A request aborted by its timeout SHALL fail with code `NETWORK_ERROR` and a message naming the URL and the number of seconds waited.

#### Scenario: A deployment that never answers

- **WHEN** a `form_get` request receives no response within 60 seconds
- **THEN** the tool returns `NETWORK_ERROR` naming the URL and "60 seconds"

#### Scenario: Import gets longer

- **WHEN** `project_import` runs for 120 seconds and then completes
- **THEN** the import succeeds

#### Scenario: The default is configurable

- **WHEN** `FORMIO_REQUEST_TIMEOUT` is `5` and a request receives no response within 5 seconds
- **THEN** the tool returns `NETWORK_ERROR` naming "5 seconds"
