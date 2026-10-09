## ADDED Requirements

### Requirement: Every paged list tool shares one contract

`form_list`, `role_list`, `action_list` and `form_revision_list` SHALL accept `limit` (positive integer, default 100), `skip` (non-negative integer, default 0), `sort` (Form.io sort string, e.g. `-modified`) and `select` (comma-separated fields), and SHALL send `limit` and `skip` on every request so Form.io's own default page size never applies. Each SHALL return its items plus `total` — the item count Form.io reports in the `Content-Range` header — and `hasMore`, true when `skip + items.length < total`. When Form.io reports no total, the result SHALL omit `total` rather than estimate it, and `hasMore` SHALL be true when the page came back full (`items.length` equal to `limit`); the output schema SHALL declare `total` optional, with a description saying it is absent when Form.io does not report one. A `skip` at or past `total` SHALL return no items with the reported `total`, not an error. The result SHALL NOT carry a `count` field.

#### Scenario: More roles than the default page

- **WHEN** a project has 12 roles and `role_list` is called with no arguments
- **THEN** it returns 12 roles, `total: 12`, `hasMore: false`

#### Scenario: Paging through forms

- **WHEN** a project has 150 forms and `form_list` is called with no arguments
- **THEN** it returns 100 forms, `total: 150`, `hasMore: true`
- **AND WHEN** it is called with `skip: 100`
- **THEN** it returns 50 forms and `hasMore: false`

#### Scenario: Skipping past the end

- **WHEN** `action_list` is called with `skip: 500` on a form with 3 actions
- **THEN** it returns no actions, `total: 3`, `hasMore: false`, and no error

#### Scenario: Form.io reports no total

- **WHEN** a list tool is called with `limit: 2` and Form.io answers with 2 items and no `Content-Range` total
- **THEN** the result carries the 2 items and `hasMore: true`, and no `total`

### Requirement: The action-type catalog is returned whole

`action_type_list` SHALL return every action type the form supports, with `total` equal to the number returned and `hasMore: false`, because Form.io does not page that route. It SHALL accept no paging arguments.

#### Scenario: The full catalog

- **WHEN** `action_type_list` is called for a form
- **THEN** every action type Form.io returns is in the result and `hasMore` is false
