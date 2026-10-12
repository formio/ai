## ADDED Requirements

### Requirement: The URL-values paragraph agrees with project-urls.md

Every copy of the "Where these two values come from" paragraph under `plugin/skills/` SHALL be identical, and SHALL state the derivation rule `references/project-urls.md` owns: the Base URL is derived from the Project URL wherever that is possible, and a Project URL is never built from a Base URL. No copy SHALL say both that the Base URL is derived from the Project URL and that neither URL is derived from the other.

#### Scenario: Copies are identical and consistent

- **WHEN** every paragraph beginning "**Where these two values come from.**" is collected
- **THEN** all copies are identical apart from the relative link to `project-urls.md`
- **AND** none contains "do not derive either URL from the other"
