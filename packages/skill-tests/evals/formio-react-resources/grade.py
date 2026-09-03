#!/usr/bin/env python3
"""Grade formio-react-resources eval runs against structural assertions.

Reads iteration run outputs from `<repo-root>/.eval-artifacts/formio-react-resources/`
by default. Override via env vars if your artifacts live elsewhere.

Usage:
    python grade.py
    ITERATION=iteration-2 python grade.py
    ARTIFACTS_DIR=/tmp/my-artifacts ITERATION=iteration-3 python grade.py
"""
import json
import os
import re
import sys
from pathlib import Path

# grade.py lives at packages/skill-tests/evals/formio-react-resources/grade.py
# — repo root is 5 parents up (harness → evals → skill-tests → packages → root).
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
SEED_DIR = Path(__file__).resolve().parent / "fixtures" / "existing-workspace-seed"
DEFAULT_ARTIFACTS = REPO_ROOT / ".eval-artifacts" / "formio-react-resources"
BASE = Path(os.environ.get("ARTIFACTS_DIR", str(DEFAULT_ARTIFACTS)))
ITERATION = os.environ.get("ITERATION", "iteration-1")

PARAM_DECL = re.compile(r"param\s*:\s*['\"]([A-Za-z0-9_]+)['\"]")
FORM_DECL = re.compile(r"form\s*:\s*['\"]([^'\"]+)['\"]")
ROUTEPATH_DECL = re.compile(r"routePath\s*:\s*['\"]([^'\"]+)['\"]")
# An ancestor binding references the parent's config object, not a string key.
PARENT_OBJECT_REF = re.compile(r"resource\s*:\s*(?!['\"])([A-Za-z_][A-Za-z0-9_]*)")
PARENT_STRING_REF = re.compile(r"resource\s*:\s*['\"](?!currentUser)[^'\"]+['\"]")
SUBMISSION_TABLE = re.compile(r"\bSubmissionTable\b")
CLEAR_CACHE = re.compile(r"Formio\.clearCache\s*\(")
DELETE_ROUTE = re.compile(r"path\s*:\s*['\"]delete['\"]")
USE_FETCHER = re.compile(r"\buseFetcher\b")
# Pagination must be read off the LIST loader's own search params. `request.url`
# and `new URL(` on their own also match the save action's redirect path, which
# every kernel has, so a bare scan for them passes on a loader that paginates
# not at all.
SEARCH_PARAMS = re.compile(
    r"useSearchParams|searchParams\.get\(|\.search\b.*\bget\(|new URL\([^)]*\)\.searchParams"
)
# The kernel's own config module — `src/config.ts` at the application root, or
# `./config` / `../config` from inside `src/formio/`. A bare `[^'\"]*config`
# also matches `./resources/customer/config`, which every resource imports, so
# the assertion passed on a kernel with both URLs hardcoded.
CONFIG_IMPORT = re.compile(r"from\s+['\"](?:\.{1,2}/)+config['\"]")
# A module that DEFINES a pure domain function, as opposed to one that merely
# calls it. `actions.ts` imports `preserveDraftState` and also imports
# `redirect` from react-router, entirely correctly — a mention-based scan marks
# the reference kernel itself impure.
PURE_DEFINITION = re.compile(
    r"export\s+function\s+(?:applyParentContext|parentFilters|preserveDraftState)\b"
)


def read(p):
    try:
        return p.read_text()
    except Exception:
        return ""


def source_files(root):
    """TypeScript sources under `root`, keyed by path RELATIVE to it.

    Relative on purpose: `is_kernel` looks for the `src/formio` segment pair, and
    an absolute key would carry the artifacts directory — and, on this machine,
    a `formio` ancestor of the repository itself — into that test, making every
    file a kernel file. `node_modules` is pruned rather than filtered after the
    walk, so an installed workspace is not read in full and then discarded.
    """
    out = {}
    if not root.exists():
        return out
    stack = [root]
    while stack:
        current = stack.pop()
        for entry in current.iterdir():
            if entry.is_dir():
                if entry.name != "node_modules":
                    stack.append(entry)
            elif entry.suffix in (".ts", ".tsx"):
                out[entry.relative_to(root)] = read(entry)
    return out


def seed_files():
    """The extend eval's seed workspace, keyed by path relative to its root."""
    return source_files(SEED_DIR)


def is_kernel(path):
    """True for a file under the kernel directory `src/formio/`.

    Tested on the RELATIVE path's segment pairs, never as a substring of the
    whole path — `formio-react-resources` (the artifacts directory) and a
    `formio` directory above the repository both contain the word.
    """
    parts = Path(path).parts
    return any(parts[i : i + 2] == ("src", "formio") for i in range(len(parts) - 1))


