## Purpose

Defines the `formio-react-form` sub-skill: the React embedding implementor nested under `formio-react` — its layout and reference set, its React-named trigger surface, the `Form` component contract, the control and lifecycle guidance it owns, the build environments, provider configuration, styling, and deprecated surfaces it covers, and the definition-level behavior it leaves to `formio-form`.
## Requirements
### Requirement: Sub-skill layout

The library SHALL provide `formio-react-form` at `plugin/skills/formio-react/formio-react-form/`, containing `SKILL.md` with frontmatter `name: formio-react-form` and a `references/` directory holding at least:

- `mounting.md` — rendering a form with the `Form` component: source precedence, pre-fill, options, custom form classes
- `control.md` — the event surface, the instance escape hatch, and reading and writing submission data from React
- `lifecycle.md` — what a reader must do to embed correctly, then the create/destroy internals as background
- `environments.md` — Vite, Next.js, and other build-environment requirements
- `provider.md` — `FormioProvider`, `useFormioContext`, URL sourcing, anonymous versus authenticated embedding, and multi-deployment setups
- `styling.md` — making a rendered form look right: the renderer stylesheet, template frameworks, and scoping

The directory name SHALL equal the declared `name`. Reference documents carry no frontmatter and are loaded by path. `SKILL.md` SHALL state that it is a nested sub-skill loaded by path, not a separately-registered top-level skill.

No eval harness is required for this sub-skill; it generates no artifact to grade. Should one be added later, it SHALL live at `packages/skill-tests/evals/formio-react-form/` per `shipped-surface-boundary`, never under `plugin/skills/`.

#### Scenario: Sub-skill files exist

- **WHEN** the repository is inspected after the change is applied
- **THEN** `plugin/skills/formio-react/formio-react-form/SKILL.md` exists with frontmatter `name: formio-react-form`
- **AND** each named reference exists and is non-empty
- **AND** no `evals/` directory exists under `plugin/skills/formio-react/formio-react-form/`

### Requirement: Trigger surface claims React-named embedding only

The `formio-react-form` `SKILL.md` `description` SHALL follow the three-clause template and claim ONLY embed triggers that name React or `@formio/react`. Example triggers it MUST claim include: "embed a Form.io form in React", "render a form in my React app", "use `@formio/react`'s `Form` component", "add a Form.io form to this React page".

It MUST NOT claim framework-agnostic embed phrasing — "embed a form", "render a form", "add this form to my page" — which stays with `formio-form`. Its `Not for:` clause MUST name `formio-form` (framework-agnostic embedding, and all field-behavior questions), `formio-react-resources` (resource CRUD screens rather than one embedded form), `formio-form-builder` (creating a form that does not exist yet), and `formio-sdk` (the raw SDK reference).

The description MUST fit the 1,024-character budget.

**The description governs discovery, not activation.** This sub-skill is loaded by path from `formio-react`'s embed branch; a nested skill is not separately registered in every client, so nothing should be specified as depending on it activating by itself. Its description exists so that clients which discover skills by recursive directory scan classify it correctly, and so its boundary with `formio-form` is written down. Requirements elsewhere SHALL describe the user-visible routing as `formio-react` activating and dispatching.

#### Scenario: React-named embed phrasing routes here

- **WHEN** the user says "embed this form in my React app" or names `@formio/react`'s `Form` component
- **THEN** `formio-react` activates and dispatches to its embed branch, which loads this sub-skill by path
- **AND** `formio-form` does not activate

#### Scenario: Unqualified embed phrasing does not route here

- **WHEN** the user says "embed this form on my page" with no framework named
- **THEN** `formio-react-form` does not activate on the phrasing alone

#### Scenario: Description fits the budget and names its siblings

- **WHEN** the frontmatter is inspected
- **THEN** the description is at most 1,024 characters
- **AND** its `Not for:` clause names `formio-form`, `formio-react-resources`, `formio-form-builder`, and `formio-sdk`

### Requirement: Scope is mounting and wiring; behavior stays in formio-form

This sub-skill SHALL cover only what differs because the host is React: mounting a form, controlling the instance, the lifecycle contract, provider configuration, and build-environment requirements.

