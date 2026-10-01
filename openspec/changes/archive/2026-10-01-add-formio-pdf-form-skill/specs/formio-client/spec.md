## ADDED Requirements

### Requirement: formioFetch accepts a FormData body

`formioFetch` SHALL accept a `FormData` value as `body`. A `FormData` body SHALL be passed to `fetch` unserialized and SHALL NOT be given a `Content-Type` header, so the fetch implementation writes the multipart boundary. JSON bodies SHALL behave exactly as before. The 401 re-authentication retry SHALL apply to `FormData` requests and re-send the same `FormData` instance. `FormioFetchOptions.body` SHALL be typed without `any`.

#### Scenario: FormData sent unserialized

- **WHEN** `formioFetch` is called with method `"POST"` and a `FormData` body
- **THEN** `fetch` receives that `FormData` instance as its body
- **AND** no `Content-Type` header is set by the client
- **AND** the auth header is attached as usual

#### Scenario: JSON unchanged

- **WHEN** `formioFetch` is called with a plain object body
- **THEN** it sends `Content-Type: application/json` and the serialized body, as before

#### Scenario: 401 retry re-sends the FormData

- **WHEN** a `FormData` request in JWT mode receives a 401
- **THEN** the client re-authenticates and retries once with the same `FormData` instance
