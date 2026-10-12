# skill-routing-evals Specification

## Purpose

How the library measures which skill a request reaches: a trigger-prompt eval over every registered skill's live description, run before and after any change to a description or to cross-skill routing prose.

## Requirements
### Requirement: A routing eval measures which skill a request reaches

`packages/skill-tests/evals/skill-routing/` SHALL hold an eval harness following the repository's harness layout: `evals.json` with trigger prompts, each naming the skill it should reach (or `none`) and any skill it must not reach; `grade.py`, which reads each run's chosen skill from `.eval-artifacts/skill-routing/iteration-N/` and writes `grading.json`; and `README.md`, the runbook. A run presents a grader subagent with the frontmatter `description` of every registered skill under `plugin/skills/` — read at run time, never copied into the harness — and one prompt, and records the skill it would activate. The prompt set SHALL cover every routing boundary this library draws: build-an-app with and without a named framework and with and without an existing plan, extension of an existing workspace, embedding a form, standalone form creation, data-model-only planning, endpoint lookups, SDK calls, schema questions, per-form actions, application auth, and MCP setup and login.

#### Scenario: Harness layout

- **WHEN** `packages/skill-tests/evals/skill-routing/` is listed
- **THEN** it contains `evals.json`, `grade.py`, and `README.md`
- **AND** `evals.json` names, for each prompt, the expected skill

#### Scenario: Descriptions are read at run time

- **WHEN** `grade.py` and `README.md` are read
- **THEN** neither contains a copy of any skill's description

### Requirement: Routing changes do not regress the routing eval

A change to a skill `description` or to cross-skill routing prose SHALL record the routing eval's pass rate on the base commit and on the change, in the change's `design.md`; no prompt that passed on the base SHALL fail on the change. A prompt the change is meant to fix SHALL pass on the change.

#### Scenario: Baseline and result recorded

- **WHEN** this change's `design.md` is read after implementation
- **THEN** it records the routing eval's pass rate on `main` before any edit and on the finished change
- **AND** every prompt that passed on `main` passes on the change

