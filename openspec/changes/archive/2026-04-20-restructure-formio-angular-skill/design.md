## Context

The current skill layout has `formio-resource-angular` as a peer of `formio-resource-planner`. Both are top-level skills in `.claude/skills/`. That was fine when the assumption was "user already has an Angular+Form.io app wired up and just wants resource CRUD." Post-`formio-resource-planner`, the assumption inverts: the user now has a `template.json` and an empty directory. The resource skill doesn't cover — and shouldn't cover — the `AppConfig`, auth-module, and boot-sequencing work that has to happen before any `FormioResource` module can run.

The `@formio/angular` demo (https://github.com/formio/angular-demo) is the canonical pattern:

- `src/app/config.ts` exports `AppConfig: FormioAppConfig` with `appUrl` (project URL) and `apiUrl` (platform/base URL).
- `src/app/app-module.ts` imports `FormioModule`, `FormioAppConfig`, `FormioAuthService`, and registers `AppConfig` via `{ provide: FormioAppConfig, useValue: AppConfig }`.
- `src/app/auth/auth.module.ts` configures `FormioAuthConfig` (login/register form names, auth routes) and is imported into `AppModule`.
- Only after those three pieces are in place do resource modules (`FormioResourceConfig` + `FormioResourceRoutes`) actually work.

The planner's `template.json` already encodes the answers the auth module needs — the user resource name, login form, register form, role names. Those flow directly into `FormioAuthConfig`.

Constraints:

- Claude Code's skill loader discovers skills by `SKILL.md` files under `.claude/skills/<dir>/`. Nested `SKILL.md` files are also discovered (the `formio-api` router + capability-group skills demonstrate this pattern today).
- The `packages/mcp-server/src/skills-validator.ts` validator only enforces `formio-api` skills (see `REQUIRED_SKILL_DIRS`). Non-API skills are not validated today, so no validator change is required for this restructure.
- The resource skill's eval harness lives at `skills/formio-resource-angular/evals/` and writes artifacts to `.eval-artifacts/formio-resource-angular/iteration-N/`. The path string appears in `evals/grade.py`, `evals/README.md`, and `evals/evals.json`.

Stakeholders: developers consuming the skill library via Claude Code; the `formio-resource-planner` skill (hands off); future eval-driven iteration on either skill.

## Goals / Non-Goals

**Goals:**

- One skill — `formio-angular` — is the canonical entry point for any "build an Angular app using Form.io" request.
- The parent skill owns a deterministic setup order: SETUP → CONFIG → AUTH → resources. Each phase has an approval gate.
- `template.json` from the planner is the primary input; the parent skill reads it once and feeds derived values to CONFIG (project URL from the `template.json` `name`), AUTH (auth resources, login/register forms, roles), and the resources sub-skill (resource list).
- The resources sub-skill keeps its current eval harness, fixtures, and iteration loop — just relocated.
- The sub-skill's trigger surface shrinks to "add/regenerate a resource in an already-configured app." The top-level Angular-app triggers route to the parent.

**Non-Goals:**

- Changing what the resource sub-skill does once it's triggered. The Phase A / Phase B cadence, file shapes, module patterns, bidirectional joins, transitive group access — all stay as-is.
- Adding eval harnesses for SETUP / CONFIG / AUTH in this change. (Future work; noted as open question.)
- Supporting non-Angular frameworks, standalone components, or non-`@formio/angular` auth patterns.
- Modifying `packages/mcp-server/src/skills-validator.ts`. The validator's `formio-api` scope doesn't cover these skills, and broadening it is out of scope.

## Decisions

### Skill layout: parent with nested sub-skill

```
skills/formio-angular/
  SKILL.md                 # parent — orchestration + triggers
  SETUP.md                 # URL interview
  CONFIG.md                # FormioAppConfig + config.ts generation
  AUTH.md                  # AuthModule + FormioAuthConfig wiring
  resources/
    SKILL.md               # sub-skill — current formio-resource-angular SKILL.md, trigger clause rewritten
    references/            # moved from skills/formio-resource-angular/references/
    assets/                # moved from skills/formio-resource-angular/assets/
    evals/                 # moved from skills/formio-resource-angular/evals/
```

Rationale: matches the `formio-api` → `formio-api-<group>` precedent already in this repo. `SETUP.md`, `CONFIG.md`, `AUTH.md` are sibling reference documents loaded by the parent `SKILL.md` — they are NOT separate skills (no frontmatter, no `description`). This avoids polluting Claude Code's skill-triggering surface with four new entries for what is logically one skill.

**Alternative considered:** four peer skills (`formio-angular-setup`, `formio-angular-config`, `formio-angular-auth`, `formio-angular-resources`). Rejected — the loader would have to decide between them on every prompt, and the setup order is strictly sequential. A single parent enforcing order is cleaner.

**Alternative considered:** keep everything in one monolithic `formio-angular/SKILL.md`. Rejected — SETUP/CONFIG/AUTH each have enough surface area (interview scripts, code templates, references to external docs) that inlining them makes the parent unreadable. The current `formio-resource-angular/SKILL.md` is already ~29 KB; tripling it would break the "fits in one context load" expectation.

### Trigger-surface split

- **Parent `formio-angular`** triggers on: "build the Angular app", "scaffold the Angular side", "generate the Angular CRUD for this plan", "wire up Angular for Form.io", "set up the Angular workspace", "I need an Angular front-end for this template". Explicit handoff phrase from the planner: "Run `formio-angular` next." Fires even when the user doesn't say the word "Form.io."
- **Sub-skill `formio-angular:resources`** triggers on: "add a Resource module for `<X>`", "regenerate the `<X>` module", "the `<X>` resource module is missing a route", "wire `<X>`'s children to `<Y>`". Triggers only inside a project whose `app-module.ts` already imports `FormioAppConfig` (parent is satisfied).

The parent's `description` explicitly names the sub-skill in a "For adding resources to an already-configured app, see `formio-angular:resources`" clause — mirrors the negative-trigger pattern in `formio-api` skills. The sub-skill's `description` reciprocally says "Not for initial app scaffolding — see parent `formio-angular`."

### Handoff between phases

The parent enforces a linear gate sequence:

1. **SETUP gate.** After interview, the parent prints: "I will configure the app for `Project URL = X`, `Base URL = Y`. Proceed?" Waits for approval. No files written.
2. **CONFIG gate.** After printing a diff-style preview of `src/app/config.ts` and the `AppModule` additions, waits for approval. Then writes.
3. **AUTH gate.** Reads `template.json`, infers auth resources/roles, prints preview of `src/app/auth/auth.module.ts` and the `AppModule` wiring. Waits for approval. Then writes.
4. **Resources handoff.** Parent invokes the `resources/` sub-skill with context already populated (workspace path, config values, auth module, planner `template.json`). Sub-skill then runs its own Phase A / Phase B (unchanged from today).

Rationale: matches the approval cadence the planner already established. Users can bail at any gate without partial state.

### Eval-artifact path rename

`.eval-artifacts/formio-resource-angular/` → `.eval-artifacts/formio-angular-resources/`. The rename keeps the artifact namespace unambiguous (one entry per top-level skill dir + dot-separated sub-skill). Alternative `.eval-artifacts/formio-angular/resources/` was rejected because it breaks the existing flat structure the grader expects.

`evals/grade.py`, `evals/README.md`, and any string constant in `evals/evals.json` get the path updated. `.gitignore` already uses the prefix pattern `.eval-artifacts/` so no change needed there.

### CLAUDE.md update

One-line replacement under "Iterating on skills": `formio-resource-planner` and `formio-resource-angular` → `formio-resource-planner` and `formio-angular` (with resource sub-skill at `skills/formio-angular/resources/`).

### Skill-creator drives new-skill authoring

All new `SKILL.md` authoring in this change (parent `skills/formio-angular/SKILL.md` and the rewritten `skills/formio-angular/resources/SKILL.md` frontmatter) MUST go through the `skill-creator` skill. Rationale: `skill-creator` owns the repo's standard for skill frontmatter, description-triggering discipline, body structure, and eval wiring — hand-rolling skills drifts from that standard. The sibling reference documents (`SETUP.md`, `CONFIG.md`, `AUTH.md`) are not skills (no frontmatter), so they are authored directly without `skill-creator`.

Application during apply:

- Group 2 (sub-skill frontmatter rewrite) invokes `skill-creator` to regenerate the `description` so the trigger-surface narrowing meets the standard.
- Group 3 (parent `SKILL.md`) invokes `skill-creator` to author the parent from scratch.
- After group 3 lands, the parent skill's `description` is run through `skill-creator`'s description-optimization pass (variance analysis against the eval set) before the change ships.

### No backward-compatibility alias

Per project rules (`CLAUDE.md`: "No backward compatibility — unless explicitly requested, make breaking changes cleanly without shims, aliases, or legacy fallbacks"), there is no `formio-resource-angular` forwarding stub. The old symlink and directory are removed. Any transcript or doc referencing the old name is updated in this change.

## Risks / Trade-offs

- **Trigger-surface regression** → the parent's description has to pull every phrase the resource skill used to claim ("build the Angular app", "scaffold the UI", "wire the Angular side") *without* also claiming the narrower "add a resource module" phrasing that should route to the sub-skill. Mitigation: the parent description lists positive triggers plus an explicit "Not for: adding an individual resource module to an already-configured app — see `formio-angular:resources`." The sub-skill mirrors the inverse. Both get exercised against the existing eval set plus 2–3 new prompts for the setup/config/auth flows.
- **Sub-skill discovery** → Claude Code's skill loader must pick up `skills/formio-angular/resources/SKILL.md`. Mitigation: the `formio-api` router pattern is already nested, so the loader handles this. Verified during implementation by spawning a test prompt and inspecting the skill list.
- **Eval-path rename breaks in-flight iterations** → any contributor with a local `.eval-artifacts/formio-resource-angular/` from recent runs will see their artifacts orphaned. Mitigation: `.eval-artifacts/` is gitignored and regenerated per run; no persistent state is lost. Call this out in the PR description.
- **Parent-skill bloat** → four files (SKILL + SETUP + CONFIG + AUTH) is still a lot to keep coherent. Mitigation: each file has a single clear topic; the parent `SKILL.md` is an index/orchestrator and delegates to the others. If any one file grows past ~10 KB, split it further.
- **Planner→angular handoff assumes a `template.json`** → users who didn't run the planner first get sent back to it. Mitigation: the parent's interview has a first question "Do you have an approved `template.json` from `formio-resource-planner`?" — if no, the parent runs the planner (or tells the user to) before proceeding. Same cadence the resource skill uses today.

## Migration Plan

This is a skills-library restructure, not a runtime migration. Steps:

1. Move `skills/formio-resource-angular/{references,assets,evals,SKILL.md}` to `skills/formio-angular/resources/`.
2. Rewrite `skills/formio-angular/resources/SKILL.md` frontmatter `name` → `formio-angular-resources`; rewrite `description` to narrow the trigger surface (see Decisions → Trigger-surface split).
3. Author new `skills/formio-angular/{SKILL.md,SETUP.md,CONFIG.md,AUTH.md}`.
4. Replace `.claude/skills/formio-resource-angular` symlink with `.claude/skills/formio-angular` → `../../skills/formio-angular`.
5. Update `.eval-artifacts/formio-resource-angular` references in `skills/formio-angular/resources/evals/{grade.py,README.md,evals.json}`.
6. Update `CLAUDE.md` "Iterating on skills" paragraph to name the new parent + sub-skill.
7. Update any remaining references (`skills/formio-resource-planner/evals/README.md` cross-links).
8. Run `pnpm test && pnpm lint && pnpm format`. Run the existing resource-skill evals under the new path to confirm the harness still works end-to-end.

Rollback: revert the PR. The move is contained, no DB migrations, no runtime state.

## Open Questions

- Should SETUP/CONFIG/AUTH eventually get their own eval harnesses (prompts that verify the parent does the interview correctly, generates a valid `config.ts`, and derives `AuthModule` correctly from a given `template.json`)? Out of scope for this change; tracked as follow-up.
- Does the parent need to handle the "user has an existing Angular workspace that already has `FormioAppConfig` wired" case without running CONFIG/AUTH from scratch? Probably yes — the sub-skill already handles existing-workspace integration for resources. Parent should detect `FormioAppConfig` in the current `app-module.ts` and skip the CONFIG gate if found. Flag for implementation review.
- Does the parent's AUTH phase need to support SSO/OIDC/SAML flows from the start, or is built-in user-resource auth enough for v1? The planner's `template.json` can encode SSO settings (via the platform-level identity-provider flow). Recommendation: v1 generates the `FormioAuthConfig` branch and leaves a TODO block for SSO integration, pointing at `formio-api/references/platform-auth`. Revisit if the first real use case needs SSO day one.
