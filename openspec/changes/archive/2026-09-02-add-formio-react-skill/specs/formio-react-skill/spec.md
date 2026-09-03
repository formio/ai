## ADDED Requirements

### Requirement: Parent skill directory layout

The skills library SHALL provide a parent skill `formio-react` at `plugin/skills/formio-react/` containing:

- `SKILL.md` — the parent skill file with frontmatter `name: formio-react`
- `SETUP.md` — sibling reference document (no frontmatter) covering workspace and project-URL resolution
- `BOOTSTRAP.md` — sibling reference document (no frontmatter) covering Vite + React Router + TypeScript workspace bootstrap and dependency installation; loaded by the greenfield branch only
- `EXISTING.md` — sibling reference document (no frontmatter) covering the existing-application branch: workspace inspection, the router check, and which prerequisites to backfill
- `CONFIG.md` — sibling reference document (no frontmatter) covering `FormioProvider` wiring and the generated `src/config.ts`
- `AUTH.md` — sibling reference document (no frontmatter) covering the generated login / register / logout routes, the root-loader current user, and `requireUser` loader protection
- `formio-react-resources/SKILL.md` — the sub-skill file with frontmatter `name: formio-react-resources`
- `formio-react-resources/references/` — the sub-skill's reference material

The sub-skill's directory name SHALL equal its declared `name`. The sibling documents MUST NOT contain skill frontmatter; they are loaded by the parent `SKILL.md` by path.

The eval harness for the sub-skill SHALL NOT live under `plugin/skills/`; it lives at `packages/skill-tests/evals/formio-react-resources/` per the `shipped-surface-boundary` capability.

A symlink `.claude/skills/formio-react` SHALL resolve to `../../plugin/skills/formio-react`.

#### Scenario: Parent skill files exist

- **WHEN** the repository is inspected after the change is applied
- **THEN** `plugin/skills/formio-react/SKILL.md`, `SETUP.md`, `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, and `AUTH.md` all exist
- **AND** `plugin/skills/formio-react/formio-react-resources/SKILL.md` exists
- **AND** `plugin/skills/formio-react/formio-react-resources/evals/` does not exist
- **AND** `.claude/skills/formio-react` resolves to `plugin/skills/formio-react/`

#### Scenario: Sibling documents carry no frontmatter

- **WHEN** `SETUP.md`, `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, and `AUTH.md` are parsed
- **THEN** none of them begins with a YAML frontmatter block

### Requirement: Parent skill description and trigger surface

The `formio-react` `SKILL.md` frontmatter `description` SHALL follow the library's three-clause template — capability statement, a "Use when the user asks to …" trigger clause, and a "Not for: …" negative-trigger clause — and SHALL claim ONLY React-explicit triggers. It MUST include at least:

- Greenfield: "build it in React", "React front-end for this Form.io project", "use React", "use `@formio/react`", "the React skill".
- Existing application: "add Form.io CRUD to my React app", "wire this Form.io project into my existing React app".
- Invocation from `formio-application` via handoff context.

The description MUST NOT claim framework-agnostic build-an-app triggers ("build me an app", "spin up an app", bare archetypes such as "task manager", "CRM", "help desk"); those belong to `formio-application`. It MUST disambiguate from `formio-application` (orchestrator), `formio-resource-planner` (planner), `formio-form` (framework-agnostic embed), and `formio-angular` (the other framework implementor).

The description SHALL NOT claim embed-a-single-form triggers as work this skill performs. Embedding is a reserved branch that currently routes elsewhere, per the reserved-branch requirement below.

The description MUST fit the library-wide 1,024-character budget enforced by `skill-description-budget`.

#### Scenario: Description claims React-explicit triggers only

- **WHEN** `plugin/skills/formio-react/SKILL.md` frontmatter is parsed
- **THEN** its `description` contains React-naming triggers
- **AND** it contains no generic build-an-app phrasing and no bare domain archetypes

#### Scenario: Description fits the budget

- **WHEN** the description length is measured
- **THEN** it is at most 1,024 characters
- **AND** the same holds for `formio-react-resources`

### Requirement: `formio-react` is a router over named branches

`formio-react` SHALL be structured as a **router**, not as one linear procedure. Its `SKILL.md` SHALL open by determining which branch the request belongs to and SHALL then load that branch's documents by path. Branch-specific procedure prose SHALL live in the sibling documents, not in `SKILL.md`; `SKILL.md` holds the dispatch table, the shared preflight, and the handoff contracts.

The dispatch table SHALL name, for each branch, its trigger shape and the document chain it loads:

