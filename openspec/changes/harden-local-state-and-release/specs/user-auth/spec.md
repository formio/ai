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

### Requirement: The login server answers requests by the host it is bound to

Which requests the local login server answers on `GET /` and `POST /callback` SHALL depend on the host it is bound to:

- Bound to loopback — `FORMIO_AUTH_HOST` unset (the default `127.0.0.1`) or naming `localhost`, `127.0.0.1` or `::1` — it SHALL answer only requests whose `Host` header names `localhost`, `127.0.0.1` or `[::1]` together with the port the server is listening on.
- Bound to every interface — `FORMIO_AUTH_HOST` `0.0.0.0` or `::` — the user has opted into access from another host, and the server SHALL NOT check the `Host` header.
- Bound to a specific other host — it SHALL answer requests whose `Host` header names that host or a loopback name, with any port.

A request refused by these rules SHALL be answered `403` and SHALL NOT end the login. In every case `/callback` SHALL still require the per-login value.

#### Scenario: Loopback binding and another host

- **WHEN** the server is bound to loopback and a request reaches `GET /` or `POST /callback` with a `Host` header naming another host, or a loopback name at another port
- **THEN** it is answered `403`, no token is taken, and the login keeps waiting

#### Scenario: The login page addressed as localhost

- **WHEN** the server is bound to loopback, the browser loads the login page at `http://localhost:<port>/`, and the page posts its token
- **THEN** the page is served and the login completes with that token

#### Scenario: A forwarded port while bound to every interface

- **WHEN** `FORMIO_AUTH_HOST` is `0.0.0.0` and requests arrive with the `Host` header `foo-43117.app.github.dev:443`
- **THEN** the login page is served, a `/callback` post carrying the per-login value completes the login, and a post without the value is answered `403`

#### Scenario: A specific host with a remapped port

- **WHEN** `FORMIO_AUTH_HOST` names `login.example.test` and a request is addressed to `login.example.test` at a port other than the one the server listens on
- **THEN** it is answered as a request addressed to the server
