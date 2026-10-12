## MODIFIED Requirements

### Requirement: JWT is captured via callback after successful login

On successful form submission, the login page SHALL read the JWT from `Formio.getToken()` and POST it to `/callback` on the same localhost server, together with the per-login value the page was served. The callback SHALL resolve a promise with the JWT when that value matches.

#### Scenario: Successful login posts JWT to callback

- **WHEN** the user successfully submits the login form
- **THEN** the page reads `Formio.getToken()` and sends `POST /callback` with `{ "token": "<jwt>", "state": "<per-login value>" }`
- **AND** the callback responds with a "you can close this tab" message

#### Scenario: Login flow resolves with the JWT

- **WHEN** the `/callback` endpoint receives a valid JWT with the matching per-login value
- **THEN** the authenticate function resolves with the JWT string

## ADDED Requirements

### Requirement: The login callback accepts only the post its page was served for

Each login SHALL generate a random value of at least 128 bits and embed it in the login page it serves. The page SHALL send that value with the token, and `/callback` SHALL accept the token only when the value matches. A post with a missing or different value SHALL be answered `403` and SHALL NOT end the login; the server SHALL keep waiting for the matching post until the login timeout.

#### Scenario: The page's own post

- **WHEN** the login page posts the token with the value it was served
- **THEN** the login completes with that token

#### Scenario: A post without the value

- **WHEN** a request posts a token to `/callback` without the value, or with a different one
- **THEN** it is answered `403`, the token is not used, and the login keeps waiting

### Requirement: The login-form URL is embedded as a JSON string

The login page SHALL embed the login-form URL in its script as a JSON string literal (`JSON.stringify` of the URL), so that any character a URL may contain is taken as part of the string.

#### Scenario: A URL containing a quote

- **WHEN** the login-form URL contains `'`
- **THEN** the page's script passes the whole URL, unchanged, to `Formio.createForm`