def resource_src(files):
    """Source outside the kernel. Parent bindings are declared here, and only
    here — the kernel's own `types.ts` carries `resource: ResourceConfig` in the
    ParentBinding interface, which would satisfy an object-reference scan on its
    own and make the assertion vacuous."""
    return "\n".join(body for path, body in files.items() if not is_kernel(path))


def result(text, passed, evidence):
    return {"text": text, "passed": bool(passed), "evidence": str(evidence)}


def kernel_assertions(ws, files, all_src):
    """Assertions that hold for every eval: the kernel's shape and its bans."""
    results = []

    kernel = ws / "src" / "formio"
    results.append(result(
        "A kernel exists at src/formio/ with an index module",
        kernel.exists() and (kernel / "index.ts").exists(),
        f"kernel dir: {kernel.exists()}, index: {(kernel / 'index.ts').exists()}",
    ))

    # Pure domain functions live in the kernel and stay free of React/router.
    pure_names = ["applyParentContext", "parentFilters", "resourcePermissions", "preserveDraftState"]
    present = [n for n in pure_names if n in all_src]
    results.append(result(
        "The kernel exports the pure domain functions",
        len(present) == len(pure_names),
        f"found: {present}",
    ))

    impure = []
    for path, body in files.items():
        if not is_kernel(path):
            continue
        # The DEFINING module, not one that calls the function: `actions.ts`
        # imports `preserveDraftState` and `redirect` together by design.
        if PURE_DEFINITION.search(body):
            if re.search(r"from\s+['\"]react['\"]|from\s+['\"]react-router", body):
                impure.append(str(path))
    results.append(result(
        "Pure domain modules import neither react nor react-router",
        not impure,
        f"offenders: {impure}" if impure else "none",
    ))

    # Loaders read the generated config rather than SDK globals or context.
    # Scoped to the KERNEL: the application entry point imports the config too,
    # to feed FormioProvider, so a tree-wide scan passes on a kernel with both
    # URLs hardcoded into its loaders.
    kernel_reads_config = [
        str(path) for path, body in files.items() if is_kernel(path) and CONFIG_IMPORT.search(body)
    ]
    results.append(result(
        "Loaders take their URLs from the generated config module",
        bool(kernel_reads_config),
        f"kernel modules importing the config: {kernel_reads_config}"
        if kernel_reads_config
        else "no kernel module imports the config",
    ))
    # `src/config.ts` is SUPPOSED to call setProjectUrl/setBaseUrl — that is
    # where the globals `currentUser()` reads get set, before any loader runs.
    # The offender is a KERNEL module that calls them, or a loader module that
    # reads React context. Both checks are per file: a component legitimately
    # calls useFormioContext, so only a module that also defines a loader is an
    # offender.
    globals_in_kernel = [
        str(path)
        for path, body in files.items()
        if is_kernel(path) and re.search(r"Formio\.set(?:ProjectUrl|BaseUrl)\s*\(", body)
    ]
    context_in_loader = [
        str(path)
        for path, body in files.items()
        if "useFormioContext" in body and re.search(r"\bloader\b", body)
    ]
    results.append(result(
        "No SDK global or React context is used as the loader's URL source",
        not globals_in_kernel and not context_in_loader,
        f"set*Url in a kernel module: {globals_in_kernel}; context in a loader module: {context_in_loader}",
    ))

    # The loader owns list data — SubmissionTable would double-fetch.
    results.append(result(
        "SubmissionTable is not composed into a generated list screen",
        not SUBMISSION_TABLE.search(all_src),
        "SubmissionTable absent" if not SUBMISSION_TABLE.search(all_src) else "SubmissionTable present",
    ))
    results.append(result(
        "List pagination is addressable through route search params",
        bool(SEARCH_PARAMS.search(all_src)),
        "search-param pagination found" if SEARCH_PARAMS.search(all_src) else "none found",
    ))

    # Angular habits that must not be ported.
    results.append(result(
        "No global Formio.clearCache() on unmount",
        not CLEAR_CACHE.search(all_src),
        "clearCache absent" if not CLEAR_CACHE.search(all_src) else "clearCache present",
    ))
    results.append(result(
        "Delete is a fetcher action, with no dedicated delete route",
        not DELETE_ROUTE.search(all_src) and bool(USE_FETCHER.search(all_src)),
        f"delete route: {bool(DELETE_ROUTE.search(all_src))}, useFetcher: {bool(USE_FETCHER.search(all_src))}",
    ))
    results.append(result(
        "No Redux or legacy modules import",
        "react-redux" not in all_src and "@formio/react/lib/modules" not in all_src,
        "clean" if "react-redux" not in all_src else "redux present",
    ))
    return results


