## 1. Author `formio-application` skill files
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: `skills/formio-application/SKILL.md` exists and has frontmatter with `name: formio-application`. Place under `packages/mcp-server/src/__tests__/formio-application-layout.test.ts` (new file, mirroring the structure of `formio-angular-layout.test.ts`).
- [x] 1.2 Write failing test: `skills/formio-application/` contains `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`, and none of them begin with a YAML frontmatter block.
- [x] 1.3 Write failing test: `.claude/skills/formio-application` symlink exists and resolves (via `fs.realpathSync`) to `skills/formio-application/`.
- [x] 1.4 Write failing test: `SKILL.md` frontmatter `description` claims at least three plain-language build-new triggers (e.g., "build me an app", "create a CRM", "I need a tool to track") and at least two plain-language extend triggers (e.g., "also track", "add a way to see"), with no mention of "Angular", "React", "resource", "NgModule", or "module" as required triggers.
- [x] 1.5 Write failing test: `SKILL.md` description contains `Not for:` clauses pointing at `formio-angular`, `formio-angular-resources`, `formio-resource-planner`, and `formio-api`.
- [x] 1.6 Write failing test: `SKILL.md` body names the five steps (Intent, Deployment, Authenticate, Import, Framework) in order and references the four sibling docs by relative link.

### Green

