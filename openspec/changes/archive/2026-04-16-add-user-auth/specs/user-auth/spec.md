## ADDED Requirements

### Requirement: Ephemeral login server starts on a random available port

The auth module SHALL start an Express server on port 0 (OS-assigned) that listens only on localhost. The server SHALL serve a login page at `GET /` and accept a JWT callback at `POST /callback`.

#### Scenario: Server binds to a random port

- **WHEN** the login flow is triggered
- **THEN** an Express server starts listening on localhost with an OS-assigned port
- **AND** the assigned port number is available for constructing the login URL

#### Scenario: Server is accessible only on localhost

- **WHEN** the login server is running
- **THEN** it is bound to `127.0.0.1` and not accessible from external interfaces

### Requirement: Login page renders the project's login form via Form.io SDK

The login page served at `GET /` SHALL load the Form.io JavaScript SDK from CDN and render the project's login form using `Formio.createForm()`. The login form URL SHALL default to `{projectUrl}/user/login` and be overridable via `FORMIO_LOGIN_FORM`.

#### Scenario: Login page renders with default login form

- **WHEN** the login page is served and `FORMIO_LOGIN_FORM` is not set
- **THEN** the page renders the form at `{projectUrl}/user/login` using `Formio.createForm()`

#### Scenario: Login page renders with custom login form

- **WHEN** `FORMIO_LOGIN_FORM` is set to `https://example.form.io/custom/login`
- **THEN** the page renders the form at `https://example.form.io/custom/login`

### Requirement: JWT is captured via callback after successful login

On successful form submission, the login page SHALL read the JWT from `Formio.getToken()` and POST it to `/callback` on the same localhost server. The callback SHALL resolve a promise with the JWT.

#### Scenario: Successful login posts JWT to callback

- **WHEN** the user successfully submits the login form
- **THEN** the page reads `Formio.getToken()` and sends `POST /callback` with `{ "token": "<jwt>" }`
- **AND** the callback responds with a "you can close this tab" message

#### Scenario: Login flow resolves with the JWT

- **WHEN** the `/callback` endpoint receives a valid JWT
- **THEN** the authenticate function resolves with the JWT string

### Requirement: Express server shuts down after capturing the JWT

The ephemeral Express server SHALL shut down immediately after the JWT is captured via the callback.

#### Scenario: Server shuts down after callback

- **WHEN** the `/callback` endpoint receives the JWT
- **THEN** the Express server stops listening and releases the port

### Requirement: Browser opens automatically to the login page

The auth module SHALL open the user's default browser to `http://localhost:{port}/` when the login flow starts.

#### Scenario: Browser opens to login URL

- **WHEN** the login flow starts and the Express server is listening
- **THEN** the user's default browser is opened to `http://localhost:{port}/`
