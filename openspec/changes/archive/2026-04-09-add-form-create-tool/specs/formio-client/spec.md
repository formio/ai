## MODIFIED Requirements

### Requirement: Authenticated requests to Form.io API

The `formioFetch` function SHALL support GET and POST requests. For POST requests, it SHALL serialize the body as JSON and set the `Content-Type: application/json` header.

#### Scenario: Simple GET request

- **WHEN** `formioFetch` is called with path `/form` and no method specified
- **THEN** it sends a GET request to `{projectUrl}/form` with header `x-token: {apiKey}` and returns the parsed JSON response

#### Scenario: GET request with query parameters

- **WHEN** `formioFetch` is called with path `/form` and params `{ limit: "10", type: "form" }`
- **THEN** the request URL includes `?limit=10&type=form`

#### Scenario: Empty params are omitted

- **WHEN** `formioFetch` is called with params containing undefined values
- **THEN** those parameters are not included in the query string

#### Scenario: POST request with JSON body

- **WHEN** `formioFetch` is called with path `/form`, method `"POST"`, and a body object
- **THEN** it sends a POST request with `Content-Type: application/json`, the serialized body, and `x-token` header
- **AND** returns the parsed JSON response

### Requirement: HTTP error handling

The `formioFetch` function SHALL throw a descriptive error when the API returns a non-OK response.

#### Scenario: API returns 401 Unauthorized

- **WHEN** the Form.io API responds with status 401
- **THEN** `formioFetch` throws an error containing the status code

#### Scenario: API returns 400 Bad Request

- **WHEN** the Form.io API responds with status 400
- **THEN** `formioFetch` throws an error containing the status code
