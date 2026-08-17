# Eval regression check — `formio-angular-resources` rename + description trim

Task group 8 of this change. Question: did renaming the sub-skill directory and cutting its `description` from 2,334 to 1,015 characters change how well it performs?

## Method

The harness (`plugin/skills/formio-angular/formio-angular-resources/evals/`) normally compares **skill vs no skill**. This run compares **old skill vs new skill**, so both arms are "with skill" and live in two iteration directories:

| Arm | Skill read from | Directory | Description |
| --- | --- | --- | --- |
| `iteration-before` | `git worktree` at `HEAD` (pre-change tree) | `formio-angular/resources/` | 2,334 chars |
| `iteration-after` | working tree | `formio-angular/formio-angular-resources/` | 1,015 chars |

Six `general-purpose` subagents, three evals per arm, run in parallel. Each was given the eval prompt verbatim from `evals.json` with the `/tmp/*` output paths re-targeted to its iteration directory. Because no human is present in an automated run, each agent was told to write its Phase A plan to `outputs/phase-a-plan.md`, treat it as approved, and continue to Phase B — and to record any question it would have asked in the plan instead of asking.

`frontend-design` was unavailable in every run, in both arms equally. Every agent disclosed the waiver in its Phase A plan, which is what the skill instructs.

The `without_skill` rows `grade.py` prints for each iteration are empty by construction here and carry no meaning — this comparison is old-vs-new, not skill-vs-baseline.

## Result — no regression

| Eval | Before | After |
| --- | --- | --- |
| eval-0 task-manager-simple | 17/18 (94%) | 17/18 (94%) |
| eval-1 user-team-bidirectional | 15/18 (83%) | 15/18 (83%) |
| eval-2 complex-crm-transitive | 19/19 (100%) | 19/19 (100%) |

Identical pass rates, and — the stronger signal — **identical failure sets**. The same four assertions fail in both arms, with the same evidence strings:

- eval-0: `ProjectUsers` child module points at `form: 'project-user'` rather than the join form name `projectUser`.
- eval-1: the two sibling join modules do not share `form: 'userTeam'`; `AppModule` and `AppRoutingModule` merge assertions fail because the agent wrote `app-module.ts` / created a fresh `config.ts` instead of merging the seed's `app.module.ts` / `app-routing.module.ts`.

All four pre-date this change and are unrelated to it — either a skill gap (form-name casing) or a harness gap (the seed fixture uses the older `app.module.ts` naming while agents emit Angular's current `app-module.ts`). They are recorded here as follow-up candidates, not fixed in this change.

Cost, for reference: 806k subagent tokens total, longest run 535s. Per-run `total_tokens` / `duration_ms` are in each arm's `timing.json`.

## Harness fixes made while running it

Two pre-existing bugs in `evals/grade.py`, both hit on the first invocation:

1. `REPO_ROOT` walked five parents up from `evals/`, which lands on `plugin/` rather than the repo root — a leftover from when the library lived at `skills/` in the repo root. So the default `.eval-artifacts/` location never resolved and the script printed nothing at all. Now `parents[5]`.
2. `run_dir.mkdir(exist_ok=True)` crashed with `FileNotFoundError` whenever an arm directory was absent — which happens in this comparison, and also whenever someone carries baselines forward as the README suggests. Now `parents=True`.

## Reproducing

```bash
ITERATION=iteration-after python3 plugin/skills/formio-angular/formio-angular-resources/evals/grade.py
ITERATION=iteration-before python3 plugin/skills/formio-angular/formio-angular-resources/evals/grade.py
```

Outputs live under `.eval-artifacts/formio-angular-resources/iteration-{before,after}/` (gitignored).