| Branch | Request shape | Chain |
| --- | --- | --- |
| Greenfield application | Build a new React application around a Form.io project | `SETUP.md` → `BOOTSTRAP.md` → `CONFIG.md` → `AUTH.md` → `formio-react-resources/SKILL.md` |
| Existing application | Add Form.io resource CRUD to a React application that already exists | `SETUP.md` → `EXISTING.md` → (backfill `CONFIG.md` / `AUTH.md` as needed) → `formio-react-resources/SKILL.md` |
| Embed a form | Render one Form.io form inside a React page | Reserved — see the reserved-branch requirement |

Branches SHALL be mutually exclusive. When the request does not make the branch obvious, `formio-react` SHALL ask in ONE question round before loading any branch document. When the workspace state contradicts the stated branch — a greenfield request in a directory that already holds a React application, or an existing-application request in an empty directory — the skill SHALL surface the contradiction and confirm rather than proceeding on the stated branch.

`SKILL.md` SHALL NOT be written as a single all-encompassing procedure covering every branch inline. A reader arriving for one branch must not have to read another branch's steps to find their own.

#### Scenario: Branch is selected before any branch document loads

- **WHEN** `formio-react` activates on a request naming no branch
- **THEN** it asks which branch applies in one question round
- **AND** no branch chain has been loaded when the question is asked

#### Scenario: Workspace contradicts the stated branch

- **WHEN** the user asks to build a new React application in a directory that already contains one
- **THEN** the skill surfaces the contradiction and confirms before scaffolding

#### Scenario: SKILL.md stays a router

- **WHEN** `SKILL.md` is inspected
- **THEN** it contains the dispatch table
- **AND** the greenfield bootstrap steps and the existing-application inspection steps live in their sibling documents rather than inline

### Requirement: Greenfield branch runs the five phases

On the greenfield branch, `formio-react` SHALL run five phases in strict order, each loading its document by path: SETUP, BOOTSTRAP, CONFIG, AUTH, and Resources — **with a user-approval gate between each**, matching the Angular parent. A declined gate SHALL stop the flow without writing partial state. Without the gates a single "build it in React" scaffolds a workspace, writes `src/config.ts`, and generates an entire authentication surface with no stopping point.

A phase SHALL NOT be skipped silently; when a re-run finds a phase already satisfied, the skill SHALL say so and move on. The skill SHALL document when to reset to an earlier phase, and what triggers a reset.

#### Scenario: Phases run in order behind gates

- **WHEN** the greenfield branch runs on an empty workspace
- **THEN** it runs SETUP, BOOTSTRAP, CONFIG, AUTH, and Resources in that order
- **AND** each phase ends with an approval gate before files are written

#### Scenario: A declined gate writes nothing

- **WHEN** the user declines a phase's gate
- **THEN** the flow stops without writing partial state

#### Scenario: Satisfied phase on a re-run is acknowledged, not skipped silently

- **WHEN** a greenfield run is repeated after a failure and finds `src/config.ts` already written with matching URLs
- **THEN** the skill states that CONFIG is already satisfied and proceeds to AUTH

### Requirement: Direct invocation without an upstream plan

`formio-react` SHALL NOT run `formio-resource-planner`, and SHALL NOT import a template into a Form.io project. Planning and import are `formio-application`'s responsibilities, exactly as they are for `formio-angular`.

When `formio-react` is invoked directly by a framework-explicit trigger, it SHALL expect an already-approved `template.json` and a project the template has been imported into. When neither exists, it SHALL ask the user to invoke `formio-application` first rather than planning itself — that skill runs the planner, imports, and hands off. The greenfield chain cannot usefully proceed without the plan in any case: BOOTSTRAP sizes the workspace against it, AUTH renders the planner's login and registration forms, and Resources generates from it.

#### Scenario: Direct invocation with no plan asks for the orchestrator

- **WHEN** the user says "build it in React" in a directory with no approved `template.json`
- **THEN** the skill asks the user to invoke `formio-application` first
- **AND** it does not run the planner itself and does not import anything

#### Scenario: Handoff supplies the plan

- **WHEN** `formio-application` hands off with `templateMdPath` and `templateJsonPath`
- **THEN** the skill proceeds without asking for a plan

### Requirement: Existing-application branch inspects, then backfills only what is missing

On the existing-application branch, `formio-react` SHALL NOT scaffold a workspace and SHALL NOT run BOOTSTRAP. It SHALL instead inspect the application and report what it found before changing anything. `EXISTING.md` SHALL define the inspection:

