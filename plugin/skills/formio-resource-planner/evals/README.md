# Iterating on `formio-resource-planner`

This directory holds everything a teammate needs to run evals against the skill and measure whether a change improved or regressed it. Iteration outputs are deliberately _not_ committed — they live under `<repo-root>/.eval-artifacts/formio-resource-planner/` (gitignored), so your runs don't conflict with anyone else's.

## What's here

| File | Purpose |
| --- | --- |
| `evals.json` | Four test prompts: task-manager-classic, crm-with-company-scoping, minimal-no-auth-feedback, complex-crm-transitive. Each has an `expected_output` summary used to drive the grader's assertions. |
| `grade.py` | Converts subagent outputs → pass/fail grades. Asserts the Phase B artifact pair (`template.md` and `template.json`) exists in `outputs/`, that `template.md` has the required section headings in order (`# Resource Map`, `## Resources`, `## Users & Auth`, `## Roles`, `## Access Matrix`, `## ER Diagram`, `## Access Flow Diagram`, `## Companion artifact`), that the Access Matrix has at least one data row in the token vocabulary, that both ASCII diagrams have bodies, and that `template.json` has the required top-level keys, default roles, and (for the transitive eval) the hidden/calculated group-mirror pattern on grandchildren. |
| `README.md` | This file. |

No `fixtures/` directory — the planner is pure-prompt-in, pure-artifact-out. Every prompt is self-contained in `evals.json`.

## The standard iteration loop

This is the common loop every skill in this repo uses. Per-skill add-ons are documented in the next section.

Set `N` to your iteration number:

```bash
export N=2
export OUT=.eval-artifacts/formio-resource-planner/iteration-$N
```

### 1. Seed the iteration directory

```bash
for eval in eval-0-task-manager-classic \
            eval-1-crm-with-company-scoping \
            eval-2-minimal-no-auth-feedback \
            eval-3-complex-crm-transitive; do
  mkdir -p $OUT/$eval/{with_skill,without_skill}/outputs
done
```

### 2. Spawn the subagents

From Claude Code (handled for you by `skill-creator` if it's installed — fall back to this manual flow otherwise):

- **With-skill run** for each eval: spawn a `general-purpose` subagent, have it read `skills/formio-resource-planner/SKILL.md`, hand it the eval prompt from `evals.json`, and write Phase B outputs (`template.md` and `template.json`) to `$OUT/<eval>/with_skill/outputs/`.
- **Baseline run** for each eval: same prompt, instruct the subagent **not** to consult `.claude/skills/`. Writes to `without_skill/outputs/` (also expected to produce `template.md` + `template.json`; baselines that skip one or the other will fail the presence assertions).

All eight run in parallel. Each completion notification carries `total_tokens` and `duration_ms`; save those as `timing.json` in each run dir:

```json
{ "total_tokens": 45000, "duration_ms": 120000, "total_duration_seconds": 120.0 }
```

Carry forward baselines (`without_skill/`) from a prior iteration if you didn't change the skill's substance — saves time and tokens.

### 3. Grade

```bash
ITERATION=iteration-$N python3 skills/formio-resource-planner/evals/grade.py
```

Walks every eval's `outputs/`, runs structural assertions against `template.md` and `template.json`, writes `grading.json` into each run dir and prints per-eval pass rates.

### 4. Aggregate

```bash
cd ~/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator
python3 -m scripts.aggregate_benchmark $OUT --skill-name formio-resource-planner
```

Produces `benchmark.json` and `benchmark.md` in `$OUT/`.

### 5. Open the viewer

```bash
nohup python3 ~/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator/eval-viewer/generate_review.py \
  $OUT \
  --skill-name formio-resource-planner \
  --benchmark $OUT/benchmark.json \
  --previous-workspace .eval-artifacts/formio-resource-planner/iteration-$((N-1)) \
  > /tmp/eval-viewer.log 2>&1 &
```

Kill with `pkill -f generate_review.py` when done.

### 6. Iterate

Read feedback, edit `SKILL.md` / `references/*.md`, bump `N`, repeat.

## Skill-specific: refresh the checked-in canonical examples

This is the planner's **one extra step** on top of the standard loop. The planner's `SKILL.md` references two worked examples as structural reference material — `references/examples/task-manager/` and `references/examples/complex-crm-transitive/`. These are checked into the repo because they teach the reader the exact shape of a finished resource-map and template.json for the simple and transitive patterns.

When a graded iteration produces better canonical outputs (clearer `template.md`, more correct `template.json`) than what's currently checked in, refresh the examples:

```bash
# After iteration N has graded cleanly:
cp $OUT/eval-0-task-manager-classic/with_skill/outputs/{template.md,template.json} \
   plugin/skills/formio-resource-planner/references/examples/task-manager/

cp $OUT/eval-3-complex-crm-transitive/with_skill/outputs/{template.md,template.json} \
   plugin/skills/formio-resource-planner/references/examples/complex-crm-transitive/
```

Only refresh when the new outputs are strictly better (compare in the viewer's "previous iteration" view). These examples are load-bearing — SKILL.md points at them directly, so a regression here degrades every future run of the skill.

The other two evals (`crm-with-company-scoping` and `minimal-no-auth-feedback`) are coverage-only; their outputs are not promoted to `references/examples/`. If you want to add a third canonical example (e.g., for a new pattern), follow the same copy step and add a reference to it in `SKILL.md`.

## Why this differs from `formio-angular-resources`

Same standard loop; different skill-specific add-on. The angular sub-skill at `skills/formio-angular/resources/` has `fixtures/existing-workspace-seed/` (needed as input to eval-1) but no canonical outputs promoted to `references/` — its reference material is code snippets in `references/resource-module-patterns.md`, not full worked examples. The planner is the opposite: no fixtures, but two canonical output examples that are part of the shipped skill.

Document any such skill-specific add-ons in your own skill's `evals/README.md` so a teammate doesn't have to reverse-engineer the convention.
