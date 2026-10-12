## Why

The pre-1.0 review found places where the skills route a request in a circle, hand each other contradictory contracts, or point at files that do not exist once the library is installed. Each was re-checked on 2026-10-12 against `main` (90df924) and, for server behaviour, against nirvana. "Build me a CRM in React" lands in `formio-react`, which sends the user to `formio-application`, whose description says not to activate for a framework-named request. A registration form built through `formio-form-builder` stores its users where Login never looks. `formio-auth` can run twice in one orchestrated build. Twenty-six instructions tell the agent to load a file at a `plugin/skills/...` path that only exists inside this repository.

These are effectiveness bugs: an agent following the skills today loops, asks the user to re-route by hand, or builds something that does not work. Nothing measures routing today, so this change adds a routing eval and requires it not to regress.

## What Changes

- **Framework-named builds route by whether a plan exists.** `formio-application` claims a build that needs planning whether or not a framework is named, and carries the named framework to Step 4 without asking. `formio-angular` and `formio-react` keep framework-named work on an already-planned project or workspace; reached with no plan, each hands off to `formio-application` with the framework, instead of telling the user to invoke it.
- **Descriptions name only registered skills.** `formio-application`'s description and routing table, and the two nested form sub-skills' descriptions, name `formio-angular` / `formio-react` rather than nested sub-skills that clients load by path.
- **`formio-mcp-setup`'s description** says logging in to Form.io happens in the browser on the first tool call, and keeps `formio-auth` for an application's end-user auth.
- **One handoff contract.** `FRAMEWORK.md`'s handoff reference becomes the single contract table: no Project URL or Base URL in any payload; each receiving skill calls `project_get` for the workspace directory it is given. `SKILL.md`, `INTENT.md`, `IMPORT.md`, and the framework skills link to it instead of restating it. The non-standard `formioProjectUrl` / `formioBaseUrl` field names go.
- **A workspace keeps its project after scaffolding.** A skill that creates a workspace checks `project_get` for it afterwards and, if scaffolding cut it off from an ancestor's mapping (a new `.git` ends the server's lookup), records the project already resolved with `project_set`.
- **`formio-auth` runs once, after import.** The planner no longer invokes it at map approval; `formio-application` Step 3.5 does, after the project exists. A standalone planner run lists it as a next step.
- **Registration through form-builder saves to the user resource.** `formio-actions`' registration pattern updates the form's default Save action to the user resource with a field map, and routes to the planner when the project has no user resource. `formio-auth/references/login-forms.md` matches.
- **One writer for a saved form's definition.** `formio-form` keeps the behaviour documentation and sends writes to `formio-form-builder`'s gated edit lane; `formio-schema`'s body does the same.
- **Installed paths.** Every `plugin/skills/...` path in shipped markdown becomes relative to the file that names it, and a test forbids the prefix.
- **`FRAMEWORK.md` ships no contributor instructions.** The "how to add a framework" checklist moves to `CONTRIBUTING.md`.
- **`formio-angular-resources`** asks no URL question and has no new-workspace mode; with no wired workspace it routes to `formio-angular`.
- **`formio-react` existing-app gate.** `EXISTING.md` stops before the data-router gate for a Next.js or framework-mode React Router app, offers the embed branch, and never offers a conversion.
- **Routing eval.** `packages/skill-tests/evals/skill-routing/` holds trigger prompts with the skill each should reach, a grader, and a baseline recorded on `main` before any edit.

Out of scope: the PDF lane in `formio-form-builder` (open PR #83 replaces it); the planner's delta mode (proposal 7); preamble consolidation and schema-vs-prose tests (proposal 8).

## Capabilities

### New Capabilities

- `skill-routing-evals`: a trigger-prompt eval measuring which skill a request reaches, run before and after any description or routing change.

### Modified Capabilities

- `formio-application-skill`: description routing, the registry requirement (contributor checklist removed), project resolution and the handoff contract, `formio-auth` at Step 3.5.
- `formio-angular-skill`: direct invocation with no plan, project resolution through `project_get`, workspace mapping after scaffolding, `formio-angular-resources` questions.
- `formio-react-skill`: direct invocation with no plan, the rendering-mode gate.
- `formio-resource-planner-skill`: no `formio-auth` invocation from the planner.
- `formio-mcp-setup-skill`: description's login wording.
- `formio-actions-skill`: registration pattern.
- `formio-form-skill`: MCP Tool Preference routes writes to `formio-form-builder`.
- `formio-schema-skill`: body routes writes to `formio-form-builder`.
- `skills-cli-distribution`: shipped markdown names no repo-relative path.

## Impact

- Markdown under `plugin/skills/` (about 35 files); `CONTRIBUTING.md`; `CLAUDE.md`.
- `packages/skill-tests`: the description snapshot fixture (`fixtures/descriptions-before-preflight.json`), `framework-registry.test.ts`, `portable-layout.test.ts`, new routing tests, and the new `evals/skill-routing/` harness.
- No MCP server code changes.
- Changeset: `@formio/ai` patch (folds into the pending 1.0 major).
