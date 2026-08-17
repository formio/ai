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

The `formioFetch` function SHALL throw a descriptive error when the API returns a non-OK response. In JWT mode, a 401 response SHALL trigger re-authentication and a single retry of the original request.

#### Scenario: 401 in JWT mode triggers re-auth and retry

- **WHEN** the Form.io API responds with status 401 and `config.jwt` is set
- **THEN** `formioFetch` triggers the login flow to get a new JWT
- **AND** retries the original request with the new JWT
- **AND** returns the result of the retry

#### Scenario: 401 retry also fails

- **WHEN** the original request returns 401, re-auth succeeds, but the retry also returns 401
- **THEN** `formioFetch` throws an error containing the status code (no infinite retry loop)

#### Scenario: 401 in API key mode throws without retry

- **WHEN** the Form.io API responds with status 401 and `config.apiKey` is set (no JWT)
- **THEN** `formioFetch` throws an error containing the status code without attempting re-auth

#### Scenario: API returns 400 Bad Request

- **WHEN** the Form.io API responds with status 400
- **THEN** `formioFetch` throws an error containing the status code
