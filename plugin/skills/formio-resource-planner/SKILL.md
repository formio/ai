---
name: formio-resource-planner
description: >-
  Plan the Resource structure, field configurations, and access/permission model for a Form.io application, then emit a ready-to-import project `template.json` (Phase A: a human-readable Resource Map for approval; Phase B: the full template with roles, resources, forms, and actions). Interview-driven — infers resources and asks about relationships, auth, and access before committing. Use when the user asks to design, architect, model, or plan the resources, schema, data model, or access model — "design the resources for...", "plan the schema for...", "model <domain> in Form.io". Not for: building or standing up the app itself — "build me a task manager / CRM" (see `formio-application`, which invokes this planner internally as its planning step); standalone single-form creation — one survey, contact form, or questionnaire with no data model (see `formio-form-builder`); SSO, Token Swap, Custom JWT, 2FA, or RBAC tuning beyond default roles (see `formio-auth`); endpoint lookups (see `formio-api`).
---

# Form.io Resource Planner

Turn a natural-language application description into a concrete Form.io resource map — the minimum plan needed to actually build the app.

## Stance

You are a thinking partner that plans before it builds. Two distinct phases with a hard approval gate between them.

- **Curious, not prescriptive.** The user's domain words are signal; the Form.io vocabulary is yours to translate.
- **Batch your questions.** When multiple related questions come up (e.g., all relationship cardinalities), ask them together in one `AskUserQuestion` call. Peppering the user one question at a time burns trust.
- **Visualize twice, in two formats.** The map is visualised by two diagrams: an ER diagram (who relates to whom) AND an Access Flow diagram (how the runtime ACL reaches each resource). Phase A (chat approval gate) renders both as ASCII so the user can review them in the terminal. Phase B (file on disk) renders both as Mermaid (`erDiagram` + `flowchart TD`) so downstream skills and GitHub/IDE readers get semantic edges + native rendering. Both surfaces describe the same topology — generated from one internal model per run.
- **Ground in Form.io primitives.** Every output claim must map to a real Form.io construct: resource, form, component, action, role, field-based access, group permission.
- **Pick the right kind per entity.** Classify every entity as a **Resource** (a stored, reusable data model) or a **Form** (bespoke, purpose-specific data collection) BEFORE modeling its fields. Most entities are Resources, and an app that is all Resources is perfectly valid — just make the call deliberately rather than reflexively, and reach for a Form only when the entity is genuinely bespoke collection. See ["Resources vs. Forms"](#resources-vs-forms--the-core-modeling-decision) below.
- **Gate on approval.** Phase A (Resource Map) is for review. Do not emit `template.json` / `template.md` until the user has explicitly approved the map. See "The approval gate" below.
- **Phase B is a pair.** Every Phase B emission writes `template.md` AND `template.json` together — same basename, same timestamp on collision. `template.md` is the architectural-intent artifact downstream skills seed from; `template.json` is its structured companion. Never emit one without the other.
- **Actions follow intent — add them per use-case, never blindly.** A resource or form gets exactly the actions its purpose requires: a Save on anything meant to persist to the submission API, Login on a login form, Role Assignment on a register form, Email/Webhook on a notification form, Group Assignment on a join resource. **A form or resource with NO actions is valid** — it renders and collects data client-side but never sends anything to the submission API (e.g. an embedded Search form whose data the app reads in the browser to build a query for a separate API). The common mistake is the opposite: forgetting Save on something that WAS meant to store records — so whenever a resource or form is meant to persist submissions, it MUST have a `<name>:save`, and a missing one there is a bug. When in doubt about whether a given form persists, decide deliberately (and ask the user if unclear) rather than defaulting either way. See [`references/phase-b-emission.md`](references/phase-b-emission.md) → "Actions emission — per use-case", and [`references/template-json.md`](references/template-json.md) for exact shapes.
- **Don't call the MCP server.** The skill produces plans plus the `template.md` / `template.json` artifact pair. It does not call `form_create` or any other MCP tool — importing is a separate, explicit user action.

## Resources vs. Forms — the core modeling decision

Form.io has two kinds of entries — **Resources** (stored, reusable data models; the nouns of the app, each auto-generating a REST API) and **Forms** (bespoke, purpose-specific data collection — a job application, a survey, an RSVP). Classify every entity BEFORE modeling its fields with the litmus test: a record the app stores and reuses → Resource; a response to a specific ask, possibly wrapping a record → Form. A bespoke Form *references* an already-established Resource (disabled pre-selected Select, or the submission `owner`) — never create the Resource from inside the Form. The full decision guide — definitions, the Job Application worked example, the quick classification table, and the anti-pattern — is in [`references/planning-rules.md`](references/planning-rules.md) → "Resources vs. Forms"; read it before classifying, and when in doubt, ask the user rather than silently defaulting to Resource.

## The interview

Work through six rounds — compress or expand as the user's description warrants (skip ahead if they named every entity and relationship; start from zero for a bare "I want a CRM"). The full round-by-round scripts, question batching, and the "Interview heuristics" for ambiguous cases are in [`references/interview-guide.md`](references/interview-guide.md).

1. **Extract the named entities** — list the resource-sounding nouns in the prompt and confirm the list with the user in one question.
2. **Classify each entity — Resource or Form** — apply the litmus test per entity; batch with round 1's confirmation and call out any bespoke-Form-over-Resource splits.
3. **Determine the relationships** — pin down 1:1 / 1:N / N:N for every meaningful pair, asked as a batch.
4. **Determine the user / auth model** — default vs custom user resource, self-register vs admin-invite, SSO vs email/password; a no-auth app skips access rules.
5. **Determine the access / permission model** — owner-, group-, role-, or tenant-level, or a combination.
6. **Produce the resource map, then gate on approval** — emit the Phase A Resource Map, stop, and ask the user to approve or revise.

## Form.io primitives you will use

Two planning references cover the primitives; open them while building the map:

- [`references/planning-rules.md`](references/planning-rules.md) — the relationship → construct mapping (foreign-key `select`s, N:N join resources, user-to-resource group joins), the component cheat sheet, and the action cheat sheet.
- [`references/access-patterns.md`](references/access-patterns.md) — the owner/group/role/tenant pattern table; the two-halves rule for group-based access (a Group Assignment action on the join AND a four-entry field-based `submissionAccess` block on every child's group-reference select — missing half 2 is a silent bug: the user sees the Project but not its Tasks); the transitive hidden-calculated-mirror pattern for resources 2+ levels below the group; and the `access` vs `submissionAccess` distinction (users describing access almost always mean `submissionAccess`). Read it whenever the plan has any owner-, group-, or role-based access.

## Phase A — Resource Map for review

When the interview has enough signal, emit the Resource Map as a single fenced markdown block for the user to review in the terminal — the same sections Phase B writes to `template.md`, with ONE substantive difference: Phase A uses ASCII diagrams for `## ER Diagram` and `## Access Flow Diagram`, while Phase B's file uses Mermaid (same topology, generated from one internal model per run). Keep the map terse — one sentence per resource purpose, one clause per field. Follow the exact Phase A template in [`references/interview-guide.md`](references/interview-guide.md) → "Phase A — Resource Map for review"; the full shape rules and Access Matrix token vocabulary are in [`references/template-md.md`](references/template-md.md).

## The approval gate

After emitting the Resource Map, stop. Ask the user one question with `AskUserQuestion`:

> "Does this map look right? I can write `template.md` + `template.json` once you approve it, or revise the map based on your feedback."

Offer two options: **Approve & write template.md + template.json** and **Revise the map** (with free-text "Other" always available for specific tweaks).

**Do not skip this gate**. Even if the user's original prompt sounds decisive ("build me a task manager and give me the JSON"), always produce the map first, then ask. The gate exists because the JSON is 200–600 lines and a single wrong field propagates everywhere — cheaper to catch mistakes in the ~50-line map than the 500-line export.

If the user says "revise" or flags specific issues: update the map, re-show it, re-ask. Iterate until they approve.

## Phase B — template.md + template.json after approval

Only when the user has approved the map, emit the artifact PAIR — always both, always together:

1. **`template.md`** — the approved Resource Map, saved to disk as the architectural-intent document. Same structure as the Phase A map (Resources, optional Forms, Users & Auth, Roles, Access Matrix, ER Diagram, Access Flow Diagram, Companion artifact). See [`references/template-md.md`](references/template-md.md) for the complete spec.
2. **`template.json`** — the Form.io project-export JSON. Same shape you get from `GET /{projectName}/export` and can POST to `/{projectName}/import`.

Each file is emitted in TWO forms at the same time:

- **As a fenced block in the chat transcript** (`markdown` for `template.md`, `json` for `template.json`) — so the user sees both ASCII diagrams and the structure inline.
- **As files on disk using the `Write` tool** — so downstream skills (like `formio-application`'s Import step, or `formio-angular/resources`) can pass real file paths.

### File-write rules

- **Default filenames:** `./template.md` and `./template.json` in the user's current working directory (cwd — the directory the user was in when they invoked the flow). Use the `Write` tool; local filesystem writes do NOT count as "calling the MCP server", so the skill's "does not call the MCP server" stance is preserved.
- **Paired collision handling:** if EITHER file already exists in cwd, append the SAME sortable UTC timestamp (e.g. `20260420T153000Z`) to BOTH filenames so the pair stays matched — even if only one of the two collided — and report both chosen filenames in the Phase B confirmation message. Exact rule and format: [`references/template-md.md`](references/template-md.md) → "File pairing rules".
- **Both standalone and orchestrated runs:** write both files in every Phase B emission — whether the planner is running standalone or invoked from `formio-application` (which will then pass the paths to its Import step and the framework handoff). Do not make this conditional.
- **Never emit one without the other.** If for any reason you can only emit one, stop and explain the problem — the pair is the contract downstream skills rely on.

### Transcript requirements

The markdown block MUST follow the section order in [`references/template-md.md`](references/template-md.md) exactly (`# Resource Map — <App Name>` → `## Resources` → optional `## Forms` → `## Users & Auth` → `## Roles` → `## Access Matrix` → `## ER Diagram` → `## Access Flow Diagram` → `## Companion artifact` — downstream graders key on these headings), with Mermaid — not ASCII — diagram blocks. The JSON block MUST be a valid, importable template with the eight top-level keys in exactly this order: `title`, `version`, `name`, `roles`, `forms`, `actions`, `resources`, `access`; read [`references/template-json.md`](references/template-json.md) before writing — do not improvise structure. Full requirements (Mermaid node coverage, empty-object rules, the optional `description` key, the non-empty project-level `access` array): [`references/phase-b-emission.md`](references/phase-b-emission.md) → "Transcript requirements".

### Actions emission — per use-case

Right before writing `template.json`, run the emission algorithm in [`references/phase-b-emission.md`](references/phase-b-emission.md) → "Actions emission — per use-case" exactly once. In brief: every persisting resource and form gets `<name>:save` (a missing Save silently drops submissions; a deliberately client-only entry with no actions is valid); login forms get `<name>:login` (a login-form `save` must NEVER set `settings.resource`); register forms get Save → Role Assignment → Login; every access-governing join gets `<join>:group` alongside its Save; Email/Webhook only when explicitly requested. The reference holds the full five-step algorithm, the Login `settings.resources` rules, the admin-work-goes-through-the-portal rule, the Email action rules, the minimum-viable-action-set table, priority ordering, and the pre-emit self-check.

### Order in the transcript

Render the markdown block first, then the JSON block, then the one-line confirmation (`Wrote ./template.md and ./template.json.`, using the collision-aware filenames), then the "Next steps" section. The exact confirmation line and Next-steps block to reproduce are in [`references/phase-b-emission.md`](references/phase-b-emission.md) → "Order in the transcript".

## Handoffs

- **`formio-auth`** — when the approved map's `Users & Auth` section has an `SSO` other than `none`, a `Custom JWT: yes`, or any auth concern beyond resource-backed login + Role Assignment + Group Assignment (Token Swap, email-token/passwordless auth, 2FA, reCAPTCHA, RBAC tuning beyond default roles and group permissions), hand off to the `formio-auth` skill immediately after the Resource Map is approved.
- **`formio-application`** — when invoked as the orchestrator's planning step, run the same two phases and gates; the Phase B file paths are what the orchestrator passes to its Import step and the framework-specific scaffolding skill.

## Worked example

A complete Task Manager run — the abbreviated interview, the full Phase A ASCII Resource Map, and the Phase B handoff — is in [`references/interview-guide.md`](references/interview-guide.md) → "Worked example". Canonical paired examples are checked in under `references/examples/`: [`task-manager/`](references/examples/task-manager/) (simple group, direct-child access) and [`complex-crm-transitive/`](references/examples/complex-crm-transitive/) (group with hidden calculated mirrors on grandchildren). Use these as structural references when deciding how to shape a new app's output.

## When to look up more

- Form.io Resources overview: https://help.form.io/userguide/resources
- Roles and permissions: https://help.form.io/developers/roles-and-permissions
- Application development guide: https://help.form.io/dev/application-development
- Login action: https://help.form.io/userguide/forms/form-building/actions#login
- Role Assignment action: https://help.form.io/userguide/forms/form-building/actions#role-assignment
- Group Permissions action: https://help.form.io/userguide/forms/form-building/actions#group-assignment

Consult these when the user's requirements touch an edge case this skill doesn't cover (e.g., conditional access, multi-level tenancy, federated SSO).

## What this skill does NOT do

- **Does not call the MCP server, skip the approval gate, or emit one artifact without the other** — see "Stance", "The approval gate", and "File-write rules" above; importing the template is a separate, explicit user action.
- **Does not look up endpoints.** The `formio-api` skill handles endpoint reference.
- **Does not deep-dive a single form's component schema.** For exhaustive component options (conditional logic, calculated values, custom validation), see `formio-schema`. This skill's template.json uses the minimum viable component shape for each field.
- **Does not make the plan "complete" beyond what the user described.** If they didn't mention reporting, don't add a report resource.

## Reference files

All one hop from here — open the one matching the phase you are in:

- [`references/planning-rules.md`](references/planning-rules.md) — Resources vs. Forms decision guide; relationship → construct; component and action cheat sheets.
- [`references/access-patterns.md`](references/access-patterns.md) — owner/group/role/tenant patterns; the group-access two-halves rule; transitive mirrors; `access` vs `submissionAccess`.
- [`references/interview-guide.md`](references/interview-guide.md) — full interview scripts; the exact Phase A map template; the Task Manager worked example; interview heuristics.
- [`references/phase-b-emission.md`](references/phase-b-emission.md) — Phase B transcript requirements; the actions-emission algorithm; output order and the Next-steps block.
- [`references/template-md.md`](references/template-md.md) — full `template.md` spec: section shapes, Mermaid diagram conventions, Access Matrix tokens, file pairing, chat-output rules.
- [`references/template-json.md`](references/template-json.md) — full `template.json` schema: component shapes, action shapes, access arrays, assembly checklist.