Everything that lives in the **form definition** SHALL remain owned by `formio-form` and be reached by link, never restated: conditionals, `calculateValue`, `validate.json`, component `logic` arrays, external data sources and cascading selects, wizard page logic, and the JSON Logic primer. That content is identical whatever renders the form, and a second copy is a copy that drifts.

When a user's React embedding question turns out to be a definition question — "how do I hide this field when that one is empty", inside a React app — the sub-skill SHALL answer by routing to the relevant `formio-form` reference rather than by explaining it locally.

#### Scenario: Definition behavior is linked, not restated

- **WHEN** the sub-skill's references are inspected
- **THEN** none of them documents `calculateValue`, `validate.json`, component `logic`, conditional syntax, cascading selects, or the JSON Logic primer
- **AND** each is reachable by a link to the corresponding `formio-form` reference

#### Scenario: A field-behavior question inside React routes out

- **WHEN** the user asks how to make one field depend on another in their React-embedded form
- **THEN** the answer routes to `formio-form`'s conditionals reference

### Requirement: The Form component contract

`mounting.md` SHALL document the `Form` component as the entry point, covering:

- **Source.** `src` is the required prop and accepts either a URL string or a definition object; `url` sets the instance URL when the source is an object. Passing a definition means the application owns fetching; passing a URL means the renderer fetches. `form` is a legacy alias for an object `src` — at runtime it takes precedence when both are passed, but the prop types declare `src` required and `form` optional, so `<Form form={json} />` alone fails to type-check in the strict TypeScript workspace every generated application uses. Examples SHALL pass the definition through `src`.
- **Pre-fill.** `submission` populates an existing submission. It is applied to the live instance behind an equality guard rather than by rebuilding, so changing it is cheap.
- **The embed is display-agnostic.** A form built as a wizard or PDF in the portal renders as one through the same `Form` usage; the definition carries its `display` and the renderer picks its class from it, so nothing on the React side selects it. What `mounting.md` SHALL document for wizards is the one thing that IS React-specific — the application driving the wizard's flow from its own UI: hiding the built-in navigation through `buttonSettings`, tracking the page through the `onNextPage` / `onPrevPage` props, and calling `nextPage()` / `prevPage()` / `setPage()` / `submit()` on the instance held from `onFormReady`. The page API and events themselves SHALL be linked to `formio-form`'s wizards reference rather than restated. `FormClass` (deprecated alias `formioform`) substitutes a custom renderer subclass and is documented as such.
- **Presentation props.** `className` and `style` apply to the container element the component renders.

`SKILL.md` and the references SHALL use the current prop names and mark the aliases as deprecated: `FormClass` over `formioform`, and `onFormReady` over `formReady`.

#### Scenario: Source precedence is documented

- **WHEN** `mounting.md` is read
- **THEN** it states that `src` is required and accepts a URL or a definition, and that `form` is a legacy alias that does not type-check alone
- **AND** it explains which side owns fetching in each case

#### Scenario: Wizard guidance covers flow control, not display selection

- **WHEN** `mounting.md` documents wizards
- **THEN** it states the embed is agnostic to a form's display
- **AND** it shows the application driving the wizard through `buttonSettings`, `onNextPage` / `onPrevPage`, and the instance's page methods
- **AND** it links the page API to `formio-form`'s wizards reference rather than restating it

#### Scenario: Deprecated aliases are marked

- **WHEN** the references name `formioform` or `formReady`
- **THEN** each is identified as a deprecated alias of its current equivalent

### Requirement: Controlling the form from React

`control.md` SHALL document the two ways a React application drives an embedded form:

- **Events as props.** The component maps the renderer's `formio.*` events onto `on*` props — including `onChange`, `onSubmit`, `onSubmitDone`, `onSubmitError`, `onNextPage`, `onPrevPage`, `onCustomEvent`, `onFormLoad`, `onRender`, `onError`, `onSaveDraft`, `onRestoreDraft`, and the rest — and exposes an `otherEvents` map keyed by raw event name for anything not mapped. The reference SHALL name `otherEvents` as the documented escape hatch rather than leaving unmapped events undiscoverable.
- **The instance escape hatch.** `onFormReady` hands back the live `Webform` instance. Holding it in a ref is how an application reaches imperative renderer APIs — `getComponent('firstName')?.setValue(...)`, `submit()`, validation state — that have no prop equivalent.

