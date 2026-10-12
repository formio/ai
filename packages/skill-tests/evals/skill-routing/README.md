# Routing eval for the Form.io skill library

Measures which skill a request reaches. Run it before and after any change to a skill's frontmatter `description` or to prose that routes a request from one skill to another; a prompt that passed before must pass after. Outputs live under `<repo-root>/.eval-artifacts/skill-routing/` (gitignored).

## What's here

| File | Purpose |
| --- | --- |
| `evals.json` | Trigger prompts. Each has an `id`, the `prompt`, an optional `context` describing the workspace, the `expected_skill` (a top-level skill under `plugin/skills/`, or `none`), optional `also_accept`, and optional `must_not`. |
| `grade.py` | `descriptions` snapshots every registered skill's live description; the default subcommand grades the recorded choices. |
| `README.md` | This file. |

## What it measures, and what it does not

A run shows a fresh subagent the descriptions a client routes on and asks which skill it would activate. That is the text this repository controls, so the eval catches a description that claims or disclaims the wrong request. It is a proxy: it does not observe a client's own activation, which also weighs the conversation so far.

## The loop

```bash
export N=1
export ITERATION=iteration-$N
python3 packages/skill-tests/evals/skill-routing/grade.py descriptions
```

1. **Snapshot** — the command above writes `.eval-artifacts/skill-routing/iteration-$N/descriptions.json` from the skills as they are on disk. Take the baseline snapshot on the base commit before editing any skill.
2. **Route** — spawn `general-purpose` subagents (batches of about eight prompts each are fine). Give each the snapshot file and its prompts with their `context`, and these instructions: for each prompt independently, imagine it is the user's first message in a fresh session in the described workspace, with exactly these skills installed; name the one skill whose description would activate, or `none`; judge only from the descriptions; answer with a JSON object of `{id: skill}`. Do not show a subagent `expected_skill`, `also_accept`, or `must_not`.
3. **Record** — merge the answers into `.eval-artifacts/skill-routing/iteration-$N/choices.json`.
4. **Grade** — `python3 packages/skill-tests/evals/skill-routing/grade.py` writes `grading.json` and prints the pass rate and each failure.
5. **Compare** — every prompt that passed on the base must pass on the change. Record both pass rates in the change's `design.md`.