- Whether the app routes through React Router's data-router API, which the generated resources require.
- Whether `@formio/react` and `@formio/js` are installed, and at what versions.
- Whether a renderer stylesheet is present, since the renderer ships none and a form without one renders visually broken.
- Whether `FormioProvider` is mounted and against which project URL.
- Whether an authentication surface and a current-user source already exist.
- Which design system and file layout conventions the app uses, so generated screens match rather than import a second design language.

The skill SHALL then backfill ONLY the missing prerequisites, loading `CONFIG.md` or `AUTH.md` as needed, and SHALL leave satisfied ones alone. Where the application already provides a prerequisite in its own idiom — its own auth, its own user context, its own layout — the generated code SHALL integrate with it rather than replacing it, and any case where that is not possible SHALL be raised with the user rather than resolved by overwriting.

#### Scenario: Existing app is inspected before modification

- **WHEN** the existing-application branch runs
- **THEN** the skill reports the router style, installed packages, renderer stylesheet, provider state, auth state, and design conventions
- **AND** no files have been modified at that point

#### Scenario: Present prerequisites are not regenerated

- **WHEN** the application already mounts `FormioProvider` and has its own authentication
- **THEN** the skill backfills neither
- **AND** the generated resources integrate with the existing auth rather than adding a second one

#### Scenario: Bootstrap never runs on this branch

- **WHEN** the existing-application branch runs
- **THEN** `BOOTSTRAP.md` is not loaded and no workspace is scaffolded

### Requirement: Existing applications without a data router are detected and handled explicitly

The generated resources require React Router's data-router API. An existing application may route through `<BrowserRouter>` with `<Routes>` only, in which case loaders and actions are unavailable and the generated code cannot mount.

`EXISTING.md` SHALL require detecting this before any file is written, and SHALL NOT let the skill generate resources into an application that cannot run them. On detection, the skill SHALL explain the constraint in plain terms and offer, in ONE question round, either converting the app's routing to `createBrowserRouter` or stopping. It SHALL NOT convert an application's routing without that explicit approval — routing is load-bearing shared infrastructure, and a silent migration is a change no one asked for.

#### Scenario: Non-data router is caught before generation

- **WHEN** the existing application routes only through `<Routes>`
- **THEN** the skill reports the constraint and asks before writing any file

#### Scenario: Routing is never migrated silently

- **WHEN** the user does not approve the conversion
- **THEN** no routing files are modified and the skill stops, saying what is blocked

### Requirement: A reserved branch leaves room for React form embedding

Rendering a single Form.io form inside a React page — `@formio/react`'s `Form` component, `FormioProvider`, and the React-specific embedding concerns — is a distinct capability from resource CRUD and is NOT specified by this change. The structure SHALL leave room for it:

- The dispatch table SHALL carry the embed branch as a row marked reserved, so adding it later is a table edit plus a sub-skill, with no restructuring of `SKILL.md`.
- Until that sub-skill exists, a React embed request SHALL route to `formio-form`, the framework-agnostic embed skill, and the skill SHALL disclose that the guidance there covers the Vanilla JS renderer rather than `@formio/react`'s component. A reserved branch is a signpost, not a dead end.
- The CRUD branches SHALL NOT absorb embedding guidance to fill the gap. `formio-react` SHALL NOT document `Form` component usage as general embedding advice outside the resource screens it generates.

Adding the branch later SHALL require: a new nested sub-skill directory whose name matches its frontmatter `name`, one dispatch-table row, and the corresponding `Not for:` adjustments. No requirement in this capability is expected to change.

#### Scenario: Embed request is routed, not refused

- **WHEN** the user asks how to embed a Form.io form in their React page
- **THEN** the skill routes to `formio-form`
- **AND** it discloses that the guidance covers the Vanilla JS renderer rather than `@formio/react`

#### Scenario: Reserved row is present

- **WHEN** `SKILL.md`'s dispatch table is inspected
- **THEN** it carries an embed row marked reserved, naming where such a request goes today

#### Scenario: CRUD branches do not absorb embedding

- **WHEN** the greenfield and existing-application chains are inspected
- **THEN** neither documents standalone form embedding as its own topic

### Requirement: Target stack is Vite plus React Router data routers

`BOOTSTRAP.md` SHALL target a Vite React TypeScript workspace and React Router's data-router API (`createBrowserRouter` with `RouteObject` arrays). The data-router API is a hard requirement rather than a preference: loaders, actions, `errorElement`, and post-action revalidation are what let the generated code drop Angular's service, registry, alert bus, and refresh emitter entirely, per the `formio-resource-kernel` capability. A workspace routing through `<BrowserRouter>` with `<Routes>` alone cannot host the generated resources.

