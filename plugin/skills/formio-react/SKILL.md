---
name: formio-react
description: >-
  React framework implementor for the Form.io skill library — a router over three branches: build a greenfield React application around a Form.io project, add Form.io resource CRUD to a React application that already exists, or embed a single form. Targets Vite, React Router data routers, and `@formio/react`. Claims ONLY React-explicit triggers. Use when the user says "build it in React", "React front-end for this Form.io project", "use React", "use `@formio/react`", "the React skill", "add Form.io CRUD to my React app", "wire this Form.io project into my existing React app", or "embed a Form.io form in React". Not for: framework-agnostic app requests (see `formio-application`); planning a data model (see `formio-resource-planner`); framework-agnostic embed/render-a-form requests (see `formio-form`); Angular work (see `formio-angular`); REST endpoint lookups (see `formio-api`).
---

# Form.io + React — Framework Implementor

React is where this library's work lands three different ways, so this skill routes before it builds. One request wants a new application stood up around a Form.io project; another wants Form.io CRUD added to a React codebase that already exists and has its own conventions; a third wants a single form on a page. They share a preflight and very little else.

**This file is a router.** It holds the dispatch table, the shared preflight, and the handoff contracts. Every branch's own steps live in a sibling document, so a reader arriving for one branch never has to read another branch's steps to find their own.

What this skill does not do: choose the framework, design the data model, or import a template. Those belong upstream, to `formio-application` and `formio-resource-planner`, and they run before you.

## Dispatch — pick the branch first

Determine which branch the request belongs to BEFORE loading any branch document.

| Branch | Request shape | Chain |
| --- | --- | --- |
| Greenfield application | Build a new React application around a Form.io project | `SETUP.md` → `BOOTSTRAP.md` → `CONFIG.md` → `AUTH.md` → `formio-react-resources/SKILL.md` |
| Existing application | Add Form.io resource CRUD to a React application that already exists | `SETUP.md` → `EXISTING.md` → backfill `CONFIG.md` / `AUTH.md` as needed → `formio-react-resources/SKILL.md` |
| Embed a form | Render one Form.io form inside a React page | `SETUP.md` (project URLs only, when needed) → `formio-react-form/SKILL.md` |

The branches are mutually exclusive. When the request does not make the branch obvious, ask which one applies in ONE question round, using the client's structured question mechanism (in Claude Code, `AskUserQuestion`), before loading anything.

**When the workspace contradicts the stated branch, say so and confirm.** A greenfield request in a directory that already holds a React application, or an existing-application request in an empty directory, is a mismatch to surface rather than proceed through. Scaffolding over someone's app because they said "new" is not a recoverable mistake.

The embed branch is not an application build: it needs the project URLs and a provider, not a workspace, an auth surface, or a resource hierarchy. It runs none of `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, or `AUTH.md`, and does not load `formio-react-resources`.

When an embed request turns out to want list, create, and edit screens over a resource, **re-dispatch** to the appropriate CRUD branch and say why the branch changed. Conversely the CRUD branches document no standalone embedding — that guidance lives in the embed branch alone.

## Preflight — the Form.io MCP server

**Check this when you reach your first Form.io tool call, not when this skill activates.** The check is whether `form_list` is callable by you, under whatever name this client exposes it. If it is, proceed. If it is not, load the `formio-mcp-setup` skill and use it to help the user connect the server; that skill is the only remedy you offer, and this skill writes no MCP configuration itself.

**A missing server blocks that call, not the turn.** Reading this skill, answering a question from it, planning, and writing files to the working directory all need no server. Do everything that needs no server first and in full, then raise the gap when you actually reach the call that needs it. Opening with a blocked-on-setup message — or asking for a Project URL before there is anything to write to it — spends the user's turn on a step that was not due.

## Never work around missing tools

Do **not** work around missing tools by making direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. This library documents the whole Form.io REST surface, which makes hand-rolling requests tempting and wrong — it bypasses the guardrails the tools enforce and can write to a live deployment unreviewed. Stop and report what is blocking instead.

That ban is on **build-time** work — the configuring you do in this session. It says nothing about the application you are building: an app is expected to call the Form.io REST API **at runtime**, to log its users in and to read and write their submissions, and [`formio-api`](../formio-api/SKILL.md)'s runtime-scope references document those endpoints for exactly that code.

## Which project the tools target

**Available tools are not a configured project.** Every Form.io tool resolves which project it targets per working directory, so pass `cwd` — the user's current working directory — on every Form.io tool call; omitting it resolves against the MCP server's own directory, which is fixed at spawn and may be mapped to a different project. Before the first call that reads from or writes to a deployment, ask the server what this directory resolves to by calling the `project_get` tool with `cwd` set to the user's current working directory. Do not shell out for this: the connected server answers it directly, with the same resolver every other tool uses, so what it reports is what the next call targets. If `project_get` is not callable, the connected server predates it — load the `formio-mcp-setup` skill, which moves the pinned version forward.

What `project_get` returns IS the configuration. There is one value to think about — the **Project URL**, the full URL of the Form.io project this work reads and writes. The **Base URL** (the deployment hosting it) is normally DERIVED from that project URL rather than supplied, so it is not a second thing to ask for. The values may come from a committed `formio.json` tracked with the application's own source, from this directory's mapping, or from the environment — the report says which. Do not ask the user to confirm or re-supply either one.

Branch on the `status` it returns. On `ok`, proceed. On `not-configured` — nothing is recorded for this directory — relay that message's own instruction to the user, ask for the single value it names, record it with `project_set`, and call `project_get` again. On `base-url-unresolved` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask the user for that one value, and do exactly what that message names — which record the deployment goes in decides what the fix IS, and the report names it rather than leaving you to compose one. For a project this directory's own mapping holds, that is a `project_set` call, and the report also carries it as a structured `remedy`. For a project a committed `formio.json` holds, it is an EDIT to that file — the report names the path and the key, there is no `remedy` field to act on, and this server never writes a committed file, so composing a `project_set` call there is refused. Then call `project_get` again. Do not re-ask the user for the Project URL there; the report already reported it, and the call it names carries it for you. If the call fails outright instead of returning a status, it could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): do NOT interview, because a `project_set` would fail for the same unreported reason and the loop would repeat with the cause never named — relay the error and stop until it is fixed. Before the first call that WRITES (`form_create`, `form_update`, `role_create`, `action_create`, `project_import`), state the resolved Project URL and Base URL in one line, so a wrong target is caught before anything is written to it.

Never invent a Base URL, never reuse one from another project or an earlier session, and never edit `~/.formio/projects.json` by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project_set` is how you reach it. The server's own messages carry the URL shapes and the remedy for each; this skill does not restate them.

