## Purpose

Defines the HTTP client every tool goes through: how a request to the Form.io API is authenticated, and how errors are handled — including re-authentication on a 401.
## Requirements
### Requirement: Authenticated requests to Form.io API

The `formioFetch` function SHALL send requests with the appropriate auth header based on the config's auth mode. If `config.jwt` is set, it SHALL use `x-jwt-token`. If `config.apiKey` is set, it SHALL use `x-token`. The function SHALL support GET, POST, and PUT requests with JSON body serialization.

#### Scenario: GET request with JWT auth

- **WHEN** `formioFetch` is called with a config that has `jwt` set
- **THEN** it sends the request with header `x-jwt-token: {jwt}`

#### Scenario: GET request with API key auth

- **WHEN** `formioFetch` is called with a config that has `apiKey` set and no `jwt`
- **THEN** it sends the request with header `x-token: {apiKey}`

#### Scenario: JWT takes precedence over API key

- **WHEN** `formioFetch` is called with a config that has both `jwt` and `apiKey` set
- **THEN** it sends the request with header `x-jwt-token: {jwt}`

#### Scenario: GET request with query parameters

- **WHEN** `formioFetch` is called with path `/form` and params `{ limit: "10", type: "form" }`
- **THEN** the request URL includes `?limit=10&type=form`

#### Scenario: Empty params are omitted

- **WHEN** `formioFetch` is called with params containing undefined values
- **THEN** those parameters are not included in the query string

#### Scenario: POST request with JSON body

- **WHEN** `formioFetch` is called with path `/form`, method `"POST"`, and a body object
- **THEN** it sends a POST request with `Content-Type: application/json`, the serialized body, and the appropriate auth header
- **AND** returns the parsed JSON response

#### Scenario: No auth credentials available

- **WHEN** `formioFetch` is called with a config that has neither `jwt` nor `apiKey`
- **THEN** it throws an error indicating no authentication credentials are available

### Requirement: HTTP error handling with re-auth on 401

The `formioFetch` function SHALL throw a descriptive error when the API returns a non-OK response. In JWT mode, a 401 response SHALL first be checked against the deployment: the client SHALL request `{baseUrl}/current` with the same token, not following redirects and with a timeout of 10 seconds. When `/current` answers 2xx, the token is valid and the 401 is a permission refusal: the token SHALL be kept (in memory and on disk), no login SHALL start, and the error SHALL carry code `FORBIDDEN` and status 401, naming the signed-in account (the `/current` response's `data.email`, or its `_id` when there is no email), the URL refused, and Form.io's explanation from the response body as any other API error does, and SHALL name `project logout --base-url <deployment>` followed by a retry as the way to continue as another account. When `/current` does not answer 2xx, the 401 SHALL trigger re-authentication and a single retry of the original request.

#### Scenario: 401 with a token the deployment still accepts

- **WHEN** the Form.io API responds with status 401, `config.jwt` is set, and `{baseUrl}/current` answers 200 for that token with `data.email` `ann@example.com`
- **THEN** `formioFetch` throws a `FORBIDDEN` error with status 401 naming `ann@example.com` and the request URL
- **AND** the message names the `project logout --base-url` command for that deployment and says to retry, which signs in again
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

### Requirement: Every request stays under the Project URL

`formioFetch` SHALL build the request URL from the resolved Project URL and the given path, and SHALL refuse to send it unless the built URL has the same origin as the Project URL and its pathname begins with the Project URL's pathname followed by `/` (or equals it). A refusal SHALL throw an error naming the path it was given and the Project URL it must stay under, and no request SHALL be made. The check SHALL run after query parameters are applied and before any auth header is built, so it holds for every caller, including any caller that does not pass through the tool-argument rule.

#### Scenario: A path under a hosted project is sent

- **WHEN** `formioFetch` is called with path `user/login` and Project URL `https://examples.form.io`
- **THEN** the request is sent to `https://examples.form.io/user/login`

#### Scenario: A path under a sub-directory project is sent

- **WHEN** `formioFetch` is called with path `form/65a1b2c3d4e5f60718293a4b` and Project URL `https://forms.mysite.com/myproject`
- **THEN** the request is sent to `https://forms.mysite.com/myproject/form/65a1b2c3d4e5f60718293a4b`

#### Scenario: A path that resolves to another origin is refused

- **WHEN** `formioFetch` is called with path `https://example.com/x` and Project URL `https://examples.form.io`
- **THEN** it throws naming the path and `https://examples.form.io`
- **AND** no request is sent

#### Scenario: A path that resolves outside a sub-directory project is refused

- **WHEN** `formioFetch` is called with path `../otherproject/form` and Project URL `https://forms.mysite.com/myproject`
- **THEN** it throws naming the path and `https://forms.mysite.com/myproject`
- **AND** no request is sent

#### Scenario: A sibling path that shares the project's prefix is refused

- **WHEN** the built URL is `https://forms.mysite.com/myproject2/form` and the Project URL is `https://forms.mysite.com/myproject`
- **THEN** it throws and no request is sent

### Requirement: Redirects are reported, not followed

Every request that carries a credential — `formioFetch`, `formioRawFetch`, and token validation — SHALL be sent with redirects not followed, so a 3xx response never re-sends the request, with its `x-jwt-token` or `x-token` header, to the location it names. A 3xx response SHALL be reported as an error naming the status, the request URL, and the location it pointed to.

#### Scenario: A redirect is not followed

- **WHEN** a request under the Project URL receives `302` with `Location: https://other.example/`
- **THEN** exactly one request is sent
- **AND** the error names `302` and `https://other.example/`

#### Scenario: Token validation does not follow a redirect

- **WHEN** `validateToken` receives a `302`
- **THEN** it returns false and sends no second request

### Requirement: Every Form.io request has a timeout

Every request the client sends to a Form.io deployment SHALL be aborted when it has not completed within its timeout: 60 seconds by default, or the number of seconds `FORMIO_REQUEST_TIMEOUT` names when it is set. `project_import` and `project_export` SHALL wait the larger of 300 seconds and that configured timeout, so the variable can lengthen a template transfer but never shorten it. A caller-supplied `signal` SHALL still abort the request. A request aborted by its timeout SHALL fail with code `NETWORK_ERROR` and a message naming the URL and the number of seconds waited; for `project_import` the message SHALL add that the import may still complete on the server and to check with `project_export` before retrying.

#### Scenario: A deployment that never answers

- **WHEN** a `form_get` request receives no response within 60 seconds
- **THEN** the tool returns `NETWORK_ERROR` naming the URL and "60 seconds"

#### Scenario: Import gets longer

- **WHEN** `project_import` runs for 120 seconds and then completes
- **THEN** the import succeeds

#### Scenario: The default is configurable

- **WHEN** `FORMIO_REQUEST_TIMEOUT` is `5` and a request receives no response within 5 seconds
- **THEN** the tool returns `NETWORK_ERROR` naming "5 seconds"

#### Scenario: The variable lengthens a transfer

- **WHEN** `FORMIO_REQUEST_TIMEOUT` is `600`
- **THEN** `project_import` and `project_export` wait 600 seconds

#### Scenario: The variable does not shorten a transfer

- **WHEN** `FORMIO_REQUEST_TIMEOUT` is `5`
- **THEN** `project_import` and `project_export` wait 300 seconds

#### Scenario: An import that timed out

- **WHEN** `project_import` receives no response within its timeout
- **THEN** the tool returns `NETWORK_ERROR` naming the URL and the wait
- **AND** the message says the import may still complete on the server and to check with `project_export` before retrying

