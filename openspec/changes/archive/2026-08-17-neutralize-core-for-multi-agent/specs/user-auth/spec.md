## ADDED Requirements

### Requirement: Browserless environments fail fast with actionable guidance

Before starting the ephemeral login server, the auth module SHALL determine whether the host can present a browser to the user. When it cannot, the module SHALL throw immediately — without binding a port, without attempting to launch a browser, and without waiting out the login timeout — with an error that names, in this order: setting `FORMIO_API_KEY`, publishing a port with `FORMIO_AUTH_HOST` / `FORMIO_AUTH_PORT` for a container whose host has a browser, and `FORMIO_FORCE_BROWSER=1` to override the detection.

A host SHALL be treated as browserless when any of the following holds:

- `CI` is set to a truthy value.
- `SSH_CONNECTION` or `SSH_TTY` is set and no display variable is set.
- A container is detected — `/.dockerenv` exists, or `container` is set in the environment.

A missing `DISPLAY` / `WAYLAND_DISPLAY` SHALL NOT, on its own, mark a host browserless. An agent launched from a systemd user unit or a pre-existing `tmux` session inherits no display variable while its user still has a browser reachable on loopback, and this check runs before the port is bound — so treating it as browserless withholds the login URL that would otherwise be printed to stderr. The environments where the browser genuinely is elsewhere each carry one of the signals above; the display variable only ever corroborates the remote-shell case.

The container and remote-shell cases both ask whether THIS host can open a browser. Publishing the login endpoint answers a different and sufficient question — the browser is on the user's machine and can reach this one — and it is the remedy the error itself recommends. When BOTH `FORMIO_AUTH_HOST` and `FORMIO_AUTH_PORT` are set, neither case SHALL be treated as browserless. `CI` is unaffected: no user is watching a runner, whatever it publishes.

`FORMIO_FORCE_BROWSER=1` SHALL suppress the detection entirely and proceed with the normal login flow. `FORMIO_API_KEY` mode never reaches this check, because the login flow is not entered at all.

#### Scenario: CI fails fast instead of waiting for a browser

- **WHEN** `CI` is `true`, `FORMIO_API_KEY` is unset, and a tool call triggers the login flow
- **THEN** the call fails immediately with an error naming `FORMIO_API_KEY`
- **AND** no Express server is started and no browser launch is attempted
- **AND** the error is returned as a tool error with the server still connected

#### Scenario: A displayless host keeps its login URL

- **WHEN** neither `DISPLAY` nor `WAYLAND_DISPLAY` is set, no other browserless signal is present, and the login flow is triggered
- **THEN** the login server starts and the login URL is written to stderr, exactly as on a host that advertises a display

#### Scenario: SSH session without a display fails fast

- **WHEN** `SSH_CONNECTION` is set, no display variable is set, and the login flow is triggered
- **THEN** the call fails immediately with the browserless error

#### Scenario: Container is detected

- **WHEN** `/.dockerenv` exists and the login flow is triggered
- **THEN** the call fails immediately with an error naming `FORMIO_AUTH_HOST` and `FORMIO_AUTH_PORT` as the way to complete login from the host's browser

#### Scenario: A published login endpoint proceeds

- **WHEN** a container, a remote shell, or a host with no display server is detected, both `FORMIO_AUTH_HOST` and `FORMIO_AUTH_PORT` are set, and the login flow is triggered
- **THEN** the browserless check does not fire
- **AND** the ephemeral login server starts on that host and port and its URL is written to stderr
- **AND** setting only one of the two still fails fast with the browserless error

#### Scenario: Override proceeds with the normal flow

- **WHEN** `CI` is `true` and `FORMIO_FORCE_BROWSER` is `1`
- **AND** the login flow is triggered
- **THEN** the browserless check does not fire
- **AND** the ephemeral login server starts as usual

#### Scenario: Desktop macOS is not treated as browserless

- **WHEN** the platform is `darwin`, `CI` is unset, no SSH variables are set, and no container is detected
- **THEN** the browserless check does not fire

#### Scenario: API-key mode never reaches the check

- **WHEN** `FORMIO_API_KEY` is set and `CI` is `true`
- **AND** a tool call authenticates
- **THEN** no browserless error is raised and the request proceeds with the `x-token` header

## MODIFIED Requirements

### Requirement: Browser opens automatically to the login page

The auth module SHALL open the user's default browser to `http://localhost:{port}/` when the login flow starts, after the browserless check has passed. When the launch command fails, the module SHALL keep the login server running and instruct the user to open the printed URL manually.

#### Scenario: Browser opens to login URL

- **WHEN** the login flow starts on a host that is not browserless and the Express server is listening
- **THEN** the user's default browser is opened to `http://localhost:{port}/`

#### Scenario: Launch failure leaves a manually openable URL

- **WHEN** the browser launch command exits with an error
- **THEN** the login server keeps listening until the timeout
- **AND** the user is told to open the login URL manually
