## ADDED Requirements

### Requirement: The shipped tree contains only what a consumer needs

`npx skills add formio/ai` resolves the marketplace manifest's `source` of `./plugin` and copies that tree into the consumer's own project, so every file under `plugin/` is shipped product. `plugin/` SHALL therefore contain only files a developer needs in their project: the skills, the bundled server, the client manifests, and the consumer-facing metadata that accompanies them.

Repository tooling SHALL live outside `plugin/`. This covers anything whose audience is a maintainer of this library rather than a user of it — eval harnesses, graders, benchmark fixtures, and their runbooks.

This boundary is one-directional and deliberate. **The repository's own ergonomics are explicitly not governed by it**: `CLAUDE.md`, `.claude/`, `.cursor/`, `.github/`, `openspec/`, and `docs/` may name and favour any client their maintainers prefer, because a contributor working on this repository is not the audience the boundary protects.

The repository SHALL contain a test enforcing the boundary by allowlist rather than denylist, so a newly added file must be classified deliberately rather than slip through. It SHALL run as part of `pnpm test`.

#### Scenario: Top-level entries are an allowlist

- **WHEN** the immediate children of `plugin/` are enumerated
- **THEN** every one is in the declared allowlist
- **AND** a child not on the list fails the test, naming it

#### Scenario: No eval tooling anywhere beneath the shipped tree

- **WHEN** `plugin/` is searched recursively
- **THEN** no directory named `evals` exists
- **AND** no `grade.py`, `evals.json`, or benchmark fixture is present

#### Scenario: Repository ergonomics are out of scope

- **WHEN** the test runs
- **THEN** it inspects nothing outside `plugin/`
- **AND** files under `.claude/`, `.cursor/`, `.github/`, `openspec/`, and `docs/` are neither read nor asserted against

#### Scenario: Suite runs under pnpm test

- **WHEN** `pnpm test` runs
- **THEN** the shipped-surface boundary test executes
- **AND** it passes against the current tree

### Requirement: Eval harnesses live outside the shipped tree

Each skill's eval harness SHALL live at `packages/skill-tests/evals/<skill>/`, not at `plugin/skills/<skill>/evals/`. It sits beside the repository's other maintainer-facing test tree, in a package that is private and whose `tsconfig` and Vitest globs both scope to `src/`, so the harnesses are inert to type-checking, to the test run, and to publishing. The harness keeps its existing shape — `evals.json`, `grade.py`, `README.md`, and an optional `fixtures/` directory — and keeps writing to the gitignored `.eval-artifacts/<skill>/`.

`grade.py` resolves the repository root by counting parents from its own location, so each grader SHALL be corrected for its new depth. Both runbooks SHALL have their relative paths updated. The convention documented in `CLAUDE.md` SHALL name the new location.

#### Scenario: Harnesses moved, contents intact

- **WHEN** the repository is inspected
- **THEN** `packages/skill-tests/evals/formio-resource-planner/` and `packages/skill-tests/evals/formio-angular-resources/` each contain `evals.json`, `grade.py`, and `README.md`
- **AND** `packages/skill-tests/evals/formio-angular-resources/fixtures/existing-workspace-seed/` is present
- **AND** neither `plugin/skills/formio-resource-planner/evals/` nor `plugin/skills/formio-angular/formio-angular-resources/evals/` exists

#### Scenario: Graders still resolve the artifacts directory

- **WHEN** each `grade.py` computes its repository root from `__file__`
- **THEN** the resolved path is the repository root
- **AND** the default artifacts directory is `.eval-artifacts/<skill>/`

#### Scenario: The documented convention matches reality

- **WHEN** `CLAUDE.md`'s "Iterating on skills" section is read
- **THEN** it names `packages/skill-tests/evals/<skill>/` as the harness location
- **AND** it does not name `skills/<skill>/evals/`

### Requirement: Initiative artifacts stay local, not committed

A planning document written to drive one initiative — an audit, a gap list, a phase plan — and an operational tracker for third-party review queues are both useful to whoever is doing the work and residue to everyone else. Neither SHALL be committed to the public repository. Both MAY exist on a maintainer's disk, and `.gitignore` SHALL keep them out of the tree.

The durable public record of what changed and why is the OpenSpec change set: each phase's proposal states its motivation, its design states the decisions and the alternatives rejected, and the archive preserves both. A committed roadmap duplicates that record and ages into something that reads as current planning.

Because `docs/multi-agent-portability.md` is already tracked, ignoring it is not enough — it SHALL be removed from the index while being left on disk. No tracked file SHALL reference it: where a change artifact needs a fact the roadmap carried — a gap identifier, a risk, a phase boundary — that artifact SHALL state the fact itself, so a fresh clone that lacks the file loses nothing.

#### Scenario: The roadmap is on disk but not in the repository

- **WHEN** the repository index is inspected
- **THEN** `docs/multi-agent-portability.md` is not tracked
- **AND** `.gitignore` covers it
- **AND** removing it from the index did not delete it from disk

#### Scenario: The marketplace tracker is local only

- **WHEN** the repository index is inspected
- **THEN** `MARKETPLACE.md` is not tracked
- **AND** `.gitignore` covers it

#### Scenario: No tracked file points at either

- **WHEN** every tracked file is searched for `multi-agent-portability`
- **THEN** no match is found

#### Scenario: Change artifacts still make sense on their own

- **WHEN** a tracked change artifact that previously cited the roadmap is read
- **THEN** the fact it cited is stated inline
- **AND** the artifact does not depend on an untracked file to be understood
