# Iterating on `formio-angular-resources` (sub-skill of `formio-angular`)

This directory holds everything a teammate needs to run evals against the skill and measure whether a change improved or regressed it. Iteration outputs are deliberately _not_ committed — they live under `<repo-root>/.eval-artifacts/formio-angular-resources/` (gitignored), so your runs don't conflict with anyone else's.

## What's here

| File | Purpose |
| --- | --- |
| `evals.json` | The test prompts + expected outcomes. Three cases: task-manager (simple), user-team-bidirectional (N:N + existing-workspace merge), complex-crm-transitive (deep hierarchy with hidden mirrors). |
| `grade.py` | Converts subagent outputs → pass/fail grades (≈18 structural assertions per eval). Reads run outputs from `.eval-artifacts/`; writes `grading.json` next to each run. |
| `fixtures/existing-workspace-seed/` | A minimal Angular workspace that eval-1 requires. Copy it into the eval's `with_skill/outputs/workspace/` and `without_skill/outputs/workspace/` so the subagents have something to merge into. |

## The iteration loop

Conceptually: edit SKILL.md → rerun evals → grade → compare → decide. The `skill-creator` skill orchestrates this for you if you prefer (Claude handles spawning subagents, timing, grading, and viewer launch). The rest of this README documents the manual flow for reference.

Set `N` to your iteration number (1 for the first run, 2 after your first edit, etc.):

```bash
export N=3
export OUT=.eval-artifacts/formio-angular-resources/iteration-$N
```

### 1. Seed the iteration directory

```bash
mkdir -p $OUT/eval-0-task-manager-simple/{with_skill,without_skill}/outputs
mkdir -p $OUT/eval-1-user-team-bidirectional/{with_skill,without_skill}/outputs
mkdir -p $OUT/eval-2-complex-crm-transitive/{with_skill,without_skill}/outputs

# eval-1 needs an existing Angular workspace to merge INTO
cp -R skills/formio-angular/resources/evals/fixtures/existing-workspace-seed \
      $OUT/eval-1-user-team-bidirectional/with_skill/outputs/workspace
cp -R skills/formio-angular/resources/evals/fixtures/existing-workspace-seed \
      $OUT/eval-1-user-team-bidirectional/without_skill/outputs/workspace

# Carry forward eval_metadata.json from a previous iteration if you want to keep the assertion set
# OR regenerate by editing evals.json — `grade.py` embeds its own assertions, so metadata is optional.
```

### 2. Spawn the subagents (with-skill + baseline, all in parallel)

From Claude Code (this is what Claude will do on your behalf when you use `skill-creator`):

- **With-skill run** for each of the three evals: spawn a `general-purpose` subagent, tell it to read `skills/formio-angular/resources/SKILL.md`, hand it the eval prompt from `evals.json`, instruct it to write output files under `$OUT/eval-N-<name>/with_skill/outputs/workspace/` and the Phase A plan as `outputs/phase-a-plan.md`. Override any `/tmp/*` paths in the prompt — they're literal in `evals.json` so humans can read them, but your run re-targets them to the iteration directory.
- **Baseline run** for each eval: same prompt but tell the subagent **not** to consult `.claude/skills/`. Targets `without_skill/outputs/workspace/`.

All six run in parallel. Each completion notification carries `total_tokens` and `duration_ms`; save those to `$OUT/<eval>/<config>/timing.json` as the runs finish:

```json
{ "total_tokens": 75000, "duration_ms": 210000, "total_duration_seconds": 210.0 }
```

If you're carrying baselines forward from a prior iteration (they rarely change), just `cp -R` the old iteration's `without_skill/` directories in and skip re-spawning baselines.

### 3. Grade

```bash
ITERATION=iteration-$N python3 skills/formio-angular/resources/evals/grade.py
```

The script:

- Walks every `$OUT/eval-*/{with_skill,without_skill}/outputs/workspace/`
- Runs ≈18 structural assertions (routing shape, template overrides, N:N distinctness, hidden-mirror containment, merge-not-overwrite, etc.)
- Writes `run-1/grading.json` under each config dir in the format the skill-creator aggregator expects
- Prints per-eval pass rates

### 4. Aggregate and compare

```bash
cd /Users/$USER/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator
python3 -m scripts.aggregate_benchmark $OUT --skill-name formio-angular-resources
```

Produces `benchmark.json` and `benchmark.md` with mean ± stddev for pass rate, time, and tokens.

### 5. Open the viewer

```bash
nohup python3 /Users/$USER/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator/eval-viewer/generate_review.py \
  $OUT \
  --skill-name formio-angular-resources \
  --benchmark $OUT/benchmark.json \
  --previous-workspace .eval-artifacts/formio-angular-resources/iteration-$((N-1)) \
  > /tmp/eval-viewer.log 2>&1 &
```

Two tabs:

- **Outputs** — click through each eval, see the Phase A plan and generated file tree, leave feedback. Previous iteration is shown collapsed below the current one for diff review.
- **Benchmark** — the aggregate numbers.

Kill the viewer when done:

```bash
pkill -f generate_review.py
```

### 6. Read feedback and iterate

The viewer's "Submit All Reviews" button writes `feedback.json` to the iteration directory. Read it, incorporate the feedback into `SKILL.md` / `references/*.md`, bump `N`, repeat. Stop when the feedback is empty or you're no longer making progress.

## Tips

- **Don't duplicate baselines.** If you're only changing `SKILL.md`, the baseline (without_skill) results don't change — carry them forward with `cp -R` from the previous iteration to save ~5 minutes and ~20k tokens per run.
- **Grade iteration-1 with iteration-2's assertions** (or vice versa) to surface regressions. `grade.py` reads assertions from code, not from `eval_metadata.json`, so the same grader runs against any iteration.
- **Add assertions incrementally.** When you discover a new failure mode (e.g., "the agent keeps using the default form render"), encode it as an assertion in `grade.py`. Subsequent iterations will catch it automatically.
- **The eval prompts reference `/tmp/*` paths.** Those are literal in `evals.json` so a human reader can understand the intent. Your spawner prompt overrides them to the iteration directory. Don't edit `evals.json` for path reasons alone — edit it when you're actually changing what the skill should do.

## When an assertion is wrong

If `grade.py` fails a run that a human would consider passing, the assertion is too strict or too loose. Fix the regex/logic in `grade.py` first, re-grade, and commit the grader fix alongside the skill change. A wrong assertion is worse than a missing one — it misleads future iterations.
