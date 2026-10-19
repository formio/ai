## ADDED Requirements

### Requirement: setToken MUST be documented as resolving the signed-in user

`references/auth.md` and `references/setup.md` SHALL type `setToken(token)` as `Promise<User | null>` — it installs the token and returns `currentUser()`, so it resolves the user the token signs in and rejects when the server refuses the token — and `setToken(null)` as `Promise<null>`. Neither SHALL type `setToken` as `Promise<void>`.

#### Scenario: setToken signature resolves the user

- **WHEN** `auth.md` or `setup.md` is read
- **THEN** it types `setToken(token: string, …)` as `Promise<User | null>` and `setToken(null)` as `Promise<null>`
