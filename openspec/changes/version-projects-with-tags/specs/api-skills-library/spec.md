## ADDED Requirements

### Requirement: platform-staging.md documents versions and deploy as the server implements them

`plugin/skills/formio-api/references/platform-staging.md` SHALL document that version tags are shared across a project family, that `POST {projectUrl}/tag` snapshots the project's current export when no `template` is sent and sets the project's `tag`, that `GET {projectUrl}/tag/current` reports a project's current version, that `POST {projectUrl}/deploy` accepts `{ type: 'tag', tag }` as well as `{ type: 'template', template }` and runs the project importer, and that its MCP Tool Preference names `project_tag_list`, `project_tag_create`, and `project_export` with `tag`. It SHALL NOT claim a 409 for a protected stage.

#### Scenario: No 409 claim

- **WHEN** `platform-staging.md` is searched for `409`
- **THEN** no match is found

#### Scenario: Version tools named

- **WHEN** its `## MCP Tool Preference` section is read
- **THEN** it names `project_tag_list` and `project_tag_create`
