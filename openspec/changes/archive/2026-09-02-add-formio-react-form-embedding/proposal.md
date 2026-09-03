## Why

`add-formio-react-skill` reserved a branch for React form embedding and routed such requests to `formio-form` in the meantime, with an honest note that its guidance covers the Vanilla JS renderer. This change fills that branch.

The gap is real rather than cosmetic. `formio-form` is a Vanilla JS task guide — everything routes through `Formio.createForm(element, srcOrJson, options)` — and no reference in it mentions React, Angular, or frameworks at all. Following it inside a React application means hand-rolling a `useEffect` and a ref around an imperative renderer, reimplementing the instance lifecycle that `@formio/react`'s `Form` component already owns, and inheriting none of its event surface.

That lifecycle is also where the real bugs are, and it is not guessable. The monorepo's own gotchas registry documents that an inline `options={{}}` prop destroys and recreates the entire form instance on every parent render (`G-RC03`), that `submission` is deliberately excluded from the create-effect's dependencies and applied to the live instance behind an equality guard instead (FIO-10902), that async instance creation races unmount (`G-RC01`), and that module-level default props are shared references the builder mutates in place (`G-RC05`). Two environment traps sit alongside: Vite needs `@vitejs/plugin-react` configured, and Next.js needs the component dynamically imported with `ssr: false` because `@formio/js` reaches for `window` — even inside a client component. None of this is discoverable from the Vanilla JS guidance.

## What Changes

- **New nested sub-skill `formio-react-form`** at `plugin/skills/formio-react/formio-react-form/`, claiming the reserved embed row in `formio-react`'s dispatch table. Authored from `@formio/react` source and the monorepo's `docs/gotchas/react.md` and `docs/architecture/react.md`, in the same source-derived spirit as `formio-sdk`.
- **A hard scope boundary: mounting and wiring only.** The sub-skill covers getting a form onto a React page and controlling it — `Form`, `FormioProvider`, the event surface, the instance escape hatch, the lifecycle traps, and the Vite and Next.js requirements. Everything that lives in the **form definition** — conditionals, `calculateValue`, `validate.json`, `logic`, external data and cascading selects, wizard page logic, JSON Logic — stays owned by `formio-form` and is reached by link. That content is identical in every framework, and duplicating it is how two copies drift.
- **`formio-react`'s embed row goes live.** The reserved row becomes a real branch pointing at the new sub-skill, and the parent description gains React embed triggers, which the previous change explicitly forbade while the row was reserved.
- **`formio-form` gains a host check, not a router.** Before writing mounting code, it notices when the workspace is a React application and hands off. This is deliberately NOT a framework dispatch table: an explicit "embed this form in React" already routes to `formio-react` by description matching, so the only gap worth closing is the request that names no framework from inside a framework workspace. One step, not a restructure.
- **Description disambiguation in both directions.** `formio-form` keeps the framework-agnostic embed triggers and adds `formio-react` to its `Not for:` clause; `formio-react-form` claims only React-named embed phrasing. The library's `collision-guards` suite gains cases for the new boundary.
- **Anonymous embedding is first-class.** A public contact or intake form — no login, no token — is the most common embed, and it is not what the provider's auth state describes. Both paths are documented, and a 401 on a public submit is attributed to the form's submission access rather than to a missing login.
- **Styling is covered, because the renderer ships no stylesheet.** `@formio/js` emits Bootstrap-classed markup and supplies no CSS, so an app that installs the packages and renders a form gets a visually broken form. A `styling.md` reference covers the stylesheet requirement, `Templates` and template frameworks as the supported way to change emitted markup, per-instance versus global styling, and scoping against an app's own design system.
- **The `ReactComponent` deprecation gets a destination.** Marking it deprecated without documenting the replacement leaves a reader stranded, so the sub-skill documents the concrete path: extend a `@formio/js` component class, register it with `Formio.Components.addComponent` through the `Components` re-export, at module scope before any form renders.
- **Form-management components are explicitly out of scope.** `FormBuilder`, `FormEdit`, `FormGrid`, `SubmissionTable`, and `Report` are named in one line so a reader knows what they are, with a plain statement that this library documents no form-management guidance — and an instruction not to improvise it when asked. `SubmissionTable` is the one routing exception, since a reader listing a resource's records wants `formio-react-resources`.
- **The Angular embed gap is named, not closed.** `formio-angular` disclaims embedding today and points at `formio-form`, so an Angular user asking to embed gets Vanilla JS guidance rather than `<formio>` / `FormioComponent`. This change records that as a reserved row in the same shape, so closing it later is one sub-skill and one row.

Not breaking. `formio-form` keeps every trigger it claims today; the host check adds a handoff it did not have.

## Capabilities

### New Capabilities

- `formio-react-form-skill`: the `formio-react-form` nested sub-skill — its layout and trigger surface, the mounting-versus-behavior scope boundary, the `Form` component contract (source precedence, pre-fill, event surface, instance escape hatch), `FormioProvider` and URL sourcing, the four lifecycle traps, the Vite and Next.js requirements, the anonymous and authenticated embedding paths, styling and the renderer stylesheet, the deprecated surfaces it must not recommend along with the concrete replacement path, and the form-management components it names as out of scope.

### Modified Capabilities

- `formio-react-skill`: the reserved embed row becomes a live branch naming `formio-react-form`; the parent description gains React embed triggers it was previously forbidden from claiming; the Angular embed gap is recorded as reserved.
- `formio-form-skill`: a host check hands React workspaces off before mounting code is written; the `Not for:` clause names `formio-react`; the skill is confirmed as the single owner of definition-level behavior that framework embed skills link to rather than restate.

## Impact

- **New files:** `plugin/skills/formio-react/formio-react-form/SKILL.md` plus its `references/` — `mounting.md`, `control.md`, `lifecycle.md`, `environments.md`, `provider.md`, `styling.md`.
- **Edited files:** `plugin/skills/formio-react/SKILL.md` (dispatch row, description), `plugin/skills/formio-form/SKILL.md` (host check, `Not for:` clause), `CLAUDE.md` and the README/manifest skill listings.
- **Tests:** the hard-coded skill counts in `packages/skill-tests/src/` step again on top of change 1 (`gatedSkillMd()` 13 → 14, `allSkillMd()` 14 → 15, `probingSkillMd()` 12 → 13). The library-wide conformance, description-budget, URL-terminology, and cross-reference suites otherwise pick up the new `SKILL.md` automatically; `collision-guards.test.ts` gains cases for the `formio-form` ↔ `formio-react-form` boundary; the shared-prose suite covers the security section the new skill carries.
- **Depends on:** `add-formio-react-skill`, which creates `plugin/skills/formio-react/` and the dispatch table this change edits. Apply that change first.
- **No eval harness.** This is reference documentation rather than a code generator; there is no generated artifact to grade. `shipped-surface-boundary`'s harness list is unchanged.
- **Explicitly unchanged:** `@formio/react` itself, and every definition-level reference under `plugin/skills/formio-form/references/`.