The reference SHALL show the ref pattern, including the guard for the instance not being ready yet, and SHALL state that storing the instance in React state rather than a ref causes a render on every form load.

#### Scenario: Both control paths are documented

- **WHEN** `control.md` is read
- **THEN** it documents event props and the `otherEvents` map
- **AND** it documents capturing the instance from `onFormReady` in a ref, with a not-yet-ready guard

### Requirement: Lifecycle content is ordered by what the reader can act on

`lifecycle.md` SHALL separate what an embedding developer must do from what explains the component's internals. Mixing them buries the one-line fix a reader needs under implementation rationale they do not.

**Part one — what you must do.** These change the code a reader writes:

- **Memoize anything in the create path.** Instance creation is keyed on the form source, the constructor, the ready callback, `options`, and `url`. An `options={{}}` written inline, or an unmemoized callback, changes identity on every parent render and destroys and recreates the entire form. The remedy is `useMemo` / `useCallback`, or applying the change to the live instance instead. This is the single most common way an embedded form misbehaves, and it is a usage requirement rather than a library defect — every effect-based renderer has it.
- **Changing `submission` is cheap; rely on that.** Submission updates are applied to the live instance behind an equality check rather than triggering recreation. A reader who assumes otherwise writes contortions to avoid updating it. State the behavior so they do not.
- **Clone form definitions you reuse.** The renderer and builder mutate definitions in place, so a module-level default definition handed to more than one instance — or to one instance across a redraw — is a shared mutable reference. Clone per instance.

**Part two — why the component looks like this.** Marked plainly as background, needed for debugging or for evaluating a hand-rolled alternative, not for ordinary embedding:

- The component guards instance creation against unmount, because creation is asynchronous and a component can unmount while a form is mid-build.
- `submission` is deliberately excluded from the create dependencies; it has its own effect with an equality guard.

Each item in part one SHALL be written as symptom, cause, and remedy, since a reader arrives holding the symptom. Part two SHALL NOT be written as advice.

#### Scenario: Actionable guidance comes first and is marked as such

- **WHEN** `lifecycle.md` is read
- **THEN** the memoization, submission-cost, and clone-your-definitions items appear before the internals section
- **AND** the internals section is labelled as background rather than as instructions

#### Scenario: The memoization trap is documented with its remedy

- **WHEN** `lifecycle.md` is read
- **THEN** it states that an inline `options` object recreates the instance on every parent render
- **AND** it gives memoization or live-instance application as the remedy
- **AND** it states this is a usage requirement, not a library defect

#### Scenario: Each actionable item is symptom, cause, remedy

- **WHEN** each item in part one is inspected
- **THEN** it names the observable symptom, the cause, and the fix

### Requirement: StrictMode behavior is verified and documented

React StrictMode double-invokes effects in development: mount, cleanup, remount. Vite's React template enables it by default, so most React applications — including every one the parent skill's bootstrap phase generates — run it in development.

That interacts with asynchronous instance creation in a specific way worth checking rather than assuming. The component's liveness guard tests `isMounted` after the instance resolves, and a StrictMode remount sets that flag back to true before the first instance finishes, so the guard can pass for an instance whose mount has already been torn down — leaving two creates in flight against the same preserved DOM node. That is the redraw-race shape the builder component solves with an in-flight ref and the form component does not carry.

**Before writing this section, the behavior SHALL be verified empirically** against a real application with StrictMode enabled — mount a form, observe whether it renders once, and check for a duplicate or vanishing form. `lifecycle.md` SHALL then document what was actually observed, not what this requirement predicts. If the behavior is clean, the section SHALL say so plainly and briefly, so a reader who suspects StrictMode can rule it out. If it reproduces, the section SHALL record the symptom, that it is development-only, and that the correct response is to report it upstream.

**Removing StrictMode SHALL NOT be offered as a remedy.** It is the fix a reader reaches for, and it trades a visible development symptom for the same defect hidden in production, while giving up the double-invocation check that surfaces other lifecycle bugs. The sub-skill SHALL say this explicitly rather than leaving it to inference.

#### Scenario: The section reports observed behavior

