#!/usr/bin/env python3
"""Routing eval for the Form.io skill library.

Two subcommands, both reading ITERATION (default iteration-1) and writing under
<repo>/.eval-artifacts/skill-routing/<ITERATION>/:

  python3 grade.py descriptions   Snapshot every registered skill's frontmatter
                                  description from plugin/skills/*/SKILL.md into
                                  descriptions.json — the text the run routes on.
  python3 grade.py                Grade choices.json ({eval id: chosen skill or
                                  "none"}) against evals.json; write grading.json
                                  and print the pass rate and every failure.

A prompt passes when the chosen skill is its expected_skill or one of its
also_accept, and is not one of its must_not.
"""

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
SKILLS = REPO / "plugin" / "skills"
OUT = REPO / ".eval-artifacts" / "skill-routing" / os.environ.get("ITERATION", "iteration-1")


def frontmatter_description(skill_md: Path) -> str:
    lines = skill_md.read_text(encoding="utf8").splitlines()
    if not lines or lines[0].strip() != "---":
        raise SystemExit(f"{skill_md} has no frontmatter")
    end = next((index for index, line in enumerate(lines[1:], 1) if line.strip() == "---"), None)
    if end is None:
        raise SystemExit(f"{skill_md} frontmatter is not closed")
    block = lines[1:end]
    for index, line in enumerate(block):
        if not line.startswith("description:"):
            continue
        value = line[len("description:"):].strip()
        if value and value not in (">", ">-", "|", "|-"):
            return value.strip("'\"")
        body = []
        for follow in block[index + 1:]:
            if follow and not follow.startswith((" ", "\t")):
                break
            body.append(follow.strip())
        return " ".join(part for part in body if part)
    raise SystemExit(f"{skill_md} has no description")


def registered_skills() -> dict:
    # Clients register top-level skill directories; nested SKILL.md files are
    # loaded by path from their parent skill.
    return {
        entry.name: frontmatter_description(entry / "SKILL.md")
        for entry in sorted(SKILLS.iterdir())
        if (entry / "SKILL.md").is_file()
    }


def snapshot() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "descriptions.json"
    target.write_text(json.dumps(registered_skills(), indent=2) + "\n", encoding="utf8")
    print(f"wrote {target}")


def grade() -> None:
    evals = json.loads((HERE / "evals.json").read_text(encoding="utf8"))["evals"]
    choices_path = OUT / "choices.json"
    if not choices_path.is_file():
        raise SystemExit(f"no {choices_path}; record the runs first (see README.md)")
    choices = json.loads(choices_path.read_text(encoding="utf8"))
    results = []
    for entry in evals:
        chosen = choices.get(entry["id"])
        accepted = [entry["expected_skill"], *entry.get("also_accept", [])]
        passed = chosen in accepted and chosen not in entry.get("must_not", [])
        results.append({"id": entry["id"], "expected": entry["expected_skill"], "chosen": chosen, "passed": passed})
    passed = sum(result["passed"] for result in results)
    summary = {"passed": passed, "total": len(results), "results": results}
    (OUT / "grading.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    print(f"{passed}/{len(results)} prompts routed as expected")
    for result in results:
        if not result["passed"]:
            print(f"  FAIL {result['id']}: expected {result['expected']}, chose {result['chosen']}")


if __name__ == "__main__":
    snapshot() if sys.argv[1:] == ["descriptions"] else grade()