def hierarchy_assertions(files, all_src, expected):
    """expected: list of (routePath, param, form) tuples, ancestor-first."""
    results = []

    params = PARAM_DECL.findall(all_src)
    results.append(result(
        "Every resource declares a distinct route param, none of them a bare id",
        len(params) == len(set(params)) and "id" not in params and len(params) >= len(expected),
        f"params: {params}",
    ))

    for route_path, param, form in expected:
        results.append(result(
            f"{route_path} config declares routePath '{route_path}', param '{param}', form '{form}'",
            route_path in ROUTEPATH_DECL.findall(all_src)
            and param in params
            and form in FORM_DECL.findall(all_src),
            f"routePaths: {ROUTEPATH_DECL.findall(all_src)}, forms: {FORM_DECL.findall(all_src)}",
        ))

    # Ancestors are imported config objects, never string registry keys. Scanned
    # over the per-resource files only: the kernel's own ParentBinding interface
    # declares `resource: ResourceConfig`, which would match the object-reference
    # pattern whether or not any resource actually declares a binding.
    configs_src = resource_src(files)
    string_refs = PARENT_STRING_REF.findall(configs_src)
    results.append(result(
        "Ancestor bindings reference imported config objects, not string keys",
        bool(PARENT_OBJECT_REF.search(configs_src)) and not string_refs,
        f"string refs: {string_refs}" if string_refs else "object references only",
    ))

    # The filter keys off the reference component's resolved data path. Asserted
    # against the per-resource files as well as the kernel: `parentFilters` and
    # `applyParentContext` are kernel exports, so their mere presence in the tree
    # is true of every run and would make both assertions vacuous. What actually
    # varies is whether a resource DECLARES the ancestor binding they act on.
    declares_parents = re.search(r"\bparents\s*:", configs_src)
    filter_ok = declares_parents and (
        re.search(r"data\.[A-Za-z0-9_.$}{]+\._id", all_src) or "parentFilters" in all_src
    )
    results.append(result(
        "Child lists filter on the ancestor via data.<path>._id",
        bool(filter_ok),
        f"parents declared: {bool(declares_parents)}, parentFilters: {'parentFilters' in all_src}",
    ))

    prefill_ok = bool(declares_parents) and "applyParentContext" in all_src
    results.append(result(
        "Create screens pre-fill the ancestor through applyParentContext",
        prefill_ok,
        "applyParentContext used" if prefill_ok else
        f"parents declared: {bool(declares_parents)}, applyParentContext: {'applyParentContext' in all_src}",
    ))
    return results


def plan_assertions(plan):
    results = []
    results.append(result(
        "A Phase A Scaffolding Plan was emitted before files",
        bool(plan.strip()),
        f"plan size: {len(plan)} bytes",
    ))
    results.append(result(
        "The plan names routePath, param, and form for each resource",
        "routePath" in plan and "param" in plan and "form" in plan,
        "all three column headings present" if "routePath" in plan else "missing columns",
    ))
    results.append(result(
        "The plan carries the frontend-design consultation line",
        "frontend-design consulted:" in plan,
        "line present" if "frontend-design consulted:" in plan else "line absent",
    ))
    return results


def grade_eval_0(out_dir):
    ws = out_dir / "workspace"
    files = source_files(ws)
    all_src = "\n".join(files.values())
    return (
        plan_assertions(read(out_dir / "phase-a-plan.md"))
        + kernel_assertions(ws, files, all_src)
        + hierarchy_assertions(files, all_src, [
            ("customer", "customerId", "customer"),
            ("quote", "quoteId", "quote"),
        ])
    )


def grade_eval_1(out_dir):
    ws = out_dir / "workspace"
    files = source_files(ws)
    all_src = "\n".join(files.values())
    results = (
        plan_assertions(read(out_dir / "phase-a-plan.md"))
        + kernel_assertions(ws, files, all_src)
        + hierarchy_assertions(files, all_src, [
            ("customer", "customerId", "customer"),
            ("quote", "quoteId", "quote"),
            ("line-item", "lineItemId", "line-item"),
        ])
    )
    # Depth must not require a different pattern. Counted over the per-resource
    # files only: the kernel DEFINES `itemRouteOf` and re-exports it from its
    # index, so a whole-tree count is 2 before any resource composes anything and
    # the fallback would pass on every run.
    configs_src = resource_src(files)
    nested_twice = re.search(r"children\s*:\s*lineItemRoutes|children:\s*\[?\s*\.\.\.lineItemRoutes", configs_src)
    composed = configs_src.count("itemRouteOf")
    results.append(result(
        "The third level composes by the same array push as the second",
        bool(nested_twice) or composed >= 2,
        f"itemRouteOf occurrences outside the kernel: {composed}",
    ))
    return results


