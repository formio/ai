## ADDED Requirements

### Requirement: Every top-level skill description fits the 1,024-character budget

Every direct-child skill of the library — each `plugin/skills/*/SKILL.md` — SHALL have a frontmatter `description` whose whitespace-normalized length (whitespace runs collapsed to single spaces) is at most 1,024 characters. Nested sub-skill files loaded by path rather than registered in the skill list (e.g., `plugin/skills/formio-angular/resources/SKILL.md`) are exempt. Rationale: the agent's skill listing truncates long descriptions (observed at ~1,535 characters), and the library's `Not for:` routing clauses sit last — the budget guarantees they are always visible.

#### Scenario: All bundled descriptions under budget

- **WHEN** every `plugin/skills/*/SKILL.md` frontmatter is parsed
- **THEN** each `description`, whitespace-normalized, is ≤ 1,024 characters

#### Scenario: A new skill over budget fails the suite

- **WHEN** a skill is added whose description exceeds the budget
- **THEN** the description-budget test suite fails, naming the skill and its measured length

### Requirement: Descriptions carry routing content only — no body content

Each top-level skill description SHALL consist of: a capability statement (one to two sentences), a trigger clause containing quoted example phrases, an optional boundary rule, and a `Not for:` clause naming sibling skills backticked. Descriptions SHALL NOT contain phase or step narrations, shell commands, URLs to external resources, or exhaustive API-method inventories — that content belongs in the SKILL.md body, which loads on activation.

#### Scenario: Not for clause present on every skill

- **WHEN** every `plugin/skills/*/SKILL.md` frontmatter is parsed
- **THEN** each `description` contains the substring `Not for`

#### Scenario: No flow narration in descriptions

- **WHEN** any top-level skill description is inspected
- **THEN** it contains no numbered phase/step narration and no fenced or inline shell command invocations

### Requirement: A structural test suite enforces the budget library-wide

The repository SHALL contain a test suite under `packages/skill-tests/src/skill-descriptions/` that scans every top-level `plugin/skills/*/SKILL.md`, asserts the budget and the `Not for:` presence, and locks the resolved trigger collisions in place (collision guards for the planner/application, form/form-builder, schema bare-noun, and actions/auth boundaries, each asserting backtick-delimited names where the two names could be confused — `formio-form` vs `formio-form-builder` in particular).

#### Scenario: Suite runs in pnpm test

- **WHEN** `pnpm test` runs
- **THEN** the `skill-descriptions` suite executes the budget scan and the collision guards
- **AND** all assertions pass against the current library
