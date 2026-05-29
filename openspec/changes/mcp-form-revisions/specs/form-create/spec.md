## ADDED Requirements

### Requirement: form_create defaults revisions to 'original' on licensed deployments

On a licensed deployment, `form_create` SHALL default the POST body to `revisions: 'original'` when the caller does not specify `revisions`. A caller-supplied `revisions` value SHALL override the default. On an unlicensed deployment, `revisions` SHALL be stripped from the body and the license gate SHALL prompt once per `baseUrl`.

#### Scenario: Licensed default

- **WHEN** `form_create` is called on a licensed deployment with `form: { title, name, path, components: [] }` (no `revisions`)
- **THEN** the POST body contains `revisions: 'original'`

#### Scenario: Caller override

- **WHEN** `form_create` is called with `form: { ..., revisions: 'current' }` on a licensed deployment
- **THEN** the POST body contains `revisions: 'current'`

#### Scenario: Unlicensed strips revisions

- **WHEN** `form_create` is called on an unlicensed deployment after the user consents to continue
- **THEN** the POST body does not include `revisions`

### Requirement: form_create persists the note as _vnote

When `note` is provided, `form_create` SHALL include `_vnote` in the POST body prefixed with `@formio/mcp:`.

#### Scenario: Note prefixed

- **WHEN** `form_create` is called with `note: "initial"`
- **THEN** the POST body's `_vnote` equals `@formio/mcp: initial`
