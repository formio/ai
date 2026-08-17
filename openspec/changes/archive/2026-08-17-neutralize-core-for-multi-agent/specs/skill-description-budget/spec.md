## MODIFIED Requirements

### Requirement: Every top-level skill description fits the 1,024-character budget

Every direct-child skill of the library — each `plugin/skills/*/SKILL.md` — SHALL have a frontmatter `description` whose whitespace-normalized length (whitespace runs collapsed to single spaces) is at most 1,024 characters. Rationale: the agent's skill listing truncates long descriptions (observed at ~1,535 characters), and the library's `Not for:` routing clauses sit last — the budget guarantees they are always visible. The same 1,024-character limit is the Agent Skills specification's hard maximum.

Nested sub-skill files (e.g., `plugin/skills/formio-angular/formio-angular-resources/SKILL.md`) are no longer exempt from the limit; they are covered by the library-wide `agent-skills-conformance` suite, which applies the same 1,024-character rule to every `SKILL.md` recursively. Non-Claude clients discover nested skills by recursive directory scan, so an over-budget nested description is a specification violation there rather than a harmless file loaded by path.

#### Scenario: All bundled descriptions under budget

- **WHEN** every `plugin/skills/*/SKILL.md` frontmatter is parsed
- **THEN** each `description`, whitespace-normalized, is ≤ 1,024 characters

#### Scenario: A new skill over budget fails the suite

- **WHEN** a skill is added whose description exceeds the budget
- **THEN** the description-budget test suite fails, naming the skill and its measured length

#### Scenario: Nested sub-skill descriptions are also bounded

- **WHEN** `plugin/skills/formio-angular/formio-angular-resources/SKILL.md` is parsed
- **THEN** its `description`, whitespace-normalized, is ≤ 1,024 characters

### Requirement: A structural test suite enforces the budget library-wide

The repository SHALL contain a test suite under `packages/skill-tests/src/skill-descriptions/` that scans every top-level `plugin/skills/*/SKILL.md`, asserts the budget and the `Not for:` presence, and locks the resolved trigger collisions in place (collision guards for the planner/application, form/form-builder, schema bare-noun, and actions/auth boundaries, each asserting backtick-delimited names where the two names could be confused — `formio-form` vs `formio-form-builder` in particular).

The suite's skill enumeration helper SHALL expose both scopes: the top-level set used by the routing and collision assertions, and a recursive set covering every `SKILL.md` in the library, used by the budget assertion and by the `agent-skills-conformance` suite. Neither scope SHALL be derived by listing directories that happen to be one level deep only.

#### Scenario: Suite runs in pnpm test

- **WHEN** `pnpm test` runs
- **THEN** the `skill-descriptions` suite executes the budget scan and the collision guards
- **AND** all assertions pass against the current library

#### Scenario: Recursive enumeration finds nested skills

- **WHEN** the enumeration helper's recursive scope is evaluated
- **THEN** it includes `plugin/skills/formio-angular/formio-angular-resources/SKILL.md`
- **AND** it includes every top-level `plugin/skills/*/SKILL.md`