def grade_eval_2(out_dir):
    ws = out_dir / "workspace"
    files = source_files(ws)
    all_src = "\n".join(files.values())
    results = plan_assertions(read(out_dir / "phase-a-plan.md")) + kernel_assertions(ws, files, all_src)

    # Each side composes the join under its OWN item route, so the join's route
    # array is pushed twice, from the per-resource files. Counted there rather
    # than tree-wide: the kernel defines and re-exports `itemRouteOf`, so a
    # whole-tree count is 2 before any resource composes anything.
    #
    # Name-based evidence is worthless here. `"user" in all_src` is guaranteed
    # by the kernel's own `requireUser` / `currentUser`, and a join the planner
    # named `Membership` rather than `TeamUser` scores zero on a name scan while
    # being perfectly correct.
    configs_src = resource_src(files)
    composed = configs_src.count("itemRouteOf")
    results.append(result(
        "The join is composed under BOTH sides' item routes, not as a root resource",
        composed >= 2,
        f"itemRouteOf compositions outside the kernel: {composed}",
    ))
    membership = re.search(r"membership|creator", all_src, re.IGNORECASE)
    results.append(result(
        "Group creation also writes the creator's membership row",
        bool(membership),
        "membership write found" if membership else "no membership write — creator would be locked out",
    ))
    return results


def grade_eval_3(out_dir):
    ws = out_dir / "workspace"
    files = source_files(ws)
    all_src = "\n".join(files.values())
    report = read(out_dir / "inspection-report.md") or read(out_dir / "transcript.md")
    results = []

    results.append(result(
        "An inspection was reported before anything was modified",
        bool(re.search(r"router|provider|stylesheet", report, re.IGNORECASE)),
        f"report size: {len(report)} bytes",
    ))
    invoice_files = [p for p in files if "invoice" in str(p).lower()]
    results.append(result(
        "Invoice resource files were generated",
        bool(invoice_files),
        f"files: {[str(p.name) for p in invoice_files]}",
    ))
    # The existing kernel is reused, not rewritten: every export the seed's
    # index declared must still be there. Additions are allowed; a regeneration
    # that drops or renames one is not. Comparing against the seed is the point —
    # a non-empty index.ts is also what a full rewrite leaves behind.
    seed = seed_files()
    seed_kernel = read(ws / "src" / "formio" / "index.ts")
    seed_kernel_exports = [
        line.strip()
        for line in seed.get(Path("src/formio/index.ts"), "").splitlines()
        if line.strip().startswith("export")
    ]
    dropped = [line for line in seed_kernel_exports if line not in seed_kernel]
    results.append(result(
        "The pre-existing kernel was left in place rather than regenerated",
        bool(seed_kernel) and bool(seed_kernel_exports) and not dropped,
        f"dropped exports: {dropped}" if dropped else
        ("kernel intact" if seed_kernel else "kernel missing"),
    ))
    # Restraint: every seeded resource file is byte-identical to the seed. The
    # generated Invoice files are new paths, so they are not in this set.
    rewritten = [
        str(rel)
        for rel, body in seed.items()
        if rel.parts[:2] == ("src", "resources") and read(ws / rel) != body
    ]
    results.append(result(
        "Existing resources were not regenerated",
        bool(seed) and not rewritten,
        f"rewritten: {rewritten}" if rewritten else "seeded resource files unchanged",
    ))

    # The seed deliberately ships only the Bootstrap half of the renderer's CSS.
    # EXISTING.md's inspection is supposed to notice and backfill the other half;
    # this is the one thing outside the new resource the agent SHOULD add.
    # The IMPORT, not the file name: the seed's own comment names
    # `formio.form.css` while explaining why it is missing, so a substring test
    # passes on the untouched seed.
    entry = read(ws / "src" / "main.tsx") + read(ws / "src" / "main.jsx")
    backfilled = bool(re.search(r"^import\s+['\"][^'\"]*formio\.form\.css", entry, re.MULTILINE))
    results.append(result(
        "The missing renderer stylesheet was backfilled",
        backfilled,
        "formio.form.css imported"
        if backfilled
        else "still absent — the inspection missed the gap EXISTING.md tells it to look for",
    ))
    return results


