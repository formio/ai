## Context

Two read-only checks on 2026-10-12 confirmed every routing and contract item from the pre-1.0 review against `main` (90df924). Two constraints shape the fixes:

- **Descriptions are pinned and nearly full.** `mcp-setup-skill.test.ts` compares twelve descriptions byte-for-byte with `fixtures/descriptions-before-preflight.json`, and `description-budget.test.ts` caps each at 1,024 characters after whitespace normalisation. `formio-application` has 39 characters of headroom.
- **Nothing measures routing.** The three eval harnesses grade generated output; the routing tests are string checks on descriptions, and none would catch the loop in which `formio-react` and `formio-application` each send a framework-named build to the other.

The PDF lane in `formio-form-builder` is left alone: open PR #83 hands PDF forms to a new `formio-pdf-form` skill and rewrites the same lines. Proposal 7 owns the planner's delta mode; proposal 8 owns the shared preamble and tests that compare skill text with tool schemas.

## Goals / Non-Goals

**Goals:**

- Every request reaches one skill, which can finish it without asking the user to re-route.
- One statement of each cross-skill contract, linked from everywhere else.
- Every path an installed skill names resolves in an installed layout.
- A routing eval that shows the change did not make routing worse.

**Non-Goals:**

- Server changes. The `.git` boundary on the mapping lookup is specified behaviour (`project-map-routing`); the skills work with it.
- Rewording descriptions beyond what a routing fix needs.

## Decisions

### 1. Framework-named builds split on whether a plan exists

`formio-application` claims any build that needs planning, framework named or not, and carries the framework to Step 4 (`FRAMEWORK.md` already skips the question when one was named). `formio-angular` and `formio-react` keep framework-named work on a planned, imported project or an existing workspace. Reached with no plan, they hand the request to `formio-application` with the framework, telling the user in one line that planning comes first.

*Alternatives:* letting each framework skill run the planner duplicates the orchestration and the import gate in three places; leaving the orchestrator's "do not activate" in place keeps the loop. The two new hand-off paragraphs in `formio-angular` and `formio-react` are written either byte-identical or clearly different, because `shared-prose-stays-identical.test.ts` fails a near-copy.

### 2. Descriptions change only where routing needs it; the snapshot moves with a reason

`formio-application` (about 1,014 characters after the edit), `formio-angular` (about 961), `formio-react` (about 922), `formio-mcp-setup` (about 986), and the two nested form sub-skills change. Each re-snapshot in `descriptions-before-preflight.json` carries a one-line reason in the test's comment block. `framework-registry.test.ts`'s check that the orchestrator's description names `formio-react-resources` is inverted to check that it names no nested sub-skill. No description changes for the saved-form writer: `formio-schema`'s description may not contain the substring `formio-form`, so that routing lives in bodies.

### 3. Handoffs carry a directory, not URLs

`FRAMEWORK.md`'s handoff reference becomes the one contract table: per branch and receiver, the fields passed (`workspacePath`, `templateMdPath`, `templateJsonPath`, the user's request as a quoted requirements block, `frontendDesignStatus`, the named framework), that no URL is among them, and that the receiver calls `project_get` with `workspacePath`. The URLs Step 3 resolved are used for the import only. A receiver that reads the record itself cannot act on a stale copy, and every receiver already calls `project_get`. Strings tests pin — `src/config.ts` / `src/app/config.ts`, and the "quoted as a requirements block" wording — are kept.

**Workspace scaffolding.** The server's mapping lookup and committed-file walk both stop at the first directory containing `.git`. A scaffold that creates one (`ng new`), or a later `git init`, cuts a workspace off from a project resolved from its parent's mapping, a parent's committed file, or the environment — and the environment might then name a different project. So SETUP in `formio-angular` and `formio-react`, when the workspace is about to be scaffolded and the report is not the workspace's own mapping, records the pair for the workspace root with `project_set` before the scaffold: the Project URL, and the Base URL whenever `baseUrlSource` is not `derived`, so a recorded deployment is not lost. Recording first replaces an earlier post-scaffold re-check, which missed the environment case and dropped a recorded Base URL. `workspacePath` is defined as the `cwd` the Step 3 Preflight's `project_get` reported, and `formio-auth` resolves it when handed one.

### 4. formio-auth runs once, at Step 3.5

The planner stops invoking `formio-auth` at map approval: auth configuration acts on the imported project, which does not exist yet, and the orchestrator invokes it again at Step 3.5. A standalone planner run lists "configure auth with `formio-auth` after import" in its Next-steps menu instead. Step 3.5's trigger gains "RBAC tuning" to match the planner's list. `CLAUDE.md`'s statement of the handoff point changes with it. The stale "future `formio-react`" in `phase-b-emission.md` is corrected.

### 5. Registration through form-builder repoints the default Save

`form_create` gives a new form a Save action with empty settings (`apps/formio/src/actions/formActionHandler.js` ~17-37), which stores submissions on the form itself (`SaveSubmission.js` ~68-74). Login searches only its `settings.resources` (`authentication/index.js` ~358-361), so users registered that way can never sign in. The pattern updates that Save with `action_update` to `settings.resource` = the user resource `_id` and a `settings.fields` map — the planner's register pattern in `template-json.md` — adds Role Assignment only when the user resource does not already assign the role, and routes to the planner when the project has no user resource.

