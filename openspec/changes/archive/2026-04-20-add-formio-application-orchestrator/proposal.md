## Why

Today the `formio-angular` parent skill owns two jobs: (a) orchestrating the cross-cutting "build me an app" flow (plan data → import → URL capture → generate framework files), and (b) knowing how to scaffold an Angular application specifically. Conflating those two responsibilities on one skill was acceptable while Angular was the only UI framework in the library. It stops being acceptable the moment a second framework skill (`formio-react`, `formio-vue`, etc.) lands — at that point the skill loader cannot tell which "build me an app" skill to activate, and generic triggers like "build me a CRM" collide between framework-specific orchestrators.

We need a framework-agnostic orchestrator that sits ABOVE the framework-specific skills. The orchestrator owns the plan → import → authenticate → route flow; framework skills own only their framework's file-generation concerns.

## What Changes

- **NEW skill `formio-application`** at `skills/formio-application/`. This is the new default "build me an app" entry point for the library. It claims plain-language triggers that do not assume any UI framework: "build me an app", "create a CRM", "I need a tool to track X", "also track Y in my existing app", etc. Internally it runs a five-step orchestration:
  1. **Intent** — ask the user whether this is a new app to build or an existing app to extend.
  2. **Deployment interview** — in a single batched `AskUserQuestion`, capture the Form.io Base URL (platform deployment) and Project URL (the specific Form.io project). Both questions carry plain-language descriptions and example values.
  3. **Authenticate with the MCP server** — warn the user that a browser window may open for portal login, then trigger the MCP server's lazy-auth.
  4. **`project_import`** — for the build-new branch, after running `formio-resource-planner` to produce `template.json`, invoke the `project_import` MCP tool against the captured Project URL. Skip this step on the modify-existing branch.
  5. **Framework routing** — detect how many UI-framework skills the library has installed. If exactly one (initially `formio-angular`), route straight to it. If more than one (future state: `formio-angular`, `formio-react`, etc.), ask the user to pick in a single `AskUserQuestion`, then route.
- **NEW sibling docs** under `skills/formio-application/`:
  - `SKILL.md` — the orchestrator entry point with frontmatter + body describing the five steps.
  - `INTENT.md` — the build-vs-modify decision script.
  - `DEPLOYMENT.md` — the Base URL + Project URL interview (with plain-language descriptions).
  - `IMPORT.md` — the `project_import` invocation, pre-auth messaging, confirmation gate, and error-handling branches.
  - `FRAMEWORK.md` — the framework-detection + routing logic, including how to add a new framework entry to the registry when `formio-react` lands.
- **BREAKING `formio-angular` description rewrite** — drop the plain-language "build me an app" triggers. `formio-angular`'s trigger surface narrows to framework-explicit phrasings ("build it in Angular", "Angular front-end for this Form.io project", "use Angular") and handoff from `formio-application`. The generic "build me an app" surface belongs to `formio-application` alone. Body text updated to describe the skill as a framework-specific implementor invoked by `formio-application`, not the top-level orchestrator.
- **BREAKING `formio-angular-resources` description rewrite** — drop the plain-language "also track X" / "add Y to the app" triggers (those are now `formio-application`'s modify-existing branch). `formio-angular-resources`'s trigger surface narrows to framework-explicit phrasings ("add an Angular module for X", "regenerate the Angular X resource", "fix the Angular <component> component") and handoff from `formio-angular`. Users can still invoke it directly if they explicitly name Angular; generic extension requests flow through `formio-application`.
- **MODIFIED `formio-angular` body** — the parent skill's "Inference" phase is removed (planner now runs inside `formio-application`); the Import phase proposed in the prior iteration moves to `formio-application`; SETUP may be satisfied by the URLs `formio-application` handed over, in which case it is skipped. Phases 1–4 (SETUP/CONFIG/AUTH/Resources) remain as `formio-angular`'s responsibility, with SETUP and AUTH gaining short "invoked from `formio-application`" paths that consume already-captured values.
- **MODIFIED `formio-resource-planner` behavior** — when invoked from `formio-application` (build-new branch), the planner also writes `template.json` to the user's working directory. Standalone planner use also writes the file; standalone transcript emission continues alongside the file write.

## Capabilities

### New Capabilities

- `formio-application-skill`: Framework-agnostic orchestrator skill that owns the end-to-end "build me an app" flow — intent capture, URL interview, MCP authentication, template import, and framework routing. Sits above all framework-specific skills (`formio-angular`, future `formio-react`, etc.) and is the sole claimant of generic build-me-an-app triggers.

### Modified Capabilities

- `formio-angular-skill`: Trigger-surface narrows from "the library's default build-an-app skill" to "the Angular framework implementor, invoked by `formio-application` or by framework-explicit user requests". The parent `formio-angular` drops the Inference phase (planner handoff moves to `formio-application`) and the Import phase (also moves to `formio-application`); it exposes SETUP-skip paths that consume URLs handed in by `formio-application`. The sub-skill `formio-angular-resources` narrows to framework-explicit extend triggers only.

## Impact

- **Skills library:**
  - New `skills/formio-application/` directory with `SKILL.md`, `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`.
  - `.claude/skills/formio-application` symlink added → `../../skills/formio-application`.
  - `skills/formio-angular/SKILL.md` frontmatter + body updated (narrower triggers, removed Inference/Import phases, SETUP-skip from application handoff).
  - `skills/formio-angular/resources/SKILL.md` frontmatter updated (narrower triggers).
  - `skills/formio-resource-planner/SKILL.md` updated (writes `template.json` to cwd on Phase B).
- **MCP server:** no code changes. Reuses `project_import` tool and lazy-auth flow as-is.
- **Tests:** new assertions covering the new skill's presence, frontmatter, trigger phrases, sibling docs, and the demoted `formio-angular` / `formio-angular-resources` trigger surfaces.
- **CLAUDE.md:** updated "Skills Library" paragraph to name `formio-application` as the build-an-app entry point.
- **User-facing behavior:**
  - "I want to build a CRM" → `formio-application` activates → planner → URL interview → auth → import → framework picker (or auto-route when only Angular exists) → `formio-angular` scaffolding → running app.
  - "Build it in Angular" or explicit Angular phrasing → `formio-angular` activates directly (bypasses `formio-application`).
  - "Also track attendees in my existing app" → `formio-application` activates, detects existing app via workspace inspection, routes to `formio-angular-resources`.
- **Forward compatibility:** when `formio-react` is later added, it drops into `FRAMEWORK.md`'s registry with zero code changes to `formio-application` — the multi-framework branch of step 5 activates automatically.
- **No backward-compatibility shims** per project rules. Trigger surfaces are rewritten cleanly.
