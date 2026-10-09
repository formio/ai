## ADDED Requirements

### Requirement: form_list pages forms and filters by tags

`form_list` SHALL take `cwd`, an optional `type` (`form` or `resource`), an optional `tags` array, and the shared list arguments, and SHALL return the shared list result of form summaries. `tags` SHALL match forms that carry every given tag.

#### Scenario: Two tags

- **WHEN** `form_list` is called with `tags: ["crm", "intake"]`
- **THEN** the request filters with `tags__all=crm,intake`
- **AND** only forms carrying both tags are returned

## REMOVED Requirements

### Requirement: form_list retrieves form summaries

**Reason**: Replaced by the shared list contract (default limit 100, `total`, `hasMore`) and the all-tags filter.
**Migration**: Read `total` and `hasMore` instead of `count`; page with `skip`.
