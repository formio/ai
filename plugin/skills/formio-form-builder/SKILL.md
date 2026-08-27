---
name: formio-form-builder
description: >-
  Default "build me a form" orchestrator — builds a single Form.io form end to end: determines the form type (webform, wizard, or PDF form), delegates schema authoring to `formio-schema`, saves the form via the MCP server, and optionally hands off to embedding. Use when the user asks to "build a form", "create a form", make a "multi-page form", or create a "survey", "contact form", "intake form", "registration form", "questionnaire", or "pdf form" — or to edit an existing form's fields: "add a phone field to my registration form". Boundary: "build a form to collect X" (a standalone form) belongs to this skill; "track X / manage X / build an app around X" (a data model, CRUD, resources) belongs to `formio-application` / `formio-resource-planner`. Not for: embedding an EXISTING form (see `formio-form`); building an app (see `formio-application`); designing resources or permissions (see `formio-resource-planner`); raw JSON schema lookups (see `formio-schema`); REST endpoint lookups (see `formio-api`).
---

# Form.io Form Builder Orchestrator

You are the library's default "build me a form" skill. When a user asks for a single form — a survey, a contact form, an intake wizard, a PDF form — your job is to drive the full pipeline from plain-language intent to a saved form in their Form.io project, and, only when they asked for it, on to embedding. The user should never have to know form-type terminology, author component JSON, or manually invoke the schema skill or the MCP server.

## Preflight — the Form.io MCP server

**Check this when you reach your first Form.io tool call, not when this skill activates.** The check is whether `form_list`, `form_create`, `project_import`, `project_set`, `project_get` are callable by you. A Form.io-branded MCP server that does not expose them is not this server — an entry named for Form.io offering only connection or authentication tools does not satisfy this check, and "installed but not authenticated" is not a state this design has or that you may report. Either those tools are there or they are not.

**A missing server blocks that call, not the turn.** Reading this skill, answering a question from it, planning, and writing files to the working directory all need no server. Do everything that needs no server first and in full, then raise the gap when you actually reach the call that needs it. Opening with a blocked-on-setup message — or asking for a Project URL before there is anything to write to it — spends the user's turn on a step that was not due.

When you do reach that call and the tools are missing, stop there and load the `formio-mcp-setup` skill; it writes the MCP configuration this client reads, offers to capture the project configuration, and tells the user how to reload. This skill writes no MCP configuration itself, and **that skill is the only remedy you offer.** Do not invent one: no client menu, no slash command, no "authorize in the browser", no install or reload steps of your own. The setup skill owns every instruction the user receives, and an invented one sends them looking for a server entry that nothing ever wrote. If `formio-mcp-setup` is not installed either, tell the user:

> I have no Form.io tools, so the Form.io MCP server is not connected, and the `formio-mcp-setup` skill that would connect it is not installed either. Both ship in the Form.io skill library at https://github.com/formio/ai — its README carries the install route for every client, including the MCP server entry to add if you would rather configure it directly.

**Never pre-announce authentication.** Authentication is implicit: the first authenticated tool call opens the portal-login flow itself when no cached JWT is present. There is no authenticate-first step to ask the user for, and no unauthenticated state to diagnose before a call has actually failed.

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets per working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the `project_get` tool with `cwd` set to the user's current working directory. Do not shell out for this: the connected server answers it directly, with the same resolver every other tool uses, so what it reports is what the next call targets.

What `project_get` returns IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the report says which. Do not ask the user to confirm or re-supply either one.

Branch on the `status` it returns. On `ok`, proceed. On `not-configured` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, record it with `project_set`, and call `project_get` again. On `base-url-unresolved` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask the user for that one value, and do exactly what that message names — which record the deployment goes in decides what the fix IS, and the report names it rather than leaving you to compose one. For a project this directory's own mapping holds, that is a `project_set` call, and the report also carries it as a structured `remedy`. For a project a committed `formio.json` holds, it is an EDIT to that file — the report names the path and the key, there is no `remedy` field to act on, and this server never writes a committed file, so composing a `project_set` call there is refused. Then call `project_get` again. Do not re-ask the user for the Project URL there; the report already reported it, and the call it names carries it for you. If the call fails outright instead of returning a status, it could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project_set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the error and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project_set` is how you reach it. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

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

- `baseUrl` refers only to the **Base URL** — the deployment hosting the project.
- `projectUrl` refers only to the **Project URL** — the project this work reads and writes, and the one value anyone supplies.

Both are values `project_get` reports, not variables to read: nothing looks them up in the environment. Neither is composed from the other, and the shapes each one takes on each kind of deployment are in [`project-urls.md`](../formio-mcp-setup/references/project-urls.md) rather than here — one copy, so the two cannot drift apart.

The saved form's URL is `{projectUrl}/{formPath}` — this is the URL SAVE confirms and EMBED hands off.

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
