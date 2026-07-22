## ADDED Requirements

### Requirement: form_get supports fetching the current draft

`form_get` SHALL accept an optional `draft: true` parameter. When set, the tool SHALL request `/{base}/draft` (where `{base}` is `form/{id}` for a Mongo ObjectId or the path alias). The endpoint falls back to the live form when no draft exists; the tool SHALL detect this by checking `_vid === 'draft'` on the response and SHALL throw a "no draft exists" error otherwise.

#### Scenario: Fetch existing draft

- **WHEN** `form_get` is called with `formIdOrPath: "67890abcdef012345678abcd"` and `draft: true` and the response has `_vid: 'draft'`
- **THEN** the tool returns the draft body as MCP text content

#### Scenario: No draft exists

- **WHEN** `form_get` is called with `draft: true` and the response has `_vid !== 'draft'`
- **THEN** the tool throws an error instructing the caller to create one via `form_update` with `draft: true`
