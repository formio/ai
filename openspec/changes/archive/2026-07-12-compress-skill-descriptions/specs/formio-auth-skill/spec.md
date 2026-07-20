## MODIFIED Requirements

### Requirement: Activation description uses the three-clause router template

`plugin/skills/formio-auth/SKILL.md`'s `description` SHALL contain three discrete clauses in order: (1) a capability statement, (2) a "Use when the user asks to …" trigger clause, and (3) a "Not for: …" negative-trigger clause that explicitly disambiguates `formio-auth` from `formio-resource-planner`, `formio-application`, `formio-api`, `formio-angular`, and `formio-actions` — with `formio-actions` cited for per-form action JSON mechanics (action settings, priorities, conditions, handler/method combinations), while `formio-auth` keeps the auth architecture (SSO, Token Swap, Custom JWT, JWT/session mechanics, 2FA, RBAC tuning).

#### Scenario: Description contains the trigger clause

- **WHEN** the SKILL.md frontmatter is read
- **THEN** the `description` SHALL contain the phrase `Use when` (case-insensitive)

#### Scenario: Description contains the negative-trigger clause

- **WHEN** the SKILL.md frontmatter is read
- **THEN** the `description` SHALL contain the phrase `Not for` (case-insensitive)
- **AND** the negative-trigger clause SHALL name `formio-resource-planner` and at least one of `formio-application` / `formio-api` / `formio-angular`

#### Scenario: Negative clause names formio-actions

- **WHEN** the SKILL.md frontmatter is read
- **THEN** the `Not for:` clause SHALL name the backtick-delimited `` `formio-actions` `` for per-form action JSON mechanics
