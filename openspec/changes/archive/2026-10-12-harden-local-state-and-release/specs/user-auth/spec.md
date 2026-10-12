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

### Requirement: Browser opens automatically to the login page

The auth module SHALL open the user's default browser to the login URL — `http://<host>:<port>/?s=<per-login value>` — when the login flow starts, after the browserless check has passed, and SHALL print that URL on stderr. When the launch command fails, the module SHALL keep the login server running and instruct the user to open the printed URL manually.

#### Scenario: Browser opens to login URL

- **WHEN** the login flow starts on a host that is not browserless and the Express server is listening
- **THEN** the user's default browser is opened to `http://127.0.0.1:{port}/?s=<per-login value>`

#### Scenario: Launch failure leaves a manually openable URL

- **WHEN** the browser launch command exits with an error
- **THEN** the login server keeps listening until the timeout
- **AND** the user is told to open the login URL manually

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

### Requirement: The login page is served only for the login URL

Each login's value SHALL travel in the login URL the server opens and prints, as its `s` query parameter: `http://<host>:<port>/?s=<value>`, where `<host>` is `FORMIO_AUTH_HOST` (`127.0.0.1` when it is unset or names every interface) and `<port>` the port the server listens on. `GET /` SHALL serve the login page only when its `s` parameter matches this login's value, compared in constant time; any other request SHALL be answered `403` with a short page that does not carry the value, and SHALL NOT end the login. The page SHALL post the same value to `/callback` with the token. Nothing else about a request, such as its `Host` header, SHALL decide whether it is answered.

#### Scenario: The login URL

- **WHEN** a login starts
- **THEN** the URL the browser is opened to, and the URL printed on stderr, both carry the login's value as `s`

#### Scenario: A request without the value

- **WHEN** a request reaches `GET /` without `s`, with a different value, or with `s` given more than once
- **THEN** it is answered `403` with a page that does not carry the value, and the login keeps waiting

#### Scenario: A forwarded port

- **WHEN** a request for the login URL reaches the server with the `Host` header `foo-41000.app.github.dev:443`, under a name and port the server does not listen on
- **THEN** the login page is served, the page's post to `/callback` completes the login, and a post without the value is answered `403`
