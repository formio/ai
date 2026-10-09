## MODIFIED Requirements

### Requirement: API key mode bypasses the login flow

`FORMIO_API_KEY` is issued by one project, so it SHALL apply only to that project: the key SHALL be in effect for a tool call when `FORMIO_PROJECT_URL` is set and the resolved Project URL has the same origin as `FORMIO_PROJECT_URL`. When it is in effect, the authentication gate SHALL validate the key on first use and set no JWT, SHALL NOT open a browser or read/write the token cache, and requests SHALL send the `x-token` header.

When the key is set but not in effect — `FORMIO_PROJECT_URL` is unset, or the resolved project (from a committed `formio.json` or a directory mapping) is on another origin — the resolved configuration SHALL carry no API key, the `x-token` header SHALL NOT be sent, and the gate SHALL run the portal-login flow exactly as it does when no key is set. The `project_get` report SHALL state that `FORMIO_API_KEY` is set but not applied to the resolved project, and name the origin it applies to (or that `FORMIO_PROJECT_URL` is unset).

#### Scenario: Valid API key passes the gate

- **WHEN** `FORMIO_API_KEY` is set
- **AND** `FORMIO_PROJECT_URL` is `https://examples.form.io` and the resolved Project URL is `https://examples.form.io`
- **AND** a tool call triggers the auth gate for the first time
- **AND** `validateToken(config)` returns true
- **THEN** the gate succeeds without touching the token cache or launching a browser
- **AND** `config.jwt` remains undefined
- **AND** subsequent requests send the `x-token` header

#### Scenario: A sub-directory project on the key's origin uses the key

- **WHEN** `FORMIO_API_KEY` is set and `FORMIO_PROJECT_URL` is `https://forms.mysite.com/myproject`
- **AND** the resolved Project URL is `https://forms.mysite.com/myproject`
- **THEN** requests send the `x-token` header and no browser is opened

#### Scenario: A committed project on another origin does not receive the key

- **WHEN** `FORMIO_API_KEY` is set and `FORMIO_PROJECT_URL` is `https://examples.form.io`
- **AND** a committed `formio.json` resolves the Project URL `https://other.form.io`
- **THEN** no request carries the `x-token` header
- **AND** the gate runs the portal-login flow for the resolved deployment

#### Scenario: A key without FORMIO_PROJECT_URL is not applied

- **WHEN** `FORMIO_API_KEY` is set and `FORMIO_PROJECT_URL` is unset
- **AND** a directory mapping resolves a Project URL
- **THEN** no request carries the `x-token` header
- **AND** `project_get` states the key is not applied because `FORMIO_PROJECT_URL` is unset
