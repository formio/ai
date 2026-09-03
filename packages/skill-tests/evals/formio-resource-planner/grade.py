#!/usr/bin/env python3
"""Grade formio-resource-planner eval runs against assertions.

Reads iteration run outputs from `<repo-root>/.eval-artifacts/formio-resource-planner/`
by default. Override via env vars if your artifacts live elsewhere.

Each with_skill / without_skill run directory is expected to contain an
`outputs/` folder with at minimum `template.md` and `template.json`.

Usage:
    # Default: grade iteration-1 at the default artifacts location
    python grade.py

    # Grade a specific iteration
    ITERATION=iteration-2 python grade.py

    # Point at a different artifacts dir entirely
    ARTIFACTS_DIR=/tmp/my-artifacts ITERATION=iteration-3 python grade.py
"""
import json
import os
import re
import sys
from pathlib import Path

# grade.py lives at packages/skill-tests/evals/formio-resource-planner/grade.py
# — repo root is 5 parents up (harness → evals → skill-tests → packages → root).
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
DEFAULT_ARTIFACTS = REPO_ROOT / ".eval-artifacts" / "formio-resource-planner"
BASE = Path(os.environ.get("ARTIFACTS_DIR", str(DEFAULT_ARTIFACTS)))
ITERATION = os.environ.get("ITERATION", "iteration-1")

REQUIRED_MD_SECTIONS = [
    "# Resource Map",
    "## Resources",
    "## Users & Auth",
    "## Roles",
    "## Access Matrix",
    "## ER Diagram",
    "## Access Flow Diagram",
    "## Companion artifact",
]

REQUIRED_JSON_KEYS = ["title", "version", "name", "roles", "forms", "actions", "resources", "access"]

ACCESS_TOKEN = re.compile(r"\b(all|own|group(\([^)]*\))?|role\([^)]*\)|—|-)\b")
# The mandated mirror expression: `value = data.<parent>?.data?.team || value;`.
# Both halves of the guard are required (see the skill's template-json.md,
# "select — transitive group-access mirror"), so an unguarded `data.x.data.team`
# does NOT count as a mirror — it is the crash this guard exists to prevent.
TRANSITIVE_CALC = re.compile(r"data\.\w+\?\.data\?\.team\s*\|\|\s*value", re.IGNORECASE)
UNGUARDED_CALC = re.compile(r"data\.\w+\??\.data\??\.team")
GROUP_ASSIGN = re.compile(r"group[ _-]?(assignment|permissions?)", re.IGNORECASE)


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except Exception:
        return ""