def grade_eval_4(out_dir):
    """One resource, no ancestors — the kernel's simplest shape.

    Every other eval declares parent bindings, so without this one the
    no-parents path is never graded, and a change that only works when a
    resource has an ancestor scores a clean sweep. `hierarchy_assertions` is
    deliberately not reused: its bindings checks require a `parents` array,
    which is exactly what must NOT appear here.
    """
    ws = out_dir / "workspace"
    files = source_files(ws)
    all_src = "\n".join(files.values())
    results = plan_assertions(read(out_dir / "phase-a-plan.md")) + kernel_assertions(
        ws, files, all_src
    )

    configs_src = resource_src(files)
    params = PARAM_DECL.findall(all_src)
    results.append(result(
        "The resource declares a named route param, not a bare id",
        bool(params) and "id" not in params,
        f"params: {params}",
    ))
    results.append(result(
        "task config declares routePath 'task', param 'taskId', form 'task'",
        "task" in ROUTEPATH_DECL.findall(all_src)
        and "taskId" in params
        and "task" in FORM_DECL.findall(all_src),
        f"routePaths: {ROUTEPATH_DECL.findall(all_src)}, forms: {FORM_DECL.findall(all_src)}",
    ))
    # A resource with no ancestor gets no binding invented for it, and nothing
    # to filter on. An invented `parents` entry names a component the form does
    # not have, and `applyParentContext` throws on the create route.
    invented = re.search(r"\bparents\s*:", configs_src)
    results.append(result(
        "No ancestor binding is invented for a resource that has none",
        not invented,
        "no parents declared" if not invented else "a root resource declared parent bindings",
    ))
    # `resourceRoutes(config)` with no second argument is the bare-kernel output
    # the skill says it never emits.
    designed = re.search(r"resourceRoutes\(\s*[A-Za-z_][A-Za-z0-9_]*\s*,", configs_src)
    results.append(result(
        "The resource ships designed screens rather than bare resourceRoutes",
        bool(designed),
        "screen overrides passed" if designed else "bare resourceRoutes(config) — no screens",
    ))
    return results


GRADERS = {
    0: grade_eval_0,
    1: grade_eval_1,
    2: grade_eval_2,
    3: grade_eval_3,
    4: grade_eval_4,
}


def main():
    """Grade every `eval-N*/{with_skill,without_skill}/outputs/` under the iteration.

    Same layout as the other harnesses, so the skill-creator aggregator and
    viewer read this harness's results unchanged: one `run-1/grading.json` per
    arm, in the aggregator's `{eval_id, configuration, expectations, summary}`
    shape. An arm may be absent (baselines carried forward, or a before/after
    comparison that only populates one side).
    """
    iteration_dir = BASE / ITERATION
    if not iteration_dir.exists():
        print(f"No such iteration directory: {iteration_dir}", file=sys.stderr)
        return 1

    graded = 0
    for eval_dir in sorted(iteration_dir.glob("eval-*")):
        match = re.match(r"eval-(\d+)", eval_dir.name)
        grader = GRADERS.get(int(match.group(1))) if match else None
        if not grader:
            continue
        eval_id = int(match.group(1))
        for config in ("with_skill", "without_skill"):
            out_dir = eval_dir / config / "outputs"
            if not out_dir.exists():
                continue
            results = grader(out_dir)
            passed = sum(1 for r in results if r["passed"])
            total = len(results)
            run_dir = eval_dir / config / "run-1"
            run_dir.mkdir(parents=True, exist_ok=True)
            (run_dir / "grading.json").write_text(json.dumps({
                "eval_id": eval_id,
                "configuration": config,
                "expectations": results,
                "summary": {
                    "passed": passed,
                    "failed": total - passed,
                    "total": total,
                    "pass_rate": passed / total if total else 0,
                },
            }, indent=2) + "\n")
            # The spawner records timing beside the arm; the aggregator reads it from the run.
            timing = eval_dir / config / "timing.json"
            if timing.exists():
                (run_dir / "timing.json").write_text(timing.read_text())
            graded += 1
            print(f"{eval_dir.name}/{config}: {passed}/{total}")
            for r in results:
                print(f"  {'PASS' if r['passed'] else 'FAIL'}  {r['text']}")
                if not r["passed"]:
                    print(f"        evidence: {r['evidence']}")

    if not graded:
        print(f"No eval-N/<arm>/outputs directories found under {iteration_dir}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
