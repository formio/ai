## MODIFIED Requirements

### Requirement: form_create defaults revisions to 'original' on licensed deployments

On a licensed deployment, `form_create` SHALL default the POST body to `revisions: 'original'` when the caller does not specify `revisions`. A caller-supplied `revisions` value SHALL override the default. On an unlicensed deployment, `revisions` SHALL be stripped from the body, and the create SHALL proceed only when the caller passes `acceptNoHistory: true`; otherwise it SHALL refuse with code `HISTORY_NOT_ACCEPTED` as the `revisions-history-acceptance` capability describes.

#### Scenario: Licensed default

- **WHEN** `form_create` is called on a licensed deployment with `form: { title, name, path, components: [] }` (no `revisions`)
- **THEN** the POST body contains `revisions: 'original'`

#### Scenario: Caller override

- **WHEN** `form_create` is called with `form: { ..., revisions: 'current' }` on a licensed deployment
- **THEN** the POST body contains `revisions: 'current'`

#### Scenario: Unlicensed strips revisions

- **WHEN** `form_create` is called on an unlicensed deployment with `acceptNoHistory: true`
- **THEN** the POST body does not include `revisions`
