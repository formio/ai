# Compress skill descriptions and fix trigger collisions

## Why

A library-wide audit found the skill descriptions have grown past what the routing layer can actually use. Skill descriptions are truncated in the agent's skill listing at roughly 1,500 characters (observed live in this repo; platform guidance recommends ≤1,024) — and the library's three-clause template puts the `Not for:` routing clauses last, so on six of ten skills the negative triggers are exactly what gets cut. `formio-angular` (3,796 chars) loses all six of its `Not for:` clauses; `formio-sdk` (2,256) loses its entire negative-trigger clause. Separately, four genuine trigger collisions exist: `formio-resource-planner` claims build-me-an-app intents that belong to `formio-application` (and has no reverse pointer), `formio-form` claims the build-verb phrase "build a conditional wizard", `formio-schema` claims bare nouns ("wizards", "resources") even outside JSON contexts, and `formio-actions`/`formio-auth` both claim login/role-assignment phrasing with no mutual pointers.

## What Changes

- **Library-wide description budget** — every top-level `plugin/skills/*/SKILL.md` frontmatter `description` SHALL fit in **1,024 characters** (whitespace-normalized), structured as: one capability sentence, one trigger sentence with quoted example phrases, an optional boundary rule, and a compact `Not for:` clause. Flow narrations, step lists, command lines, and API-method inventories move out of descriptions (the SKILL.md bodies already carry them). Enforced by a new structural test suite scanning the whole library.
- **Rewrite the six oversized descriptions** — `formio-angular` (3,796 → ≤1,024), `formio-sdk` (2,256), `formio-resource-planner` (1,677), `formio-schema` (1,582), `formio-auth` (1,566), `formio-application` (1,525) — and trim `formio-form` (1,369), `formio-form-builder` (1,173), and `formio-api` (1,114) under budget. `formio-actions` (786) already fits. Every substring the existing structural tests and validators assert (trigger phrases, backticked sibling names, boundary rules, `.mcp.json`/restart mentions) is retained.
- **Fix the four trigger collisions:**
  1. `formio-resource-planner` claims only planning verbs (design, architect, model, plan) — drops "build a <kind> app in Form.io"-style triggers and the "trigger even if they describe an app" rule, and gains a `Not for:` pointer at `formio-application` for build-me-an-app intents.
  2. `formio-form` pairs no build/create verbs with new-form phrases — "build a conditional wizard" becomes embed-verb phrasing ("make an embedded wizard conditional"); the skill stays embed-only.
  3. `formio-schema` scopes its bare-noun triggers (components, wizards, resources, submissions) to Form.io JSON/schema contexts and stops claiming standalone build/plan intents.
  4. `formio-actions` and `formio-auth` gain mutual `Not for:` pointers — actions owns per-form action JSON mechanics; auth owns SSO/JWT/session/RBAC architecture.
- **`formio-application-skill` spec relaxed** — its description requirement currently mandates enough content (two trigger lists, a framework-pick explanation, six `Not for:` bullets, `.mcp.json` + restart mentions) that the budget is unreachable; the framework-pick explanation and the exhaustive trigger enumeration move to body-level concerns while the routing-critical mandates stay.

## Capabilities

### New Capabilities

- `skill-description-budget`: the library-wide description contract — the 1,024-character budget, the compact clause structure, the no-body-content rule (no step lists, commands, or API inventories in descriptions), and the structural test suite that enforces it across every top-level skill.
- `formio-actions-skill`: new (narrow) spec for the existing `formio-actions` skill's routing surface — its trigger claims stay per-form action mechanics and its description gains a `Not for:` pointer at `formio-auth` for auth-architecture concerns (SSO, JWT/session mechanics, RBAC tuning).

### Modified Capabilities

- `formio-application-skill`: description requirement relaxed to fit the budget — keeps the plain-language trigger claims (with fewer mandated examples), the six `Not for:` pointers, and the `.mcp.json`/restart mentions; drops the mandated framework-pick explanation from the description.
- `formio-resource-planner-skill`: adds the planning-verbs-only requirement — no build-an-app trigger claims, `Not for:` pointer at `formio-application`.
- `formio-schema-skill`: adds the scoping requirement — bare-noun triggers only in JSON/schema contexts, no standalone build/plan claims.
- `formio-form-skill`: adds the embed-verbs-only requirement — the trigger clause pairs no build/create verbs with new-form phrases.
- `formio-auth-skill`: the three-clause description requirement additionally names `formio-actions` in the `Not for:` clause.

## Impact

- Modified: all ten `plugin/skills/*/SKILL.md` frontmatter descriptions (nine rewritten/trimmed, `formio-actions` gains a `Not for:` clause). SKILL.md bodies unchanged — everything cut from descriptions already exists in bodies.
- New: `packages/skill-tests/src/skill-descriptions/` structural test suite (budget scan + collision guards).
- Existing tests unweakened: `formio-form-builder`/`formio-form` structural suites, the `formio-sdk` validators (`validateFormioSdkSkill`), and the `formio-api` router validators (`validateRouterDescriptionTriggers`) keep passing — every asserted substring survives the rewrites.
- Context cost drops from ~16.8k description characters (~4k tokens, always in context) to ~9k.
- Out of scope: the dev-environment duplicate-registration issue (symlinks + installed plugin), trigger-eval measurement via `skill-creator`'s `run_loop.py` (recommended follow-up), and any SKILL.md body changes.