**The target is a client-rendered single-page application.** React Router's framework mode also provides loaders, and they run on the **server**, where `@formio/js` has no `window` — the renderer is DOM-only, so a kernel loader that fetches for a screen the server then renders breaks in a way "data routers required" would appear to have endorsed. `BOOTSTRAP.md` SHALL state that the generated application is client-rendered, and `SKILL.md` SHALL list server-rendered React Router framework mode alongside Next.js as out of scope for the CRUD branches.

**StrictMode stays on.** Vite's React template enables StrictMode, and `BOOTSTRAP.md` SHALL leave it enabled. It double-invokes effects in development, which is a deliberate check that surfaces lifecycle bugs — including in the form renderer's asynchronous instance creation. When a generated screen misbehaves under it, the response is to find the cause, never to remove StrictMode: that trades a visible development symptom for the same defect hidden in production. `BOOTSTRAP.md` SHALL state this, because disabling it is the fix a reader reaches for first.

**The renderer ships no stylesheet.** `@formio/js` emits Bootstrap-classed markup and supplies no CSS, so an application that installs the packages and renders a form gets a visually broken form. `BOOTSTRAP.md` SHALL install and import a renderer stylesheet as part of the dependency step, and SHALL state that this is separate from the application's own design language. `EXISTING.md` SHALL add the same check to its inspection: whether a renderer stylesheet is already present, and backfill it when it is not.

It SHALL pin the dependency set it installs and SHALL capture the resolved versions of `@formio/react` and `@formio/js` for the record, in the same way `formio-angular/BOOTSTRAP.md` captures its versions.

Next.js App Router is out of scope for this capability. `SKILL.md` SHALL say so explicitly, so a Next.js user is told the limit rather than handed Vite output that does not fit their app.

#### Scenario: Bootstrap produces a Vite data-router workspace

- **WHEN** BOOTSTRAP completes on a new workspace
- **THEN** the workspace builds with Vite and routes through `createBrowserRouter`

#### Scenario: Next.js is declined explicitly

- **WHEN** the user asks for a Next.js App Router application
- **THEN** the skill states that this skill targets Vite plus React Router and does not generate App Router output

#### Scenario: Server-rendered framework mode is declined too

- **WHEN** the user asks for a server-rendered React Router framework-mode application
- **THEN** the skill states that the generated resources are client-rendered and that server loaders would run where the renderer has no DOM

#### Scenario: StrictMode is left enabled

- **WHEN** BOOTSTRAP completes
- **THEN** the generated application still has StrictMode enabled
- **AND** `BOOTSTRAP.md` states that removing it is not a remedy for a misbehaving screen

#### Scenario: A renderer stylesheet is installed and imported

- **WHEN** BOOTSTRAP completes
- **THEN** a renderer stylesheet is installed and imported
- **AND** the skill states that this is separate from the application's design language

### Requirement: `FormioProvider` carries the two URLs

`CONFIG.md` SHALL generate a `src/config.ts` holding the Project URL and the Base URL, and mount `<FormioProvider projectUrl={...} baseUrl={...}>` at the application root. `projectUrl` is the Project URL — the project the application reads and writes. `baseUrl` is the Base URL — the deployment hosting it, normally derived rather than supplied.

Both values SHALL come from the `project_get` MCP tool called with `cwd` set to the workspace root when the Form.io tools are callable, and from the user when they are not. Neither value SHALL be hardcoded from an example host, composed by appending a project name to a deployment URL, or carried over from another project or session.

`CONFIG.md` SHALL NOT restate the URL-resolution rules the MCP server owns; it links to `plugin/skills/formio-mcp-setup/references/project-urls.md`.

#### Scenario: URLs come from project_get

- **WHEN** CONFIG runs with the Form.io MCP tools callable
- **THEN** the generated `src/config.ts` carries the `projectUrl` and `baseUrl` that `project_get` reported for the workspace directory

#### Scenario: Existing config that disagrees with the tools stops the phase

- **WHEN** `src/config.ts` already exists and its URLs differ from what `project_get` reports
- **THEN** the skill names both pairs and where each came from, and asks which is correct before writing

### Requirement: Generated authentication uses the router, not a guard component

`AUTH.md` SHALL generate the authentication surface into the application, because `@formio/react` provides none — `FormioProvider` exposes `token`, `isAuthenticated`, and `logout` only, with no user object and no roles.

The generated surface SHALL be built from React Router primitives rather than from Angular's `FormioAuthService` shape:

