## ADDED Requirements

### Requirement: Shipped markdown names no repository path

No markdown file under `plugin/skills/` SHALL contain `plugin/skills/`. A file another file must load, or a link between skills, SHALL be a path relative to the file that names it, because an installed skill lives outside this repository's layout.

#### Scenario: Repository prefix is refused

- **WHEN** every markdown file under `plugin/skills/` is searched for `plugin/skills/`
- **THEN** no match is found

