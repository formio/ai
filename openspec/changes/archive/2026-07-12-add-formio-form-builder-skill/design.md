# Design: `formio-form-builder` skill

## Context

The library has two orchestrators today: `formio-application` (build a whole app) and, beneath it, `formio-resource-planner` (plan the data model). Single-form creation has no owner. The building blocks all exist — `formio-schema` authors form JSON, the MCP server's `form_create` persists it (and already instructs use of `formio-schema`), `formio-form` embeds a saved form — but no skill chains them into a pipeline, and no skill knows how to choose between the three Form.io form types (webform, wizard, PDF form).

Source material for the form-type reference (authoring inputs, not runtime dependencies):

- https://help.form.io/form-building/form-types — webform vs wizard vs PDF form
- https://help.form.io/form-building/pdf-forms — PDF form capabilities and when to use them
- https://help.form.io/how/nested-form-workflows/nested-wizard-workflow#create-child-wizard — child wizards / complex multi-page flows

Repo state that constrains this change:

- The `add-formio-form-skill` change is implemented but not archived, so the `formio-form-skill` capability spec lives in that change's `specs/` directory, not yet in `openspec/specs/`. This change's `formio-form-skill` delta layers on top of the pending version.
- `formio-resource-planner` has no capability spec at all; this change introduces a narrow one covering only the routing boundary being added.
- `plugin-build.test.ts` assertion 1.3 enumerates bundled skills; `add-formio-form-skill` hit a stale exclusion there. This change updates the assertion in the same change that adds the skill.
- The `formio-schema-skill` spec forbids the string `formio-form` in `formio-schema`'s description — and `formio-form-builder` contains that substring — so `formio-schema` gets NO reverse pointer; the reference is one-way.

## Goals / Non-Goals

**Goals:**

- One orchestrator skill, `plugin/skills/formio-form-builder/`, owning "build me a form" end to end: INTENT → SCHEMA → SAVE → EMBED (conditional).
- A crisp form-vs-resource routing boundary, stated in the description and enforced by reverse pointers on `formio-application`, `formio-resource-planner`, and `formio-form`.
- Zero duplication: form JSON shapes stay in `formio-schema`; embed guidance stays in `formio-form`; this skill references both by name.
- Skill ships in the `@formio/ai` plugin bundle with the packaging spec and build-test assertions updated in the same change.
- Structural tests guarantee the authoring contract (same pattern as `packages/skill-tests/src/formio-form/skill-structure.test.ts`).

**Non-Goals:**

- No MCP server changes — `form_create`, `form_get`, and `authenticate` already exist.
- No renderer behavior tests — the flow is prose/orchestration; there is no runtime surface to drive.
- No changes to `formio-schema` content or description.
- No eval harness (`evals/`) for this skill — can follow later per repo convention.
- No PDF-upload tooling — the form-types reference documents what PDF forms are and when to choose them; server-side PDF conversion/upload is out of scope.

## Decisions

### D1: Orchestrator tier, `formio-application` shape — root-level step docs, not `references/`

`formio-form-builder` mirrors `formio-application`'s layout: `SKILL.md` router plus root-level uppercase step docs (the INTENT.md/IMPORT.md pattern), NOT the `references/` layout used by reference skills (`formio-api`, `formio-form`). Rationale: this is a flow with approval gates, not a lookup library; each doc scripts one step. Files:

| Doc | Covers |
|---|---|
| `SKILL.md` | Router: three-clause description, stance, the four steps with links, SCHEMA delegation to `formio-schema`, MCP Tool Preference, URL terminology |
| `FORM_TYPES.md` | What each form type is (webform / wizard / PDF form), capabilities, when to choose it, how INTENT distinguishes them; wizard section covers nested/child wizard workflows |
| `INTENT.md` | The single batched `AskUserQuestion` interview script: form type (infer-and-confirm vs ask) + embed intent (embed handoff fires only on explicit yes) |
| `SAVE.md` | `form_create` invocation, the saved-form confirmation (path/URL), and error branches — auth failure routes through the `authenticate` portal-login flow |
| `EMBED.md` | Conditional handoff contract to `formio-form` (form URL, framework rules: unnamed framework → `formio-form`; Angular-explicit → `formio-angular`) |

No YAML frontmatter on the step docs (repo convention for non-SKILL.md docs).

SCHEMA gets no step doc: the step is "invoke `formio-schema` with the confirmed form type and the user's field requirements" — a delegation statement in `SKILL.md`, not a script. Writing a SCHEMA.md would invite duplicating component guidance that must live only in `formio-schema`.

### D2: INTENT is one batched interview capturing form type AND embed intent

Same pattern as `formio-application`'s INTENT step: one `AskUserQuestion` call, two questions.

- **Form type** — infer from phrasing when unambiguous ("multi-page form" ⇒ wizard, "pdf form" ⇒ pdf) and present the inference as the recommended option to confirm; ask open when ambiguous. `FORM_TYPES.md` holds the distinguishing signals.
- **Embed intent** — captured up front so a standalone "make me a survey" stays fast. The EMBED step fires ONLY on an explicit yes; "no" and "unsure/later" both mean the flow ends at SAVE with the form URL in hand (the user can invoke `formio-form` later).

Alternative — ask embed intent after SAVE — rejected: it adds a second interview round-trip to every run, and the answer changes nothing before EMBED anyway; batching keeps the fast path fast.

### D3: Description routing — the form-vs-resource boundary is stated verbatim

Three-clause template:

