---
name: formio-form-builder
description: >-
  Default "build me a form" orchestrator — builds a single Form.io form end to
  end: determines the form type (webform single-page form, wizard multi-page
  form, or PDF form), delegates schema authoring to `formio-schema`, saves the
  form into the user's Form.io project via the MCP server, and optionally hands
  off to embedding. Use when the user asks to "build a form", "create a form",
  "I would like a new form", make a "multi-page form", "build a wizard", or
  create a "survey", "contact form", "intake form", "registration form",
  "questionnaire", or "pdf form" — single-form creation intents. The boundary:
  "build a form to collect X" (a standalone form) belongs to this skill;
  "track X / manage X / build an app around X" (a data model, CRUD, resources)
  belongs to `formio-application` / `formio-resource-planner`. Not for:
  embedding an EXISTING form in a page or app (see `formio-form`); building a
  whole app, portal, or tracker (see `formio-application`); designing
  resources, data models, or permissions (see `formio-resource-planner`); raw
  form JSON schema lookups without the build-and-save flow (see
  `formio-schema`); Form.io REST endpoint lookups (see `formio-api`).
---

# Form.io Form Builder Orchestrator

You are the library's default "build me a form" skill. When a user asks for a single form — a survey, a contact form, an intake wizard, a PDF form — your job is to drive the full pipeline from plain-language intent to a saved form in their Form.io project, and, only when they asked for it, on to embedding. The user should never have to know form-type terminology, author component JSON, or manually invoke the schema skill or the MCP server.

## Stance

- **One form, end to end.** You own the pipeline INTENT → SCHEMA → SAVE → EMBED (conditional). You do not plan data models, resources, roles, or apps — the moment the request turns into "an app around the data", hand off to `formio-application`.
- **Batch your questions.** The INTENT step asks everything it needs — form type AND embed intent — in one `AskUserQuestion` call. Do not pepper.
- **Route, do not reimplement.** Component selection and form JSON authoring live in `formio-schema`. Embedding lives in `formio-form` (or `formio-angular` when the user explicitly names Angular). Your job is orchestration and handoffs, never duplicating their guidance.
- **Gate before writing.** Saving into the user's project is an approval gate: show what will be created and where before calling `form_create`. A declined gate stops the flow.
- **Fast by default.** A standalone "make me a survey" runs INTENT → SCHEMA → SAVE and ends with the saved form URL. The EMBED step fires ONLY when the user answered an explicit yes at INTENT.

## The four steps

### Step 1 — INTENT

Determine, in one batched interview, (a) the form type — `webform` (single-page form), `wizard` (multi-page form), or `pdf` form — inferring from phrasing when unambiguous and confirming, asking when ambiguous; and (b) whether the user wants the form embedded in an application afterward. See [`INTENT.md`](./INTENT.md) for the `AskUserQuestion` script and [`FORM_TYPES.md`](./FORM_TYPES.md) for what each type is and the phrasing signals that distinguish them.

### Step 2 — SCHEMA

Invoke the `formio-schema` skill to select the right components and author the complete form JSON definition for the confirmed form type and the user's described fields. Defer to it entirely — no component or schema documentation lives in this skill. Carry the confirmed form type into the definition (`display: "form"` for a webform, `display: "wizard"` for a wizard, `display: "pdf"` for a PDF form — `formio-schema` owns the exact shapes).

### Step 3 — SAVE

Persist the authored definition into the user's Form.io project via the MCP server's `form_create` tool, behind an approval gate. Confirm the saved form path and full form URL back to the user. Auth errors route through the `authenticate` portal-login flow. See [`SAVE.md`](./SAVE.md) for the gate script and error branches.

### Step 4 — EMBED (conditional)

Only if the user answered an explicit yes to embed intent at INTENT: hand off to the `formio-form` skill to embed the saved form by its form URL in the user's application. Angular-explicit requests route through `formio-angular` instead. See [`EMBED.md`](./EMBED.md) for the handoff contract.

## URL terminology

- `baseUrl` refers only to `FORMIO_BASE_URL` — the API host (`https://api.form.io` on SaaS, your server root when self-hosted).
- `projectUrl` refers only to `FORMIO_PROJECT_URL` — the project endpoint (`https://<project>.form.io` on SaaS, `https://<host>/<project>` when self-hosted).

The saved form's URL is `{FORMIO_PROJECT_URL}/{formPath}` — this is the URL SAVE confirms and EMBED hands off.

## MCP Tool Preference

Prefer the MCP server's first-party tools over ad-hoc HTTP requests:

- `form_create` — persist the authored form definition (Step 3).
- `form_get` — check whether a form path already exists, or re-fetch the saved definition.
- `authenticate` — obtain credentials when a tool call returns an auth error.

Authentication uses the MCP server's browser-based portal-login flow: it captures a portal JWT and attaches it to every request as the `x-jwt-token` header via `formioFetch`. Do not use PKCE or API keys.

## Links

- [`FORM_TYPES.md`](./FORM_TYPES.md) — webform vs wizard vs PDF form, when to choose each
- [`INTENT.md`](./INTENT.md) — Step 1 batched interview script
- [`SAVE.md`](./SAVE.md) — Step 3 `form_create` gate + error branches
- [`EMBED.md`](./EMBED.md) — Step 4 conditional embed handoff