- **WHEN** `lifecycle.md`'s StrictMode section is written
- **THEN** it states what was observed in a real StrictMode application
- **AND** it does not present the predicted mechanism as a confirmed defect

#### Scenario: Disabling StrictMode is refused as a remedy

- **WHEN** a reader reports a form rendering twice in development
- **THEN** the guidance does not suggest removing StrictMode
- **AND** it states that doing so hides the defect rather than fixing it

#### Scenario: Clean behavior is still documented

- **WHEN** verification finds no StrictMode problem
- **THEN** `lifecycle.md` says so, so a reader can rule it out

### Requirement: `Form` is the documented default; hand-rolled wrappers are an escape hatch

The sub-skill SHALL document `@formio/react`'s `Form` component as the way to embed a form in React, and SHALL NOT present a hand-rolled wrapper around `Formio.createForm` as an equivalent or simpler alternative. A wrapper must re-implement the instance lifecycle, the unmount guard, the definition equality guard, and live-instance submission application to be correct — the same problems, without the fixes that already ship.

`mounting.md` MAY carry a short escape-hatch section for readers who genuinely cannot take the dependency or who need the form mounted outside React's tree. Where it does, it SHALL state the correctness requirements such a wrapper must satisfy — create, await ready, destroy on unmount; guard against resolving after unmount; guard the definition by equality before rebuilding; apply submission changes to the live instance rather than as an effect dependency — and SHALL state that `onFormReady` already exposes the live `Webform` instance, so almost no renderer capability requires bypassing the component.

#### Scenario: The component is the documented default

- **WHEN** `mounting.md` is read
- **THEN** `Form` is presented as the way to embed
- **AND** no hand-rolled wrapper is offered as a simpler or equivalent path

#### Scenario: An escape-hatch section carries its correctness requirements

- **WHEN** `mounting.md` includes a hand-rolled wrapper section
- **THEN** it lists the lifecycle, unmount-guard, definition-equality, and live-submission requirements
- **AND** it notes that `onFormReady` exposes the live instance

### Requirement: Build-environment requirements

`environments.md` SHALL document the two environments that need setup beyond installing the package:

- **Vite** requires `@vitejs/plugin-react` installed and configured in `vite.config`, particularly on React 18 and 19.
- **Next.js** requires importing the component dynamically with server-side rendering disabled, because `@formio/js` depends on `window` and other browser globals. The reference SHALL state that marking the file a client component is **not** sufficient on its own, since that is the assumption most readers arrive with, and SHALL show the dynamic import.

The reference SHALL note that Create React App and similar bundlers need no extra configuration, so a reader does not go looking for it.

#### Scenario: Vite configuration is documented

- **WHEN** `environments.md` is read
- **THEN** it names `@vitejs/plugin-react` and shows it configured

#### Scenario: The Next.js client-component misconception is addressed

- **WHEN** `environments.md` is read
- **THEN** it states that a client component alone does not avoid the server-rendering problem
- **AND** it shows the dynamic import with server-side rendering disabled

### Requirement: Provider configuration and URL sourcing

`provider.md` SHALL document `FormioProvider` as the place the SDK's Base URL and Project URL are set, `useFormioContext` as the accessor (which throws outside a provider), and the auth state the context exposes — the token, whether a user is authenticated, and logout.

The URLs written into an application SHALL come from the `project_get` MCP tool when the Form.io tools are callable, and from the user when they are not. They SHALL NOT be hardcoded from an example host, composed by appending a project name to a deployment URL, or carried over from another project. The reference SHALL link `formio-mcp-setup/references/project-urls.md` rather than restating the URL rules.

The reference SHALL cover supplying a custom `Formio` instance for applications talking to more than one deployment, and SHALL state that a form can be embedded without a provider by configuring the SDK directly — while recommending the provider, since the auth state is what the rest of an application usually needs.

#### Scenario: URLs come from project_get

- **WHEN** the sub-skill writes provider configuration into an application
- **THEN** the URLs are those `project_get` reported for the workspace
- **AND** no example host appears in the generated code

#### Scenario: Provider requirement is stated precisely

- **WHEN** `provider.md` is read
- **THEN** it states that `useFormioContext` throws outside a provider
- **AND** it states that embedding without a provider is possible by configuring the SDK directly

### Requirement: Anonymous and authenticated embedding are both documented

