## ADDED Requirements

### Requirement: project_tag_list reports the project's version and its tags

The `project_tag_list` tool SHALL report, for the project `cwd` resolves to, its current version (the project's `tag` field) and every version tag of its project family — name, description, and creation time — newest first, read from `GET {projectUrl}/tag`, which omits the stored templates. With `compare: true` it SHALL also export the project, fetch the current tag's stored template, and report which roles, resources, forms, and actions were added, removed, or changed since that tag, compared by machine name (Form.io's exporter carries only design fields). When the current version has no stored tag — a deploy from a template sets it without one, and deleting a tag leaves it — `compare: true` SHALL return the listing with a `comparison` message saying so, not an error. A project whose current version is the default `0.0.0` with no tags SHALL report no current tag. The tool SHALL be annotated read-only.

#### Scenario: Current version and tags are listed

- **WHEN** `project_tag_list` is called for a project at tag `1.2.0` with tags `1.0.0`, `1.1.0`, `1.2.0`
- **THEN** it reports `current: "1.2.0"` and the three tags newest first, each with its description

#### Scenario: Changes since the current tag are reported

- **WHEN** `project_tag_list` is called with `compare: true` and a form was added in the portal since `1.2.0`
- **THEN** the report lists that form as added since `1.2.0`

#### Scenario: A current version with no stored tag

- **WHEN** the project's `tag` is `1.4.0` and no tag document `1.4.0` exists
- **THEN** `compare: true` returns the listing and a comparison message naming `1.4.0`, not an error

#### Scenario: A project never tagged

- **WHEN** the project's tag is `0.0.0` and the family has no tags
- **THEN** the report names no current tag and an empty list, and `compare: true` reports that there is no tag to compare against

### Requirement: project_tag_create snapshots the project as a semver version

The `project_tag_create` tool SHALL take `tag` — a semver version (`MAJOR.MINOR.PATCH` with an optional pre-release), at most 32 characters — and a required `description` of at most 256 characters, and SHALL `POST {projectUrl}/tag` with them, so Form.io snapshots the project's current export under that name and sets the project's current version to it. It SHALL return the tag's name, description, and creation time, not the stored template. A name already used in the project family SHALL be reported as `VALIDATION_FAILED` naming the tag. The tool SHALL be annotated as a write that adds and does not overwrite.

#### Scenario: A tag is created

- **WHEN** `project_tag_create` is called with `tag: "1.3.0"` and a description
- **THEN** it posts both to `{projectUrl}/tag` and returns the created tag without its template

#### Scenario: A non-semver name is refused before any request

- **WHEN** `project_tag_create` is called with `tag: "release-3"`
- **THEN** it returns `INVALID_ARGUMENT` and makes no request

### Requirement: The version tools fit the tool-list budget

With `project_tag_list` and `project_tag_create` registered and `project_export`'s `tag` argument added, the serialized `tools/list` response SHALL remain within the budget the `tool-description-budget` capability sets.

#### Scenario: Budget holds

- **WHEN** the tool-description budget test serializes `tools/list`
- **THEN** it is within the budget
