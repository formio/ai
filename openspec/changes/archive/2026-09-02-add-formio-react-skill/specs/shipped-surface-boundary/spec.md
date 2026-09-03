## MODIFIED Requirements

### Requirement: Eval harnesses live outside the shipped tree

Each skill's eval harness SHALL live at `packages/skill-tests/evals/<skill>/`, not at `plugin/skills/<skill>/evals/`. It sits beside the repository's other maintainer-facing test tree, in a package that is private and whose `tsconfig` and Vitest globs both scope to `src/`, so the harnesses are inert to type-checking, to the test run, and to publishing. The harness keeps its existing shape — `evals.json`, `grade.py`, `README.md`, and an optional `fixtures/` directory — and keeps writing to the gitignored `.eval-artifacts/<skill>/`.

`<skill>` is the skill's own name, so a nested sub-skill gets a flat harness directory rather than a path mirroring where the skill lives: `packages/skill-tests/evals/formio-react-resources/`, not `packages/skill-tests/evals/formio-react/formio-react-resources/`.

`grade.py` resolves the repository root by counting parents from its own location, so each grader SHALL be corrected for its depth. Every runbook SHALL have its relative paths updated. The convention documented in `CLAUDE.md` SHALL name the location.

#### Scenario: Harnesses live outside the shipped tree, contents intact

- **WHEN** the repository is inspected
- **THEN** `packages/skill-tests/evals/formio-resource-planner/`, `packages/skill-tests/evals/formio-angular-resources/`, and `packages/skill-tests/evals/formio-react-resources/` each contain `evals.json`, `grade.py`, and `README.md`
- **AND** `packages/skill-tests/evals/formio-angular-resources/fixtures/existing-workspace-seed/` is present
- **AND** `packages/skill-tests/evals/formio-react-resources/fixtures/` contains a seed React workspace
- **AND** none of `plugin/skills/formio-resource-planner/evals/`, `plugin/skills/formio-angular/formio-angular-resources/evals/`, or `plugin/skills/formio-react/formio-react-resources/evals/` exists

#### Scenario: Graders still resolve the artifacts directory

- **WHEN** each `grade.py` computes its repository root from `__file__`
- **THEN** the resolved path is the repository root
- **AND** the default artifacts directory is `.eval-artifacts/<skill>/`

#### Scenario: The documented convention matches reality

- **WHEN** `CLAUDE.md`'s "Iterating on skills" section is read
- **THEN** it names `packages/skill-tests/evals/<skill>/` as the harness location
- **AND** it lists the harnesses that exist, including `formio-react-resources`
- **AND** it does not name `skills/<skill>/evals/`
