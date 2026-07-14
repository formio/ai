## MODIFIED Requirements

### Requirement: Authenticated requests to Form.io API

The `formioFetch` function SHALL send requests with the appropriate auth header based on the config's auth mode. If `config.jwt` is set, it SHALL use `x-jwt-token`. If `config.apiKey` is set, it SHALL use `x-token`. The function SHALL support GET, POST, and PUT requests with JSON body serialization, and SHALL additionally accept a `FormData` body for multipart uploads: a `FormData` body is passed to `fetch` unserialized and NO explicit `Content-Type` header is set (the fetch implementation writes the multipart boundary). JSON body behavior is unchanged.

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

#### Scenario: POST request with FormData body

- **WHEN** `formioFetch` is called with method `"POST"` and a `FormData` body
- **THEN** it sends the `FormData` as the request body without JSON serialization
- **AND** it does NOT set a `Content-Type: application/json` header (the multipart boundary is set by the fetch implementation)
- **AND** the auth header is attached as usual

#### Scenario: 401 during a FormData request re-authenticates and retries once

- **WHEN** a `FormData` request in JWT mode receives a 401
- **THEN** the client re-authenticates and retries the request once, re-sending the same `FormData` body

#### Scenario: No auth credentials available

- **WHEN** `formioFetch` is called with a config that has neither `jwt` nor `apiKey`
- **THEN** it throws an error indicating no authentication credentials are available
