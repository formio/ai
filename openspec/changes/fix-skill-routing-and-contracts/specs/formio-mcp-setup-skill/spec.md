## ADDED Requirements

### Requirement: The description routes Form.io login correctly

`formio-mcp-setup`'s frontmatter `description` SHALL state that logging in to Form.io needs no skill — the server opens the login in the browser on the first tool call — and SHALL name `formio-auth` only for an application's end-user authentication.

#### Scenario: Login is not routed to formio-auth

- **WHEN** the `formio-mcp-setup` description is read
- **THEN** it does not say "authenticating to Form.io (see `formio-auth`)"
- **AND** it states that the login opens on the first tool call

