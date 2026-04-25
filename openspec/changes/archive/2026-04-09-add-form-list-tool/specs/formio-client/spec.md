## ADDED Requirements

### Requirement: Authenticated GET requests to Form.io API

The `formioFetch` function SHALL construct a full URL from the project base URL and a path, set the `x-token` header from the API key, append query parameters, and return parsed JSON.

#### Scenario: Simple GET request

- **WHEN** `formioFetch` is called with path `/form` and config `{ projectUrl: "https://form.local/example", apiKey: "abc123" }`
- **THEN** it sends a GET request to `https://form.local/example/form` with header `x-token: abc123` and returns the parsed JSON response

#### Scenario: GET request with query parameters

- **WHEN** `formioFetch` is called with path `/form` and params `{ limit: "10", type: "form" }`
- **THEN** the request URL includes `?limit=10&type=form`

#### Scenario: Empty params are omitted

- **WHEN** `formioFetch` is called with params containing undefined values
- **THEN** those parameters are not included in the query string

### Requirement: HTTP error handling

The `formioFetch` function SHALL throw a descriptive error when the API returns a non-OK response.

#### Scenario: API returns 401 Unauthorized

- **WHEN** the Form.io API responds with status 401
- **THEN** `formioFetch` throws an error containing the status code

#### Scenario: API returns 404 Not Found

- **WHEN** the Form.io API responds with status 404
- **THEN** `formioFetch` throws an error containing the status code