def load_json(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def grade_run(run_dir: Path, eval_name: str):
    outputs = run_dir / "outputs"
    md_path = outputs / "template.md"
    json_path = outputs / "template.json"
    md = read(md_path)
    tmpl = load_json(json_path)
    results = []

    results.append({
        "text": "template.md exists and is non-empty",
        "passed": bool(md.strip()),
        "evidence": f"path={md_path} size={len(md)}",
    })
    results.append({
        "text": "template.json exists and parses as JSON",
        "passed": tmpl is not None,
        "evidence": f"path={json_path} parsed={tmpl is not None}",
    })

    for heading in REQUIRED_MD_SECTIONS:
        found = any(line.strip().startswith(heading) for line in md.splitlines())
        results.append({
            "text": f"template.md has section heading `{heading}`",
            "passed": found,
            "evidence": "heading present" if found else "heading missing",
        })

    access_matrix_rows = [
        line for line in md.splitlines()
        if line.strip().startswith("|") and ACCESS_TOKEN.search(line)
    ]
    results.append({
        "text": "Access Matrix has at least one data row using the token vocabulary (all/own/group/role/—)",
        "passed": len(access_matrix_rows) >= 1,
        "evidence": f"{len(access_matrix_rows)} candidate rows",
    })

    def extract_section(heading: str, next_heading: str) -> str:
        i = md.find(heading)
        j = md.find(next_heading)
        if i == -1 or j == -1 or j <= i:
            return ""
        return md[i + len(heading):j]

    def extract_mermaid(section_body: str, expected_prefix: str) -> str:
        """Extract the content between ```mermaid and ``` fences, preferring blocks starting with `expected_prefix`."""
        lines = section_body.splitlines()
        in_block = False
        block: list[str] = []
        blocks: list[str] = []
        for line in lines:
            stripped = line.strip()
            if not in_block and stripped.startswith("```mermaid"):
                in_block = True
                block = []
                continue
            if in_block and stripped.startswith("```"):
                in_block = False
                blocks.append("\n".join(block))
                continue
            if in_block:
                block.append(line)
        # Prefer a block whose first non-empty line starts with expected_prefix
        for b in blocks:
            first = next((ln.strip() for ln in b.splitlines() if ln.strip()), "")
            if first.startswith(expected_prefix):
                return b
        return blocks[0] if blocks else ""

    er_body = extract_section("## ER Diagram", "## Access Flow Diagram")
    flow_body = extract_section("## Access Flow Diagram", "## Companion artifact")
    er_mermaid = extract_mermaid(er_body, "erDiagram")
    flow_mermaid = extract_mermaid(flow_body, "flowchart")

    results.append({
        "text": "ER Diagram section contains a Mermaid `erDiagram` fenced block",
        "passed": bool(er_mermaid) and er_mermaid.lstrip().splitlines()[0].strip().startswith("erDiagram"),
        "evidence": f"mermaid block chars={len(er_mermaid)}; first line: {er_mermaid.lstrip().splitlines()[0].strip() if er_mermaid else '(none)'}",
    })
    results.append({
        "text": "Access Flow Diagram section contains a Mermaid `flowchart` fenced block",
        "passed": bool(flow_mermaid) and flow_mermaid.lstrip().splitlines()[0].strip().startswith("flowchart"),
        "evidence": f"mermaid block chars={len(flow_mermaid)}; first line: {flow_mermaid.lstrip().splitlines()[0].strip() if flow_mermaid else '(none)'}",
    })

    # Cross-check: every resource name declared in `## Resources` appears as a node in BOTH Mermaid blocks.
    resources_body = extract_section("## Resources", "## Users & Auth")
    resource_names: list[str] = []
    for line in resources_body.splitlines():
        m = re.match(r"\s*-\s+([A-Z][A-Za-z0-9_]*)\s+\(type:\s+resource", line)
        if m:
            resource_names.append(m.group(1))

    def contains_token(haystack: str, token: str) -> bool:
        return bool(re.search(rf"\b{re.escape(token)}\b", haystack))

    if er_mermaid:
        missing_in_er = [r for r in resource_names if not contains_token(er_mermaid, r)]
        results.append({
            "text": "Every resource from `## Resources` appears in the Mermaid ER Diagram",
            "passed": not missing_in_er,
            "evidence": f"resources={resource_names}; missing_in_er={missing_in_er}",
        })
    if flow_mermaid:
        # Access flow does not need to include every resource — e.g., the User resource with only owner rules may be elided if not routed through a group ACL. Still require coverage for any resource with a non-trivial access story (group/role tokens in the Access Matrix).
        matrix_body = extract_section("## Access Matrix", "## ER Diagram")
        group_resources = {
            m.group(1)
            for line in matrix_body.splitlines()
            for m in [re.match(r"\|\s*([A-Z][A-Za-z0-9_]*)\s*\|", line)]
            if m and ("group" in line.lower() or "role(" in line.lower())
        }
        missing_in_flow = sorted(r for r in group_resources if not contains_token(flow_mermaid, r))
        results.append({
            "text": "Every resource with group/role access in the Access Matrix appears in the Mermaid Access Flow Diagram",
            "passed": not missing_in_flow,
            "evidence": f"group/role resources={sorted(group_resources)}; missing_in_flow={missing_in_flow}",
        })

    if tmpl is not None:
        for key in REQUIRED_JSON_KEYS:
            results.append({
                "text": f"template.json has top-level key `{key}`",
                "passed": key in tmpl,
                "evidence": "present" if key in tmpl else "missing",
            })

        # Key order: required keys must appear in the canonical order, with `description` (if present) optional and allowed immediately after `title`.
        actual_keys = [k for k in tmpl.keys() if k in set(REQUIRED_JSON_KEYS)]
        results.append({
            "text": "template.json top-level keys appear in canonical order: title, version, name, roles, forms, actions, resources, access",
            "passed": actual_keys == [k for k in REQUIRED_JSON_KEYS if k in tmpl],
            "evidence": f"actual order (required keys only)={actual_keys}",
        })
        all_keys = list(tmpl.keys())
        if "description" in all_keys:
            results.append({
                "text": "Optional `description` key, if present, sits immediately after `title`",
                "passed": all_keys.index("description") == all_keys.index("title") + 1,
                "evidence": f"actual top-level keys={all_keys}",
            })

        access_val = tmpl.get("access")
        access_is_list = isinstance(access_val, list)
        access_non_empty = access_is_list and len(access_val) > 0
        if not access_is_list:
            access_evidence = f"type={type(access_val).__name__} value={access_val!r}"
        elif not access_non_empty:
            access_evidence = "access is [] — project-level access entries missing"
        else:
            access_evidence = f"len={len(access_val)}"
        results.append({
            "text": "template.json top-level `access` is a non-empty array of project-level access entries",
            "passed": access_non_empty,
            "evidence": access_evidence,
        })

        roles = tmpl.get("roles", {}) or {}
        for defrole in ("administrator", "authenticated", "anonymous"):
            results.append({
                "text": f"template.json defines default role `{defrole}`",
                "passed": defrole in roles,
                "evidence": f"roles={list(roles)}",
            })

        actions = tmpl.get("actions", {}) or {}
        resources_map = tmpl.get("resources", {}) or {}
        forms_map = tmpl.get("forms", {}) or {}
        save_targets: set[str] = set()
        for akey, adef in actions.items():
            adef = adef or {}
            if adef.get("name") == "save":
                form_name = adef.get("form") or (akey.rsplit(":", 1)[0] if ":" in akey else akey)
                save_targets.add(form_name)

        missing_save_resources = sorted(n for n in resources_map.keys() if n not in save_targets)
        results.append({
            "text": "Every resource in template.json has a Save Submission action in `actions`",
            "passed": not missing_save_resources,
            "evidence": f"missing_save_resources={missing_save_resources or 'none'}; save_targets={sorted(save_targets)}",
        })

        missing_save_forms = sorted(n for n in forms_map.keys() if n not in save_targets)
        results.append({
            "text": "Every form in template.json has a Save Submission action in `actions`",
            "passed": not missing_save_forms,
            "evidence": f"missing_save_forms={missing_save_forms or 'none'}",
        })

        # Register forms need Role Assignment + Login chained with Save.
        register_forms = [
            n for n in forms_map.keys()
            if re.search(r"(?:^|[A-Za-z])(register|signup|signUp|Register|SignUp)(?:$|[A-Z])", n)
        ]
        for rf in register_forms:
            rf_action_types = {
                (a or {}).get("name")
                for a in actions.values()
                if (a or {}).get("form") == rf
            }
            results.append({
                "text": f"Register form `{rf}` has Save + Role Assignment + Login actions",
                "passed": {"save", "role", "login"}.issubset(rf_action_types),
                "evidence": f"action types on {rf}: {sorted(t for t in rf_action_types if t)}",
            })

        # Every join resource that participates in group-based access needs a Group Assignment action.
        join_resources_with_group = []
        for rname, rdef in resources_map.items():
            comps = (rdef or {}).get("components", []) or []
            has_group_assign_action = any(
                (a or {}).get("form") == rname and (a or {}).get("name") == "group"
                for a in actions.values()
            )
            # Heuristic: two `select` components pointing at resources AND resource name looks like a join.
            select_resource_refs = [
                c for c in comps
                if c.get("type") == "select" and ((c.get("data") or {}).get("resource"))
            ]
            looks_like_join = len(select_resource_refs) >= 2 and re.search(r"(User|user)$", rname or "")
            if looks_like_join:
                results.append({
                    "text": f"Join resource `{rname}` has a Group Assignment action",
                    "passed": has_group_assign_action,
                    "evidence": f"group action on {rname}: {has_group_assign_action}; select refs: {len(select_resource_refs)}",
                })
            if has_group_assign_action:
                join_resources_with_group.append(rname)

    # Eval-specific extras
    if eval_name == "complex-crm-transitive" and tmpl is not None:
        resources = tmpl.get("resources", {}) or {}
        mirror_hits = []
        unguarded_hits = []
        for rname, rdef in resources.items():
            comps = rdef.get("components", []) or []
            for c in comps:
                cv = str(c.get("calculateValue") or "")
                if not c.get("hidden"):
                    continue
                if TRANSITIVE_CALC.search(cv):
                    mirror_hits.append(f"{rname}.{c.get('key')}")
                elif UNGUARDED_CALC.search(cv):
                    unguarded_hits.append(f"{rname}.{c.get('key')}: {cv}")
        results.append({
            "text": "At least one resource has a hidden calculated team mirror (transitive group access)",
            "passed": len(mirror_hits) >= 1,
            "evidence": f"mirrors found: {mirror_hits or 'none'}",
        })
        results.append({
            "text": "Every mirror calculateValue carries both halves of the guard (`?.` and `|| value`)",
            "passed": len(unguarded_hits) == 0,
            "evidence": f"unguarded mirrors: {unguarded_hits or 'none'}",
        })

    if eval_name == "minimal-no-auth-feedback" and tmpl is not None:
        actions = tmpl.get("actions", {}) or {}
        has_group_action = any(GROUP_ASSIGN.search(a.get("name", "") + " " + a.get("title", "")) for a in actions.values())
        results.append({
            "text": "No Group Assignment / Group Permissions action for an anonymous app",
            "passed": not has_group_action,
            "evidence": f"group-ish actions present: {has_group_action}",
        })

    return results


def main():
    it_dir = BASE / ITERATION
    if not it_dir.exists():
        print(f"No such iteration dir: {it_dir}", file=sys.stderr)
        sys.exit(1)

    totals = {"pass": 0, "fail": 0}
    per_eval = {}
    for eval_dir in sorted(p for p in it_dir.iterdir() if p.is_dir()):
        # eval_dir looks like `eval-3-complex-crm-transitive`
        parts = eval_dir.name.split("-", 2)
        eval_name = parts[2] if len(parts) >= 3 else eval_dir.name
        for run_name in ("with_skill", "without_skill"):
            run_dir = eval_dir / run_name
            if not run_dir.exists():
                continue
            results = grade_run(run_dir, eval_name)
            p = sum(1 for r in results if r["passed"])
            f = sum(1 for r in results if not r["passed"])
            total = p + f
            summary = {
                "passed": p,
                "failed": f,
                "total": total,
                "pass_rate": round(p / total, 4) if total else 0.0,
            }
            grading_payload = {"summary": summary, "expectations": results}
            (run_dir / "grading.json").write_text(json.dumps(grading_payload, indent=2))
            # keep the aggregator-facing run-1/ copy in sync if present
            run_1 = run_dir / "run-1"
            if run_1.exists():
                (run_1 / "grading.json").write_text(json.dumps(grading_payload, indent=2))
            totals["pass"] += p
            totals["fail"] += f
            per_eval.setdefault(eval_dir.name, {})[run_name] = {"pass": p, "fail": f}
            print(f"{eval_dir.name}/{run_name}: {p} pass / {f} fail")

    print()
    print(f"TOTAL: {totals['pass']} pass / {totals['fail']} fail")


if __name__ == "__main__":
    main()
