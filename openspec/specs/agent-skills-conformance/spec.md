# agent-skills-conformance Specification

## Purpose
Defines the Agent Skills specification conformance every `SKILL.md` in the library must meet, and requires the checks that prove it to run in CI on every pull request.
## Requirements
### Requirement: Every SKILL.md in the library conforms to the Agent Skills specification

The repository SHALL contain a test suite that discovers **every** `SKILL.md` under `plugin/skills/` — recursively, including nested sub-skills — and asserts each one against the Agent Skills open standard:

- `name` is present, 1–64 characters, and contains only lowercase `a-z`, `0-9`, and single hyphens, with no leading, trailing, or consecutive hyphens.
- `name` equals the name of the directory containing the `SKILL.md`.
- `description` is present, non-empty, and at most 1,024 characters when whitespace-normalized.
- Every frontmatter key is drawn from the specification's set: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`.

The suite SHALL name the offending file and the violated rule on failure. It SHALL run as part of `pnpm test`.

#### Scenario: Suite runs under pnpm test

- **WHEN** `pnpm test` runs
- **THEN** the Agent Skills conformance suite executes over every `SKILL.md` under `plugin/skills/`
- **AND** all assertions pass against the current library

#### Scenario: Nested sub-skills are covered

- **WHEN** the suite enumerates skills
- **THEN** `plugin/skills/formio-angular/formio-angular-resources/SKILL.md` is included in the set under test

#### Scenario: Name/directory mismatch fails

- **WHEN** a `SKILL.md` declares `name: formio-widget` inside a directory named `widget`
- **THEN** the suite fails, naming the file, the declared name, and the directory name

#### Scenario: Invalid name charset fails

- **WHEN** a `SKILL.md` declares `name: Formio_Widget`
- **THEN** the suite fails, naming the charset rule

#### Scenario: Over-budget description fails

- **WHEN** a `SKILL.md` description exceeds 1,024 whitespace-normalized characters
- **THEN** the suite fails, naming the file and its measured length

#### Scenario: Unknown frontmatter key fails

- **WHEN** a `SKILL.md` frontmatter contains a key outside the specification's set, such as `model` or `tools`
- **THEN** the suite fails, naming the file and the unexpected key

### Requirement: Conformance checks run in CI on every pull request

The CI workflow SHALL execute the conformance suite on every pull request, via the existing `pnpm test` step, so a non-conformant skill cannot merge. The suite SHALL NOT require any tool outside the repository's existing dev dependencies — no external validator binary, no additional language runtime.

#### Scenario: A non-conformant skill blocks CI

- **WHEN** a pull request adds a skill whose directory name does not match its declared `name`
- **THEN** the CI `Test` step fails

#### Scenario: No new toolchain is required

- **WHEN** CI runs on a clean checkout with `pnpm install --frozen-lockfile`
- **THEN** the conformance suite runs without installing any additional runtime or binary