- [x] 1.7 Author `skills/formio-application/SKILL.md` — invoke `skill-creator` in "create new skill" mode, feeding it the trigger-surface requirements from the spec. The body must describe the five-step orchestration and link to `INTENT.md`, `DEPLOYMENT.md`, `IMPORT.md`, `FRAMEWORK.md`.
- [x] 1.8 Author `skills/formio-application/INTENT.md` — plain markdown, no frontmatter. Documents the build-vs-modify `AskUserQuestion` with exactly two explicit options, and the downstream-routing consequence of each answer (build-new → planner + Steps 2-5; modify-existing → skip to Step 5 framework-detection path).
- [x] 1.9 Author `skills/formio-application/DEPLOYMENT.md` — plain markdown. Documents the batched `AskUserQuestion` capturing Base URL and Project URL with plain-language descriptions and hosted + self-hosted example values. Names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` explicitly.
- [x] 1.10 Author `skills/formio-application/IMPORT.md` — plain markdown. Documents the offer-to-import gate, pre-auth messaging, import-confirmation preview with merge-overwrite warning, `project_import` invocation, the three error branches (401/403, 404, 400), and the headless-environment fallback (print portal-login URL).
- [x] 1.11 Author `skills/formio-application/FRAMEWORK.md` — plain markdown. Contains the framework registry table (initially one row: Angular) with columns for Framework, Entry skill, Extend sub-skill, Detection signal. Documents single-row silent routing, multi-row `AskUserQuestion` routing, modify-existing detection signals, and how to add a new framework row.
- [x] 1.12 Create the `.claude/skills/formio-application` symlink pointing at `../../skills/formio-application`.

### Refactor

- [x] 1.13 Review implementation and refactor as needed

## 2. Demote `formio-angular` and `formio-angular-resources` trigger surfaces
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: `skills/formio-angular/SKILL.md` frontmatter `description` contains at least three Angular-explicit trigger phrases (e.g., "build it in Angular", "Angular front-end", "use Angular") AND does NOT contain the generic phrases "build me an app", "build me a tool", "spin up an app", "I need a tool to track", or the bare domain archetypes "task manager", "help desk", "CRM", "booking system".
- [x] 2.2 Write failing test: `skills/formio-angular/SKILL.md` description contains the literal substring `formio-application` and a `Not for:` clause pointing at it.
- [x] 2.3 Write failing test: `skills/formio-angular/resources/SKILL.md` frontmatter `description` contains at least three Angular-explicit extend trigger phrases (e.g., "add an Angular module", "regenerate the Angular", "in my Angular app") AND does NOT contain the generic phrases "also track", "also let", "add a way to see", "each X should have a list of Y".
- [x] 2.4 Write failing test: `skills/formio-angular/resources/SKILL.md` description contains the literal substring `formio-application` and a `Not for:` clause pointing at it.

### Green

- [x] 2.5 Invoke `skill-creator` in "modify existing skill" mode on `skills/formio-angular/SKILL.md` to rewrite the frontmatter `description`: drop all generic build-an-app phrasing; claim only Angular-explicit triggers; add `Not for:` clauses pointing at `formio-application` (generic build-an-app), `formio-angular-resources` (add-a-feature), `formio-resource-planner` (data-model planning), `formio-api` (endpoint lookups).
- [x] 2.6 Invoke `skill-creator` in "modify existing skill" mode on `skills/formio-angular/resources/SKILL.md` to rewrite the frontmatter `description`: drop all generic extend phrasing; claim only Angular-explicit extend triggers; add `Not for:` clauses pointing at `formio-application` and parent `formio-angular`.

### Refactor

- [x] 2.7 Review implementation and refactor as needed

## 3. Remove the Inference phase from `formio-angular` body and add handoff-mode SETUP
<!-- depends_on: 2 -->

### Red

- [x] 3.1 Write failing test: `skills/formio-angular/SKILL.md` body does NOT contain a section titled "Phase 0 — Inference" or any equivalent section that describes a planner handoff inside this skill.
- [x] 3.2 Write failing test: `skills/formio-angular/SKILL.md` body documents the "handoff from `formio-application`" path in its SETUP section — when URLs are handed in, the skill confirms them and skips the interview.
- [x] 3.3 Write failing test: `skills/formio-angular/SKILL.md` body mentions that it does NOT run `project_import` and that the Import phase lives in `formio-application`.

### Green

- [x] 3.4 Edit `skills/formio-angular/SKILL.md` body — delete the current "Phase 0 — Inference" section. Replace the opening "Stance" paragraph so the skill is described as "the Angular framework implementor invoked by `formio-application` (or directly by a framework-explicit user request)" instead of "the default build-an-app skill".
- [x] 3.5 Edit the SETUP phase section (both in `SKILL.md` and in `SETUP.md`) to document the handoff-mode path: when `formio-application` has already captured URLs, confirm them with one short acknowledgement and skip the interview.
- [x] 3.6 Add a short paragraph to `skills/formio-angular/SKILL.md` stating that Import (template import into a Form.io project) is NOT this skill's responsibility — it lives in `formio-application`.
- [x] 3.7 Update the "Inputs you expect" section — acceptable inputs now include (a) handoff context from `formio-application`, (b) an approved `template.json` + existing Angular workspace, (c) a framework-explicit user request naming Angular. Greenfield "I want to build an app" is no longer listed (that routes to `formio-application`).

### Refactor

- [x] 3.8 Review implementation and refactor as needed

## 4. Planner writes `template.json` to disk
<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing test: `skills/formio-resource-planner/SKILL.md` body explicitly documents writing `template.json` to the user's working directory on Phase B — the markdown names the file, names the `Write` tool, and documents the `template-<timestamp>.json` fallback when the file already exists.
- [x] 4.2 Write failing test: planner's Phase B guidance includes a statement that the file-write happens in BOTH standalone planner use AND when invoked from `formio-application`.

### Green

- [x] 4.3 Edit `skills/formio-resource-planner/SKILL.md` "Phase B — template.json after approval" section — add explicit instructions for the skill to (a) write the emitted JSON to `./template.json` in cwd using the `Write` tool, (b) fall back to `./template-<timestamp>.json` when the file already exists, (c) report the chosen filename in the Phase B confirmation message, (d) keep emitting the fenced `json` block in the chat (file-write is additive). Preserve the "does not call the MCP server" stance; local filesystem writes are explicitly permitted.

### Refactor

- [x] 4.4 Review implementation and refactor as needed

## 5. Update `CLAUDE.md` and cross-skill references
<!-- depends_on: 1, 2, 3, 4 -->

### Red

- [x] 5.1 Write failing test: `CLAUDE.md` "Skills Library" paragraph names `formio-application` as the default build-an-app entry point and references its directory at `skills/formio-application/`.
- [x] 5.2 Write failing test: repo-wide search for references to the old "`formio-angular` is the default build-an-app skill" framing returns zero matches outside of (a) archived openspec changes and (b) this change's own artifacts.

### Green

- [x] 5.3 Edit `CLAUDE.md` — update the "Skills Library" paragraph to name `formio-application` as the new entry point, noting that `formio-angular` is now a framework implementor called by `formio-application`. Retain the note about eval harnesses on `formio-resource-planner` and `formio-angular`.
- [x] 5.4 Spot-check `skills/formio-resource-planner/SKILL.md` and `skills/formio-resource-planner/evals/README.md` for any references to `formio-angular` as the "next step after Phase B" — update to name `formio-application` instead (the planner's standalone behavior still points at `formio-application`, which can then route to a framework).

### Refactor

- [x] 5.5 Review implementation and refactor as needed

## 6. Verify end-to-end via Definition of Done
<!-- depends_on: 1, 2, 3, 4, 5 -->

### Red

- [x] 6.1 Write failing test: every `SKILL.md` under `skills/formio-application/` and `skills/formio-angular/` parses as valid YAML frontmatter + body (regression guard — YAML quoting issues like colons + spaces mid-description must not re-appear).
- [x] 6.2 Write failing test: integration-style assertion that the trigger surfaces do not overlap — `formio-application` description claims at least one generic phrase that `formio-angular` description does NOT contain, and vice versa for Angular-explicit phrases.

### Green

- [x] 6.3 Run `pnpm test` — all Vitest tests pass, including every assertion added in groups 1–5.
- [x] 6.4 Run `pnpm lint` — no TypeScript / ESLint errors.
- [x] 6.5 Run `pnpm format` — code is formatted.
- [x] 6.6 Run `skill-creator`'s description-optimization / variance pass on `skills/formio-application/SKILL.md` to confirm the description holds up across paraphrasings of "build me an app" and "also track X".
- [x] 6.7 Spot-check by reading the full `skills/formio-application/SKILL.md` top-to-bottom — the five-step narrative reads as one coherent document; references to sibling docs are all live; no stale mentions of "Phase" numbering that only made sense in the prior `formio-angular`-owns-everything design.

### Refactor

- [x] 6.8 Review implementation and refactor as needed