*Alternative:* routing every registration request to the planner. Default projects ship a `user` resource, so the short path stays available and correct.

### 6. One writer for a saved form

`formio-form-builder`'s edit lane already owns edits to a saved form, gated and test-pinned (`collision-guards.test.ts`). `formio-form` keeps the behaviour documentation every framework skill links to and sends writes to that lane; `formio-schema`'s body does the same. Its portal-login sentence, which a test requires, stays.

### 7. Paths are relative to the file that names them

Twenty-six load instructions and four self-location banners name `plugin/skills/...`. Each becomes a path relative to its file (`../formio-angular/formio-angular-resources/SKILL.md`, `../../formio-resource-planner/references/template-json.md`); banners drop the prefix. `portable-layout.test.ts` gains a check that no markdown under `plugin/skills/` contains `plugin/skills/`.

### 8. Contributor instructions leave the shipped tree

`FRAMEWORK.md`'s "how to add a framework" section and its contributor asides move to `CONTRIBUTING.md` under "Working on skills". `framework-registry.test.ts` checks the Vue example there and checks that `FRAMEWORK.md` has no such section, no `npm test`, and no `formio-vue` path.

### 9. Sub-skill gates

`formio-angular-resources` drops the URL question from its batched round and its new-workspace mode (round 1, Phase B's `ng new`, the plan template's Mode line, the worked example); with no wired workspace it routes to `formio-angular`. Its stale "Step 5" references to the orchestrator are corrected. `formio-react/EXISTING.md` gains a rendering-mode gate ahead of the data-router gate; the signal stays out of `FRAMEWORK.md`, where a test forbids `next.config.*`.

### 9a. formio-angular-resources keeps wiring an existing workspace

The sub-skill stops and routes to `formio-angular` only when there is no Angular workspace (no `angular.json`). An existing workspace whose `AppModule` lacks `FormioAppConfig` is still extended and wired, as on `main` — refusing it would remove a capability the sub-skill's eval-1 measures. Because the new-workspace mode is gone, the sub-skill's own eval harness now seeds every eval with `fixtures/existing-workspace-seed/`, and its three new-workspace prompts extend a seeded workspace instead. That harness was not re-run in this change; its graded output — resource modules, routing, joins — is unchanged.

### 5a. A login form drops the default Save

The same default Save from `form_create` matters on a login form: it runs before the Login action and switches the form's own storage back on (`SaveSubmission.js` ~61-69), so every login attempt is stored as a submission on the login form. Form.io's own login form carries no Save. `formio-actions` now says to find it with `action_list` and remove it with `action_delete` after confirming with the user.

### 10. Routing eval

`packages/skill-tests/evals/skill-routing/` follows the harness layout in `CLAUDE.md`. Each run gives a grader subagent every registered skill's live `description` and one prompt and records the skill it would activate; `grade.py` compares against `evals.json`. This is a proxy for client activation, which is not observable from here, but it reads exactly the text a client routes on, and it catches a description that claims, or disclaims, the wrong request. The baseline runs on `main` before any skill edit, and the result is recorded below.

## Risks / Trade-offs

- [Description edits shift routing for prompts no one listed] → The eval covers every boundary the library draws, and a prompt passing on `main` must pass after.
- [The routing proxy is not the client's real activation] → Recorded as a limit; the eval is for regressions in the text, the part this repository controls.
- [Conflict with #83] → No edits to the PDF lane, `form-definition.md`'s `pdf` row, `pdf-api.md`, or `INTENT.md`'s PDF line.
- [`formio-application` description at about 10 characters of headroom] → Measured before commit; anything over budget is trimmed elsewhere in the same description.

## Routing eval results

**Baseline — `main` (90df924), before any skill edit:** 28/32. The four failures are the ones this change targets: `build-react-no-plan`, `build-angular-no-plan`, and `build-react-use-react` reached the framework skill instead of `formio-application`, and `mcp-login` reached `formio-auth` instead of `formio-mcp-setup`. The grader for `extend-generic` (a framework-neutral "also track X" in an existing Angular workspace) chose `formio-application` but called it a close call against `formio-angular`.

**After the change:** 32/32. Every prompt that passed on `main` passes, and the four targeted prompts now pass (`mcp-login` routes to `none`, which the eval accepts: `formio-mcp-setup`'s description now answers that the login opens on the first tool call).

**The run in between caught a regression.** The first draft of `formio-application`'s Not-for clause handed "Angular or React work … in an existing Angular/React workspace" to the framework skills, and `extend-generic` — "also track X" in an Angular workspace, no framework named — moved to `formio-angular` (31/32). The clause now reads "Angular- or React-named work", a test pins that, and the final run is the 32/32 above. The grader still called `extend-generic` the closest decision in the set.

## Migration Plan

Markdown, fixtures, and tests only. Ships in the 1.0 release with an `@formio/ai` patch changeset.

## Open Questions

None.
