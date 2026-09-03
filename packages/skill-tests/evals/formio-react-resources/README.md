# `formio-react-resources` eval harness

Measures whether a change to the skill improved or regressed what it generates. Same loop as the other harnesses; the add-ons for this one are in "React specifics" below.

## Layout

```
evals.json       five prompts + expected_output
grade.py         structural assertions; writes run-1/grading.json per eval arm
fixtures/        the seed workspace the extend eval starts from
```

Run outputs go to the gitignored `.eval-artifacts/formio-react-resources/iteration-N/`, in the layout every harness here shares so the `skill-creator` aggregator and viewer read them unchanged:

```
iteration-N/
  eval-<id>-<name>/
    with_skill/outputs/       phase-a-plan.md, workspace/, inspection-report.md (eval 3)
    with_skill/timing.json    total_tokens + duration_ms from the spawner
    without_skill/outputs/    the baseline arm, same shape
```

## The loop

1. **Seed.** `mkdir -p` each `eval-<id>-<name>/{with_skill,without_skill}/outputs`. For eval 3 only, copy `fixtures/existing-workspace-seed/` to each arm's `outputs/workspace/`. The other four start from an empty workspace directory.
2. **Run.** Spawn one subagent per eval and arm with that eval's `prompt` — the with-skill arm reads `plugin/skills/formio-react/formio-react-resources/SKILL.md` first, the baseline arm is told not to consult `.claude/skills/`. Each writes into its arm's `outputs/`:
   - `phase-a-plan.md` — the plan emitted before approval
   - `workspace/` — the generated files
   - `inspection-report.md` — eval 3 only, the pre-modification inspection
   Approve the Phase A gate when the agent asks, so Phase B runs. Save each completion's `total_tokens` and `duration_ms` as the arm's `timing.json`. Baselines rarely change — carry them forward from the previous iteration with `cp -R` when only the skill changed.
3. **Grade.** `ITERATION=iteration-N python3 packages/skill-tests/evals/formio-react-resources/grade.py` — writes `run-1/grading.json` under each arm and prints every assertion with evidence for the failures.
4. **Aggregate and compare.** `python3 -m scripts.aggregate_benchmark <iteration dir> --skill-name formio-react-resources` from the `skill-creator` skill directory produces `benchmark.json` / `benchmark.md`; its `eval-viewer/generate_review.py` opens the outputs beside the previous iteration. A change that raises one eval and lowers another is not an improvement.

## React specifics

- **Approve the gate, but record whether it was offered.** The skill must emit a plan and stop even when the prompt says to generate. An agent that skipped straight to files has already failed eval 0 regardless of what it produced.
- **The seed has one deliberate gap.** `src/main.tsx` imports Bootstrap but not `@formio/js/dist/formio.form.css`. That is not an oversight — it is the state `EXISTING.md`'s inspection exists to find, and it is the only thing in eval 3 the agent is *supposed* to add outside the new resource. Backfilling it is a pass; leaving it is a miss. Do not tidy it away in the fixture.
- **Eval 3 grades restraint.** Its assertions are mostly about what was *not* touched: the seed kernel left in place, existing resources not regenerated, an inspection reported before modification. A run that rewrites the seed scores badly even if the Invoice code is good.
- **The kernel assertions run on every eval.** They catch Angular habits leaking back in: a composed `SubmissionTable`, a global `clearCache`, a `/delete` route, string ancestor keys, a Redux import.
- **Depth is the point of eval 1.** Two levels working proves little; the third level is where a design that special-cases the first nesting falls over.
- **Eval 4 is the floor, not a warm-up.** It is the only prompt with no ancestor anywhere, so it is the only one that catches a change which silently requires a `parents` binding — and the only one that would fail if the skill started inventing one for a root resource. Its assertions are the mirror image of the hierarchy ones: no `parents` declared, and screens still designed.

## Interpreting a failure

`grade.py` prints evidence for every failed assertion. Two failures worth reading carefully rather than fixing at the surface:

- *"Ancestor bindings reference imported config objects, not string keys"* — the generated code reintroduced Angular's registry. The fix is in the skill's `hierarchy.md`, not in the eval.
- *"Pure domain modules import neither react nor react-router"* — the domain logic was folded into a hook. That loses the property the kernel is built around, and it will not show up as a runtime failure.
