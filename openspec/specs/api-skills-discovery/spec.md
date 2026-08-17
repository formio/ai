## Requirements

### Requirement: Router skill is the sole discovery surface

Claude Code's skill loader SHALL discover exactly one Form.io API skill: `plugin/skills/formio-api/SKILL.md`. Reference files under `plugin/skills/formio-api/references/` are NOT standalone skills — they have no frontmatter and are not independently activatable. They are read from the router skill's body via Markdown links.

#### Scenario: Router skill is loaded on plugin startup

- **WHEN** the plugin's skill loader scans `plugin/skills/`
- **THEN** it SHALL register a single Form.io API skill whose `name` is `formio-api`
- **AND** it SHALL NOT register any skill for the files under `formio-api/references/`

### Requirement: Router body MUST link to every required reference group

The router `SKILL.md` body SHALL contain a Markdown link to every file listed in `REQUIRED_REFERENCE_GROUPS`. Link targets SHALL use the relative path shape `./references/<group>.md` (or the equivalent `references/<group>.md`). Links SHALL resolve to real files on disk.

#### Scenario: Router links to all required references

- **WHEN** `plugin/skills/formio-api/SKILL.md` is parsed
- **THEN** for every group in `REQUIRED_REFERENCE_GROUPS`, the body SHALL contain a link matching `](./references/<group>.md)` or `](references/<group>.md)`

#### Scenario: Broken router link fails validation

- **WHEN** the router body links to `./references/<group>.md` but the file does not exist on disk
- **THEN** `validateRouterLinks` SHALL emit an `index.broken_link` issue

### Requirement: Router MUST NOT contain endpoint documentation

The router body SHALL NOT contain endpoint headings of the form `### <METHOD> <path>`. Endpoint documentation lives exclusively in the reference files.

#### Scenario: Router containing an endpoint heading fails validation

- **WHEN** the router body contains a heading matching `^### (GET|POST|PUT|PATCH|DELETE) `
- **THEN** `validateRouterLinks` SHALL emit an `index.no_endpoint_docs` issue
