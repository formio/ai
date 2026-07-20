# Design: compress skill descriptions

## Context

Skill descriptions are the routing layer: they sit in the agent's context permanently (SKILL.md bodies load only on activation), and the agent picks skills by matching the user's prompt against them. Two measured problems:

1. **Truncation.** The skill listing truncates long descriptions — observed at ~1,535 characters in this repo's own sessions (`formio-angular`'s listing cuts off mid-BOOTSTRAP with `…`). Platform guidance recommends ≤1,024 characters. The library's three-clause template ends with `Not for:`, so truncation removes the negative triggers first — the exact content that prevents mis-routing.
2. **Collisions.** Four trigger overlaps where two skills claim the same phrasing (planner↔application on "build an app", form↔form-builder on "build a … wizard", schema's bare nouns vs the orchestrators, actions↔auth on login/role phrasing).

Current sizes: angular 3,796 ch / sdk 2,256 / planner 1,677 / schema 1,582 / auth 1,566 / application 1,525 / form 1,369 / form-builder 1,173 / api 1,114 / actions 786. `formio-actions` proves the compact form works — full trigger coverage in 786 chars.

Hard constraints on any rewrite — substrings that existing tests and validators assert:

- `formio-form-builder` suite: `Use when the user asks to`, trigger phrases ("build a form", "create a form", "multi-page form", "survey", "contact form", "intake form", "registration form", "questionnaire", "pdf form"), boundary substring `build a form to collect`, `/data model/i`, `webform`/`wizard`/`PDF`, backticked `` `formio-form` `` `` `formio-application` `` `` `formio-resource-planner` `` `` `formio-schema` `` `` `formio-api` `` in `Not for:`.
- `formio-form` suite + sibling assertions: its trigger examples, its `Not for:` names (six incl. `` `formio-form-builder` ``); `formio-application`/`formio-resource-planner`/`formio-form` descriptions name `` `formio-form-builder` ``; `formio-sdk`/`formio-application`/`formio-angular` name `formio-form`.
- `formio-sdk`: `validateFormioSdkSkill` checks the three clauses and sibling names (`formio-api`, `formio-application`, `formio-resource-planner`, `formio-angular`, `formio-form`).
- `formio-api`: `validateRouterDescriptionTriggers` checks `use when` + `not for:` naming `formio-application`, `formio-resource-planner`.
- `formio-application` spec scenarios: `.mcp.json` substring, restart mention, six `Not for:` pointers.

## Goals / Non-Goals

**Goals:**

- Every top-level skill description ≤1,024 characters (whitespace-normalized) — safely under the observed truncation point, matching platform guidance, and cutting always-in-context cost ~45%.
- `Not for:` clauses guaranteed visible (a consequence of the budget, not a reordering).
- The four collisions resolved at the description level, codified in the owning capability specs.
- All existing structural tests and validators keep passing unmodified.

**Non-Goals:**

- No SKILL.md body changes — every cut is content the body already carries.
- No reference-doc or flow changes.
- No fix for the dev-environment duplicate registration (symlinked + installed plugin copies) — environment concern, not library content.
- No trigger-eval measurement (`skill-creator` `run_loop.py`) in this change — recommended follow-up once descriptions are stable.
- The nested `formio-angular/resources/SKILL.md` sub-skill is exempt from the budget scan — it is loaded by file path, not registered in the skill list.

## Decisions

### D1: 1,024-character budget, whitespace-normalized, enforced by test

Budget = 1,024 characters after collapsing whitespace runs (YAML `>-` folding makes raw char counts layout-dependent). Rationale: platform guidance, ~33% margin under the observed ~1,535 cut, and large enough for every constrained skill — the tightest (`formio-application`, which must keep example triggers, six pointers, and the `.mcp.json`/restart mentions) fits at roughly 950–1,000 chars once the framework-pick explanation is dropped.

Enforced by `packages/skill-tests/src/skill-descriptions/description-budget.test.ts`: scan every `plugin/skills/*/SKILL.md` (direct children only), parse frontmatter, assert normalized description length ≤1,024 and `Not for:` present. A new skill added over budget fails CI immediately — this is what keeps the problem from regrowing.

### D2: Compact clause structure — same template, tighter contract

The three-clause template stays; what changes is what's allowed inside it:

1. **Capability sentence(s)** — what the skill does, one to two sentences. No phase/step narration, no shell commands, no URLs, no exhaustive API-method inventories (categories + a few representative names instead).
2. **Trigger sentence** — `Use when …` with quoted example phrases. 5–10 phrases, chosen for coverage, not exhaustiveness.
3. **Boundary rule** — only where a skill has one (form-builder's form-vs-resource rule).
4. **`Not for:`** — sibling names backticked, each with a ≤5-word reason.

The "no body content" rule is the load-bearing one: `formio-angular`'s description shrinks ~75% purely by deleting the five-phase runbook (its spec never required the narration — it leaked in during authoring).

### D3: Collision fixes live in the owning capability specs

- **planner ↔ application** (the sharpest): `formio-resource-planner`'s description claims only planning verbs — design, architect, model, plan the resources/schema/data model — and explicitly does NOT claim "build me a/an X" phrasing or "they described an app, so plan it" auto-claims. Gains `Not for:` → `` `formio-application` `` (building/running the app; it invokes this planner internally). This matches the real architecture: the orchestrator owns the build intent and calls the planner as Step 2; direct planner activation is for plan-only requests.
- **form's wizard phrase**: replace "build a conditional wizard" with embed-verb phrasing ("make an embedded wizard conditional / conditional wizard pages"). The spec-mandated substring is `conditional wizard`, which survives; the requirement added to `formio-form-skill` says build/create verbs never pair with new-form nouns in its trigger clause.
- **schema's bare nouns**: keep the noun list (spec-mandated: components, wizard, textfield, datagrid) but scope the trigger sentence to constructing/editing/interpreting Form.io **JSON** — drop "even when the user does not explicitly say Form.io" as a blanket claim; keep it only for contexts already inside Form.io JSON work.
- **actions ↔ auth mutual pointers**: `formio-actions` `Not for:` → `` `formio-auth` `` (SSO, JWT/session mechanics, RBAC architecture); `formio-auth` `Not for:` additionally names `` `formio-actions` `` (per-form action JSON mechanics — settings, priorities, conditions, handlers). The intent boundary: auth = the architecture, actions = the per-form JSON.

### D4: formio-application-skill is the only spec that must relax

Its description requirement mandates more prose than 1,024 chars can hold. Keep (routing-critical): plain-language build/extend trigger claims with a few examples, default-entry-point statement, all six `Not for:` pointers, `.mcp.json` mention, restart mention. Drop from the description mandate (body concerns): the framework-auto-pick/ask explanation and the requirement to enumerate both full example-trigger lists ("MUST claim include" lists shrink to representative examples). Scenarios keep asserting the substrings that matter (`.mcp.json`, restart phrasing, all six backticked pointer names).

All other existing description requirements are already satisfiable under budget — angular, sdk, api, form, form-builder, auth, schema specs need no relaxation, only the collision additions listed in the proposal.

### D5: Rewrite mechanics — substring checklist first, prose second

Implementation order per skill: extract the full list of test/validator-asserted substrings (from the Context list above), draft the compressed description containing all of them, verify length, then run the full suite. The new budget test plus every existing suite passing is the definition of "didn't break routing contracts." The rewrites land in one Green pass so sibling cross-assertions (A names B) never see a half-updated pair.

### D6: Collision guards in the new test suite

`packages/skill-tests/src/skill-descriptions/` gets a second file, `collision-guards.test.ts`, asserting the four fixes stay fixed:

- planner description contains no `build me`/`build a <archetype>` claim pattern and names `` `formio-application` `` in `Not for:`;
- form description's trigger clause contains no `build a`/`create a` immediately preceding form/wizard/survey nouns;
- schema description does not contain the blanket "even when the user does not explicitly say Form.io" claim outside a JSON-context qualifier;
- actions and auth descriptions each name the other in `Not for:` (backtick-delimited).

These are regression locks, not style checks — each maps to a spec scenario.

## Risks / Trade-offs

- [Shorter descriptions under-trigger — fewer keyword matches] → Keep the highest-signal quoted phrases (they, not the prose, drive matching); `formio-actions` demonstrates full trigger coverage at 786 chars. Follow-up trigger-eval run (`skill-creator` `run_loop.py`) on the riskiest pairs validates empirically.
- [A mandated substring gets lost in compression and a suite fails] → D5's checklist-first workflow plus running the full suite in the same group; the substrings are enumerated in Context so the rewrite is mechanical.
- [Planner stops activating for "I want to build a task manager in Form.io" and the user actually wanted just a plan] → `formio-application`'s INTENT step already asks build-vs-plan-shaped questions, and its description keeps a `Not for:` at the planner for plan-only requests — the intent still routes, one hop later, with an interview to disambiguate.
- [1,024 budget is wrong for some future skill] → It's a spec requirement, not physics; a future change can raise it deliberately. The test failing is the forcing function for that conversation.
- [Whitespace normalization differs between test and platform counting] → Normalized counting is the stricter, layout-independent measure; 33% margin to the observed cut absorbs the difference.

## Open Questions

None — budget number, clause contract, collision resolutions, and test placement are settled above.