## Greenfield branch — five gated phases

Run these in strict order, each loading its document by path, **with a user-approval gate between each**. A declined gate stops the flow without writing partial state.

1. **SETUP** — [`SETUP.md`](./SETUP.md). Establish the workspace root and resolve the project configuration.
2. **BOOTSTRAP** — [`BOOTSTRAP.md`](./BOOTSTRAP.md). Create the Vite + React + TypeScript workspace, install dependencies, capture versions, stash the design brief.
3. **CONFIG** — [`CONFIG.md`](./CONFIG.md). Generate `src/config.ts` and mount `FormioProvider`.
4. **AUTH** — [`AUTH.md`](./AUTH.md). Generate the login, register, and logout routes, the root-loader user, and `requireUser`.
5. **Resources** — load [`formio-react-resources/SKILL.md`](./formio-react-resources/SKILL.md) by path and hand off.

Without the gates a single "build it in React" scaffolds a workspace, writes configuration, and generates an entire authentication surface with no stopping point.

**No phase is skipped silently.** When a re-run finds a phase already satisfied, say so and move on.

**Reset to an earlier phase** when the workspace changes underneath you: the project URL is re-pointed (reset to SETUP), dependencies are reinstalled or the router is swapped (reset to BOOTSTRAP), or `src/config.ts` is edited by hand (reset to CONFIG). State which phase you are resetting to and why.

## Existing-application branch

Load [`EXISTING.md`](./EXISTING.md). It inspects the application and reports before changing anything, then backfills ONLY the missing prerequisites. `BOOTSTRAP.md` never runs on this branch.

## Planning and import are not yours

This skill never runs the planner and never imports. `formio-resource-planner` and template import into a Form.io project both belong to `formio-application`.

When you are invoked directly by a React-explicit trigger, expect an already-approved `template.json` and a project the template has been imported into. **When neither exists, ask the user to invoke `formio-application` first** rather than planning yourself — that skill runs the planner, imports, and hands off to you. The chain cannot usefully proceed without the plan in any case: BOOTSTRAP sizes the workspace against it, AUTH renders the planner's login and registration forms, and Resources generates from it.

## Target stack

**Vite + React Router data routers + TypeScript**, client-rendered.

React Router's data-router API (`createBrowserRouter` with `RouteObject` arrays) is what this skill generates against: loaders, actions, `errorElement`, and post-action revalidation are what let the generated code drop the service, registry, alert bus, and refresh emitter that `@formio/angular` needs. React Router is not the only router in React, and the kernel's domain logic is router-agnostic by design — see `formio-react-resources/references/app-integration.md` for what another router would have to supply. What cannot host the generated resources is a router with **no data phase**: `<BrowserRouter>` with `<Routes>` alone has nowhere to put a loader.

**Out of scope:** Next.js App Router, and server-rendered React Router **framework mode**. Both server-render, and `@formio/js` is DOM-only — a loader that runs on the server cannot feed a server-rendered form screen. Say this plainly rather than generating output that will not run.

## Handoff contract with the resources sub-skill

Load `./formio-react-resources/SKILL.md` by path as the last step of BOTH CRUD branches. Do not invoke it by frontmatter name.

Payload — the field names `formio-angular` uses, so `formio-application` needs no per-framework adaptation, plus two this skill adds for its own two CRUD branches (`formio-application` sends neither; the sub-skill defaults a missing `branch` to `'existing'` and runs `EXISTING.md`'s inspection itself):

- `workspacePath`
- `templateMdPath` and `templateJsonPath`
- `userRequest` (extend path)
- `newResourceNames` (extend path)
- `frontendDesignStatus`
- `branch` — `'greenfield'` or `'existing'`
- On the existing branch: the inspection findings — design conventions, authentication arrangement, current-user source

URLs are deliberately absent, as they are for Angular: the sub-skill resolves them with `project_get` and reconciles against the workspace's own `src/config.ts`.

## Links

- [`SETUP.md`](./SETUP.md) · [`BOOTSTRAP.md`](./BOOTSTRAP.md) · [`EXISTING.md`](./EXISTING.md) · [`CONFIG.md`](./CONFIG.md) · [`AUTH.md`](./AUTH.md)
- [`formio-react-resources/SKILL.md`](./formio-react-resources/SKILL.md) · [`formio-react-form/SKILL.md`](./formio-react-form/SKILL.md)
- [`project-urls.md`](../formio-mcp-setup/references/project-urls.md) — the canonical URL guidance
