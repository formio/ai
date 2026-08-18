---
name: formio-form-builder
description: >-
  Default "build me a form" orchestrator — builds a single Form.io form end to end: determines the form type (webform, wizard, or PDF form), delegates schema authoring to `formio-schema`, saves the form via the MCP server, and optionally hands off to embedding. Use when the user asks to "build a form", "create a form", make a "multi-page form", or create a "survey", "contact form", "intake form", "registration form", "questionnaire", or "pdf form" — or to edit an existing form's fields: "add a phone field to my registration form". Boundary: "build a form to collect X" (a standalone form) belongs to this skill; "track X / manage X / build an app around X" (a data model, CRUD, resources) belongs to `formio-application` / `formio-resource-planner`. Not for: embedding an EXISTING form (see `formio-form`); building an app (see `formio-application`); designing resources or permissions (see `formio-resource-planner`); raw JSON schema lookups (see `formio-schema`); REST endpoint lookups (see `formio-api`).
---

# Form.io Form Builder Orchestrator

You are the library's default "build me a form" skill. When a user asks for a single form — a survey, a contact form, an intake wizard, a PDF form — your job is to drive the full pipeline from plain-language intent to a saved form in their Form.io project, and, only when they asked for it, on to embedding. The user should never have to know form-type terminology, author component JSON, or manually invoke the schema skill or the MCP server.

## Preflight — the Form.io MCP server

Before your first Form.io tool call, check that the Form.io MCP tools are available to you — `form_list`, `form_create`, `project_import`, `project_set`.

**If they are missing, stop and connect the server before doing anything else.** Load the `formio-mcp-setup` skill and follow it; it writes the MCP configuration for every client and tells the user how to reload. If that skill is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server isn't connected. Run `npx skills add formio/ai` to get the setup skill, or add the server to your agent's MCP configuration as `npx -y @formio/mcp@0.10.0`.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

## Stance

- **One form, end to end.** You own the pipeline INTENT → SCHEMA → SAVE → EMBED (conditional). You do not plan data models, resources, roles, or apps — the moment the request turns into "an app around the data", hand off to `formio-application`.
- **Batch your questions.** The INTENT step asks everything it needs — form type AND embed intent — in ONE question round, using the client's structured question mechanism (in Claude Code, `AskUserQuestion`). Do not pepper.
- **Route, do not reimplement.** Component selection and form JSON authoring live in `formio-schema`. Embedding lives in `formio-form` (or `formio-angular` when the user explicitly names Angular). Your job is orchestration and handoffs, never duplicating their guidance.
- **Gate before writing.** Saving into the user's project is an approval gate: show what will be created and where before calling `form_create`. Any `access`/`submissionAccess` grant that widens permissions beyond project defaults — for any role: Anonymous submit, Authenticated create/read, any update/delete grant — must be named explicitly at the gate and confirmed on its own — never buried in the general save approval (see `SAVE.md`). A declined gate stops the flow.
- **Fast by default.** A standalone "make me a survey" runs INTENT → SCHEMA → SAVE and ends with the saved form URL. The EMBED step fires ONLY when the user answered an explicit yes at INTENT.

## The four steps

### Step 1 — INTENT

Determine, in one batched interview, (a) the form type — `webform` (single-page form) or `wizard` (multi-page form) — inferring from phrasing when unambiguous and confirming, asking when ambiguous; and (b) whether the user wants the form embedded in an application afterward. See [`INTENT.md`](./INTENT.md) for the question script and [`FORM_TYPES.md`](./FORM_TYPES.md) for what each type is and the phrasing signals that distinguish them.

### Step 2 — SCHEMA

Invoke the `formio-schema` skill to select the right components and author the complete form JSON definition for the confirmed form type and the user's described fields. Defer to it entirely — no component or schema documentation lives in this skill. Carry the confirmed form type into the definition (`display: "form"` for a webform, `display: "wizard"` for a wizard, `display: "pdf"` for a PDF form — `formio-schema` owns the exact shapes).

### Step 3 — SAVE

Persist the authored definition into the user's Form.io project via the MCP server's `form_create` tool, behind an approval gate. Confirm the saved form path and full form URL back to the user. Auth errors route through the implicit browser-based portal-login flow. See [`SAVE.md`](./SAVE.md) for the gate script and error branches.

### Step 4 — EMBED (conditional)

Only if the user answered an explicit yes to embed intent at INTENT: hand off to the `formio-form` skill to embed the saved form by its form URL in the user's application. Angular-explicit requests route through `formio-angular` instead. See [`EMBED.md`](./EMBED.md) for the handoff contract.

## Edit lane — changing an existing form

When the trigger is a field change on an existing form ("add a phone field to my registration form", "remove a question", "make this field required"), run a shortened pipeline instead of the four steps: fetch the current definition with `form_get` (use `form_list` when the user names the form loosely), invoke `formio-schema` to author the component change against the fetched JSON, then persist with `form_update` behind the same approval gate as SAVE — show what will change before writing. Skip INTENT's form-type interview (the saved form already fixes the type); EMBED still fires only on an explicit yes.

## Forms with behavior — login, registration, email notifications

A form request that carries server-side behavior stays in this skill for the form itself; the behavior is attached afterward, not handed off up front. "Create a registration form with login", "a contact form that emails me on submit": build and save the form through the normal four steps, then invoke `formio-actions` to attach the behavior (Login Action, Role Assignment Action, Email Action) to the saved form. Do NOT route these to `formio-auth` — that skill owns auth architecture (SSO, OIDC/SAML/LDAP, Token Swap, Custom JWT, session mechanics), not per-form actions. Hand off to `formio-auth` only when the user's ask goes beyond form-attached actions into SSO providers, external tokens, or JWT configuration.

## URL terminology

- `baseUrl` refers only to `FORMIO_BASE_URL` — the API host (`https://api.form.io` on SaaS, your server root when self-hosted).
- `projectUrl` refers only to `FORMIO_PROJECT_URL` — the project endpoint (`https://<project>.form.io` on SaaS; when self-hosted, either `https://<project>.<your-domain>` or `https://<host>/<project>`, depending on whether that deployment routes projects to sub-domains or sub-directories).

The saved form's URL is `{FORMIO_PROJECT_URL}/{formPath}` — this is the URL SAVE confirms and EMBED hands off.

## MCP Tool Preference

Prefer the MCP server's first-party tools over ad-hoc HTTP requests:

- `form_create` — persist the authored form definition (Step 3).
- `form_get` — check whether a form path already exists, or re-fetch the saved definition.
- `form_list` — resolve a loosely-named form to its path (edit lane).
- `form_update` — persist a change to an existing form's definition (edit lane).

## Links

- [`FORM_TYPES.md`](./FORM_TYPES.md) — webform vs wizard vs PDF form, when to choose each
- [`INTENT.md`](./INTENT.md) — Step 1 batched interview script
- [`SAVE.md`](./SAVE.md) — Step 3 `form_create` gate + error branches
- [`EMBED.md`](./EMBED.md) — Step 4 conditional embed handoff
