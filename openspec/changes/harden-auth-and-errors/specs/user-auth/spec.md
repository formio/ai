## ADDED Requirements

### Requirement: The browser is launched detached

The login page SHALL be opened by starting the platform's opener (`open` on macOS, `xdg-open` on Linux, `rundll32.exe url.dll,FileProtocolHandler` on Windows) as a detached process with its standard streams ignored, so the server neither buffers the browser's output nor holds or terminates the browser. A failure to start the opener SHALL be reported on stderr with the login URL. The login URL SHALL be printed on stderr whether or not the launch succeeds.

#### Scenario: A browser that writes a lot of output

- **WHEN** the opener leaves the browser attached and the browser writes more than 1 MB to its output
- **THEN** the browser keeps running and the login completes

#### Scenario: The opener cannot start

- **WHEN** starting the opener fails
- **THEN** stderr names the failure and the login URL

### Requirement: Only a found login form is remembered

The login-form lookup SHALL cache, per deployment, only a login form it found. A lookup that fails or finds none SHALL NOT be cached, so the next login tries again.

#### Scenario: A failed lookup is retried

- **WHEN** a login-form lookup fails and a later login runs for the same deployment
- **THEN** the later login performs the lookup again