The most common embed is a **public form** — a contact or intake form filled in by someone who is not logged in — and it is not the case the provider's auth state describes. `provider.md` SHALL document both paths and SHALL make the anonymous one first-class rather than treating authentication as a precondition of embedding:

- **Anonymous.** No token is attached, and whether the submission succeeds is decided server-side by the form's submission access: the Anonymous role needs create permission on that form. A 401 on submit from a public form is an access configuration problem, not a client one, and the reference SHALL say so and route to `formio-api` or the planner's access model rather than restating the permission shapes. The provider is still worth mounting, because it is what sets the SDK's URLs.
- **Authenticated.** The SDK attaches the current session's token automatically once a user is logged in, so an embedded form inherits it with no extra wiring. The reference SHALL note that submissions then carry an owner, which is what makes per-user access rules work.

`provider.md` SHALL NOT imply that embedding requires a logged-in user, and SHALL NOT generate a login flow for an embed request — that is application scope, and the CRUD branches own it.

#### Scenario: Public form embedding needs no login

- **WHEN** the user embeds a public form for anonymous visitors
- **THEN** the guidance produces no login flow and no token wiring
- **AND** it states that the Anonymous role needs create permission on the form

#### Scenario: A 401 on a public submit is diagnosed as access configuration

- **WHEN** an anonymous submission is rejected
- **THEN** the reference attributes it to form submission access and routes to the access documentation
- **AND** it does not suggest authenticating the visitor as the fix

### Requirement: Styling is documented, because an unstyled form reads as broken

A rendered form needs TWO stylesheets, and they are not interchangeable. `@formio/js` DOES ship CSS, at `@formio/js/dist/formio.form.css`, carrying the `.formio-*` selectors and the `.choices*` rules the `choicesjs` widget needs; Bootstrap contains none of them. The renderer also emits Bootstrap-classed markup (`form-control`, `btn`, `col-*`) that its own sheet does not define, so a Bootstrap 5 stylesheet is needed alongside it. An application that renders a form without both gets an unstyled, visually broken form — the first thing a reader hits and the symptom most likely to be misread as a rendering failure.

`styling.md` SHALL cover:

- That both stylesheets are required — `@formio/js/dist/formio.form.css` unconditionally, plus a Bootstrap-class source — and, for the second, the options: importing Bootstrap, supplying the application's own CSS against the renderer's class names, or a template framework.
- `Templates`, re-exported from `@formio/react`, and setting the active template framework — the supported way to change the markup the renderer emits rather than fighting it with overrides.
- Applying styling per instance through renderer options, versus globally.
- Scoping, so form styles do not leak into an application with its own design system, and the application's styles do not break the renderer's layout.
- The symptom-first framing: "the form renders but looks broken" means a missing stylesheet, not a mis-mounted component.

It SHALL NOT restate the design-system guidance the parent skill's bootstrap phase owns; a rendered form's stylesheet and an application's design language are different decisions, and the reference SHALL say which is which.

#### Scenario: The stylesheet requirement is stated up front

- **WHEN** `styling.md` is read
- **THEN** it states that a rendered form needs both `@formio/js/dist/formio.form.css` and a Bootstrap 5 stylesheet, and that neither substitutes for the other
- **AND** it names the unstyled-form symptom and its cause

#### Scenario: Template frameworks are the documented way to change markup

- **WHEN** a reader wants different markup from the renderer
- **THEN** the reference points at `Templates` and the template framework rather than at CSS overrides alone

### Requirement: Custom components are a renderer concern, registered through `Formio.use`

A custom form component is written once against `@formio/js` — a class extending one of the renderer's component classes — and then works in every host. There is no React-specific way to author one. The sub-skill SHALL say so, SHALL NOT document the component-class API itself (that is `formio-sdk`'s and the renderer's), and SHALL document only what IS React-specific: where registration goes.

Registration SHALL be shown through `Formio.use({ components: { <type>: <Class> } })`, at module scope in a module imported once from the application entry point, before any form renders. The sub-skill SHALL state that registering inside a component body or an effect re-registers on every mount, and SHALL note that `Formio.use` is the same call the Vanilla JS path uses, so one registration serves every host.