- Public `/login` and `/register` routes rendering the planner's login and registration forms through `@formio/react`'s `Form` component, with the credential submit going to a route `action` that returns `redirect()` on success, plus a `/logout` route that clears the session and redirects — it renders no form.
- The current user loaded once in a **root route loader** and read by descendants with `useRouteLoaderData`, per the `formio-resource-kernel` capability.
- Protection applied by wrapping a route's loader with `requireUser`, so an unauthenticated navigation is redirected before the protected screen mounts.

`AUTH.md` SHALL NOT document a `useUser` hook that fetches after mount, an `isReady` flag, or a guard component that renders a redirect from an effect. Those shapes exist in Angular because its router has no data phase; reproducing them in React reintroduces a render pass in which a protected screen is briefly mounted for an anonymous visitor.

Role or group guards SHALL NOT be generated unless the user asks; the deployment enforces authorization server-side. The generated code SHALL NOT use `@formio/react`'s legacy Redux `modules/auth` surface.

#### Scenario: Protected navigation redirects before mount

- **WHEN** an anonymous visitor navigates to a protected resource route
- **THEN** the redirect to `/login` comes from the loader
- **AND** the protected screen does not mount
- **AND** `/login` and `/register` render without a redirect loop

#### Scenario: AUTH.md documents no mount-time user fetch

- **WHEN** `AUTH.md` is inspected
- **THEN** it documents a root loader for the current user
- **AND** it documents no `useUser` hook that fetches after mount and no `isReady` flag

#### Scenario: No role guard without an explicit request

- **WHEN** the planner's map defines roles and the user has not asked for client-side role gating
- **THEN** the generated protection checks authentication only

### Requirement: Project configuration is resolved before the first deployment-touching step

Before its first call that reads from or writes to a deployment, `formio-react` SHALL call the `project_get` MCP tool with `cwd` set to the user's working directory and branch on the returned `status` (`ok`, `not-configured`, `base-url-unresolved`), recording whatever value the report names with `project_set`. It SHALL NOT shell out to the CLI for this, SHALL NOT interview the user for URLs the report already carries, and SHALL relay a call that fails outright rather than interviewing around it.

The skill SHALL carry the library's standard preflight: when the Form.io tools are not callable, hand off to `formio-mcp-setup`; never work around missing tools with direct HTTP requests or a throwaway script. That ban covers build-time work only — the generated application is expected to call the Form.io REST API at runtime.

#### Scenario: Preflight defers to the first tool call

- **WHEN** `formio-react` activates and the user's request needs no deployment access yet
- **THEN** the skill proceeds with workspace inspection and file writes without opening on a setup message

#### Scenario: Missing tools hand off to setup

- **WHEN** the skill reaches a Form.io tool call and no such tool is callable
- **THEN** it loads `formio-mcp-setup` and offers no other remedy

### Requirement: Handoff contract with the resources sub-skill

`formio-react` SHALL load `./formio-react-resources/SKILL.md` by path as the last step of BOTH CRUD branches, and SHALL NOT attempt to invoke it by frontmatter name. The handoff payload SHALL use the same field names `formio-angular` uses, so `formio-application` needs no per-framework adaptation:

- `workspacePath`
- `templateMdPath` and `templateJsonPath`
- `userRequest` (extend path)
- `newResourceNames` (extend path)
- `frontendDesignStatus`

It SHALL additionally carry `branch` — `'greenfield'` or `'existing'` — plus, on the existing branch, what the inspection found: the app's design conventions, its authentication arrangement, and its current-user source.

URLs are deliberately absent from the payload, as they are for Angular: the sub-skill resolves them with `project_get` and reconciles against the workspace's own generated config, which for React is `src/config.ts`. `FRAMEWORK.md` names `src/app/config.ts` for Angular; that line SHALL be generalized to name each framework's equivalent rather than assuming Angular's path. The sub-skill generates different code for an application whose auth and layout it must integrate with than for one whose auth and layout the greenfield chain just wrote, and it cannot tell the two apart from `workspacePath` alone.

#### Scenario: Sub-skill is loaded by path

- **WHEN** either CRUD branch reaches its resources step
- **THEN** the parent reads `plugin/skills/formio-react/formio-react-resources/SKILL.md` from disk

#### Scenario: Branch travels with the payload

- **WHEN** the existing-application branch hands off
- **THEN** the payload names the branch and the inspection findings the sub-skill must integrate with

#### Scenario: Payload field names match the Angular contract

- **WHEN** `formio-application` hands off to either framework skill
- **THEN** the payload field names are identical across the two