- **Capability clause**: orchestrator that builds a single Form.io form end to end — determines form type (webform, wizard, or PDF form), delegates schema authoring, saves via the MCP server, and optionally hands off to embedding.
- **Trigger clause** (`Use when the user asks to …`): "build a form", "create a form", "I would like a new form", "multi-page form", "build a wizard", "create a survey / contact form / intake form / registration form / questionnaire", "pdf form" — single-form creation intents.
- **Boundary rule**, stated explicitly in the description: "build a form to collect X" (standalone form) = this skill; "track X / manage X / build an app around X" (data model, CRUD, resources) = `formio-application` / `formio-resource-planner`.
- **Negative clause** (`Not for:`): embedding an EXISTING form (see `formio-form`); building a whole app, portal, or tracker (see `formio-application`); designing resources/data models/permissions (see `formio-resource-planner`); raw form JSON schema lookups without the build-and-save flow (see `formio-schema`); Form.io REST endpoint lookups (see `formio-api`).

Reverse pointers: `formio-application` and `formio-resource-planner` descriptions gain `Not for:` pointers at `formio-form-builder` for standalone single-form creation; `formio-form`'s description gains one for create-a-new-form requests (it stays embed-only). `formio-schema` gets none (spec-forbidden string, see Context).

### D4: Inbound handoffs are requirements on the siblings, not prose in this skill

Two siblings route TO `formio-form-builder`:

- `formio-application`: when the user asks for a standalone FORM (not a resource, not a data model, not an app) — an ADDED requirement on `formio-application-skill`.
- `formio-form`: when an embed request reveals the form does not exist yet, or the request needs form-type determination before embedding — an ADDED requirement on `formio-form-skill`.

Encoding these on the sibling capabilities (rather than only describing them in `formio-form-builder`'s docs) keeps each skill's spec the single source of truth for its own routing behavior, matching how the library's other reverse pointers are specified.

### D5: SAVE uses `form_create` with the canonical auth story

`SAVE.md` scripts: an approval gate showing the form title/path/type and target project before the call; the `form_create` invocation; on success, confirming the saved form path and full form URL (`{FORMIO_PROJECT_URL}/{formPath}`) back to the user; on auth error, routing through the `authenticate` portal-login flow (browser opens, JWT captured, attached as `x-jwt-token` via `formioFetch` — never PKCE, never API keys) and retrying. `SKILL.md` carries the `## MCP Tool Preference` section naming `form_create`, `form_get`, and `authenticate` with the canonical portal-login JWT paragraph. Terminology stays strict: `baseUrl` ⇒ `FORMIO_BASE_URL` only; `projectUrl` ⇒ `FORMIO_PROJECT_URL` only.

### D6: Structural tests must be substring-collision-safe

`formio-form-builder` contains the substring `formio-form`. Naive `toContain('formio-form')` assertions cannot distinguish a pointer at the embed skill from a pointer at this skill. The structural tests (and the sibling reverse-pointer assertions) therefore match backtick-delimited names — `` `formio-form` `` vs `` `formio-form-builder` `` — or an equivalent word-boundary regex. This also protects the existing `formio-form` structural test suite, whose sibling-pointer assertions would otherwise pass vacuously against `formio-form-builder` mentions.

Test file: `packages/skill-tests/src/formio-form-builder/skill-structure.test.ts`, following the `formio-form` pattern: frontmatter (`name: formio-form-builder`, non-empty description), three clauses with all five Not-for names, boundary rule present, the four step docs exist / non-empty / no frontmatter, MCP Tool Preference section (`form_create`, `form_get`, `authenticate`, `x-jwt-token`), dev symlink resolution, and sibling reverse-pointer assertions for `formio-application`, `formio-resource-planner`, and `formio-form`.

### D7: Plugin packaging updated in-change

`plugin-build.test.ts` assertion 1.3 gains `formio-form-builder` in its inclusion list, and the `claude-plugin-packaging` spec's "Plugin bundles the skills library" requirement adds the skill to the bundled set. The build script copies `plugin/skills/` wholesale, so no build-script change is expected — the test update is the guard. This is done in this change deliberately: `add-formio-form-skill` shipped its skill against a stale exclusion assertion and had to fix it after the fact.

## Risks / Trade-offs

- [Trigger overlap with `formio-application` on ambiguous phrasing ("I need something to collect maintenance requests")] → The boundary rule is stated verbatim in BOTH descriptions (this skill's positive form and the siblings' `Not for:` pointers); when genuinely ambiguous, the INTENT interview surfaces the distinction ("just a form, or an app around the data?") before any work happens.
- [Substring collision `formio-form` / `formio-form-builder` weakens description-based routing and tests] → Backtick-delimited name matching in all new assertions (D6); descriptions always write the full backticked skill name.
- [`formio-form-skill` base spec is in an unarchived change; archive order could conflict] → This change's delta copies the pending version's full requirement text and layers the addition on top; archiving `add-formio-form-skill` first keeps the merge clean. Noted in tasks.
- [PDF form creation may not be fully achievable via `form_create` alone (PDF upload is a hosted-server concern)] → `FORM_TYPES.md` documents the capability honestly: choosing "pdf" sets `display: "pdf"` and notes the PDF-document upload prerequisite; the skill never promises server-side PDF conversion.
- [help.form.io source docs drift after authoring] → Docs are cited as authoring sources in the change, not linked as living dependencies inside the skill; structural tests guard the contract that matters (layout, routing, tool preference).

## Open Questions

None — layout, routing boundaries, handoff contracts, and test scope are settled above.