The sub-skill SHALL NOT mention `ReactComponent`. It is deprecated, and naming it — even as something to migrate away from — puts it in front of readers who would otherwise never encounter it. The library documents only the surfaces that are actively supported.

#### Scenario: Custom components route to the renderer

- **WHEN** the sub-skill is asked how to build a custom component for a React application
- **THEN** it explains the component is authored against `@formio/js`, routes the class API to `formio-sdk`, and shows registration through `Formio.use` at module scope

#### Scenario: ReactComponent is absent

- **WHEN** every file under `plugin/skills/formio-react/` is searched
- **THEN** the string `ReactComponent` appears nowhere

### Requirement: Legacy surfaces are not used

The sub-skill SHALL NOT use the legacy Redux modules — `auth`, `form`, `forms`, `submission`, `submissions` — which predate the current surface and are not wired to `FormioProvider`. Where a reader may meet them in existing code, it SHALL warn that the singular and plural modules are different slices — entity CRUD versus list state — that read almost identically and fail silently when confused. It SHALL use the current prop names and mark `formioform` and `formReady` as deprecated aliases.

#### Scenario: Redux modules are not used

- **WHEN** the sub-skill's examples are inspected
- **THEN** none imports from the legacy Redux modules

### Requirement: Form-management components are out of scope and named as such

`@formio/react` ships components beyond `Form` — `FormBuilder` and `FormEdit` for embedding the form builder and its settings surface, `FormGrid` for listing forms, `SubmissionTable` for listing submissions, and `Report`. Building a form-management application out of them is a different job from embedding a form, and this library documents no guidance for it.

`SKILL.md` SHALL state that plainly: name the components in one line so a reader who encounters them knows what they are, and say that no skill in this library covers building a form-management UI with them. It SHALL NOT document their props, patterns, or usage, and SHALL NOT improvise guidance when asked — an agent with no coverage should say so rather than invent it.

`SubmissionTable` is the one exception worth routing: a reader reaching for it to list a resource's records wants `formio-react-resources`, which composes it as its list screen.

#### Scenario: Form-management components are named without being documented

- **WHEN** `SKILL.md` is read
- **THEN** it names the builder, form-list, submission-list, and report components in one line
- **AND** it states that this library documents no form-management guidance
- **AND** no reference documents their props or usage patterns

#### Scenario: Resource list work routes to the CRUD sub-skill

- **WHEN** a reader asks how to list a resource's submissions
- **THEN** the answer routes to `formio-react-resources`

### Requirement: Security prose is carried, not summarized

A form definition is executable code: `calculateValue`, `validate.custom`, `logic` actions, HTML component bodies, and select templates are evaluated by the renderer in the page's JavaScript context. That risk does not change because the host is React.

`SKILL.md` SHALL carry the same security section `formio-form` carries — render only definitions from a project you control, the meaning of `fetch.authenticate` and `fetch.forwardHeaders`, not widening the HTML sanitizer to allow script execution, and treating submitted `data.*` as untrusted in the application's own code — with the prose kept identical to `formio-form`'s copy so the two cannot drift. It SHALL NOT be condensed to a cross-reference: a reader embedding in React may never open `formio-form`.

#### Scenario: Security section is present and identical

- **WHEN** `formio-react-form/SKILL.md` and `formio-form/SKILL.md` security sections are compared
- **THEN** the prose is identical
- **AND** neither is reduced to a link to the other

### Requirement: Standard library obligations

`SKILL.md` SHALL carry the library's shared obligations in their canonical wording: the MCP preflight checked at the first tool call rather than at activation, handoff to `formio-mcp-setup` when the tools are absent, the ban on working around missing tools with direct HTTP requests scoped to build-time work, project resolution through `project_get` with `cwd`, and the strict URL terminology in which `projectUrl` and `baseUrl` name values rather than environment variables.

It SHALL route to `formio-form-builder` when the form to embed does not exist yet, matching the behavior `formio-form` already specifies.

#### Scenario: Preflight defers to the first tool call

- **WHEN** the sub-skill is loaded for a question needing no deployment access
- **THEN** it answers without opening on a setup message

#### Scenario: A nonexistent form routes to the builder

- **WHEN** the form the user wants to embed is not in the project
- **THEN** the sub-skill routes to `formio-form-builder`, and embedding resumes with the saved form URL
