# Eval evidence — before/after the prose rewrite

Task 8.10–8.12. The question this answers is narrow: **did de-Claude-ing the skill prose regress either skill?**

## How to read these numbers

Both baselines were graded with the **current** `grade.py`, not with the grader that produced their stored `grading.json`. That matters — both graders have gained assertions since those runs, so the numbers stored alongside the baseline artifacts are not comparable to today's. Re-grading the same artifacts with today's assertions is the only apples-to-apples comparison, and it is exactly the trick both `evals/README.md` files recommend ("grade iteration-1 with iteration-2's assertions to surface regressions").

Only `with_skill` runs were re-run. The `without_skill` baselines were carried forward per both READMEs — this change touches skill prose, which by definition cannot move a run that does not read the skill. Their identical scores across both columns confirm the carry-forward was clean.

**The baselines are old.** The planner artifacts date from 2026-04-23 and the Angular ones from an unrecorded commit, both well before Phases 0 and 1. So the planner's large gain below is *not* evidence that this change improved anything — it is the accumulated effect of everything since. The only claim these numbers support is the one being made: no regression.

## `formio-resource-planner`

Baseline `iteration-2` vs. `iteration-3`, `with_skill`, current grader:

| Eval                          | Before | After     |
| ----------------------------- | ------ | --------- |
| eval-0 task-manager-classic   | 24/31  | **32/33** |
| eval-1 crm-with-company-scoping | 25/31 | **32/33** |
| eval-2 minimal-no-auth-feedback | 24/30 | **31/31** |
| eval-3 complex-crm-transitive | 25/32  | **33/34** |
| **Total**                     | 98/124 (79%) | **128/131 (98%)** |

No assertion that passed at baseline fails now.

**The one remaining failure, in three of four evals, is a grader bug rather than a skill defect:** "Every form in `template.json` has a Save Submission action" flags `userLogin`. A login form is served by a Login Action; a Save Submission action on it would persist credentials as submissions, which is precisely what it must not do. The assertion needs to exempt auth forms. It failed at baseline too, so nothing here is new — but it should be fixed before it trains a future iteration to emit the wrong thing.

## `formio-angular-resources`

Baseline `iteration-before` vs. `iteration-phase2`, `with_skill`, current grader:

| Eval                          | Before | After     |
| ----------------------------- | ------ | --------- |
| eval-0 task-manager-simple    | 17/18  | **18/18** |
| eval-1 user-team-bidirectional | 15/18 | **16/18** |
| eval-2 complex-crm-transitive | 19/19  | 17/18     |
| **Total**                     | 51/55 (93%) | 51/54 (94%) |

Net flat. Two findings worth recording rather than smoothing over:

**1. eval-1's two failures are a fixture/grader mismatch, present in BOTH columns.** `grade.py:261,274` look for `app-module.ts` and `app-routing-module.ts` (Angular 20 naming, matching `references/app-integration.md`), while `evals/fixtures/existing-workspace-seed/` ships Angular 17 naming (`app.module.ts`, `app-routing.module.ts`). Any run that correctly merges into the files the fixture actually contains is scored as having failed to merge. The fix is to loosen the grader's filename match or rename the seed; either way it caps eval-1 at 16/18 regardless of skill quality. Pre-existing, unrelated to this change, and worth fixing because it silently understates the skill.

**2. eval-2 lost one assertion, and it is not explained by this change.** "DealModule is nested via `account/deals/` with `parents: ['account']`" passed at baseline and fails now. The check is purely path-shaped — it looks for a module file whose name contains "deal" under a path containing "account". The baseline run emitted both `account/deals/account-deals.module.ts` and `deal/deal.module.ts`; this run emitted only `deal/deal.module.ts`, carrying the correct `parents: ['account']` on it. So the semantic requirement in the assertion's own text is satisfied while the path shape it actually tests is not, and the denominator moved (19 → 18) because the grader adds a conditional assertion when the extra module exists.

Nothing in this change touches module placement, nesting, or routing — the edits to this sub-skill were the design-skill rename, the `designSkillStatus` handoff, and the question phrasing. The most likely explanation is run-to-run variance between two defensible layouts, but that is an inference, not a measurement: a single run cannot distinguish variance from a real shift. If it matters, re-run eval-2 two or three more times and see whether the layout is stable.

## Incidental confirmation

Both Angular runs had no design skill available and emitted the waiver form of the `design skill consulted:` line without being told what to write. That is the first end-to-end exercise of the renamed `designSkillStatus: 'inline-brief'` path, and it behaved as specified.

One caveat on that: the eval-1 agent reported that a design skill *was* present in its session and it followed the instruction to treat it as absent. So this exercises the inline-brief branch, not the availability probe itself. Exercising the `'available'` branch needs an eval condition that controls the skill list rather than a prompt that asks the agent to pretend.

## Reproducing

```bash
ITERATION=iteration-3 python3 plugin/skills/formio-resource-planner/evals/grade.py
ITERATION=iteration-2 python3 plugin/skills/formio-resource-planner/evals/grade.py   # baseline, same grader

ITERATION=iteration-phase2 python3 plugin/skills/formio-angular/formio-angular-resources/evals/grade.py
ITERATION=iteration-before python3 plugin/skills/formio-angular/formio-angular-resources/evals/grade.py
```

Artifacts live under the gitignored `.eval-artifacts/`, so these commands need the runs re-executed on a fresh clone.
