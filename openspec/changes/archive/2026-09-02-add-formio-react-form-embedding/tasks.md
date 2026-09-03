## 1. Sub-skill layout and trigger surface

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test in `packages/skill-tests/src/formio-react/form-sub-skill-layout.test.ts`: `plugin/skills/formio-react/formio-react-form/SKILL.md` exists, its frontmatter `name` is `formio-react-form`, and the containing directory has the same name
- [x] 1.2 Write failing test: `references/` contains `mounting.md`, `control.md`, `lifecycle.md`, `environments.md`, `provider.md`, and `styling.md`, each non-empty and frontmatter-free
- [x] 1.3 Write failing test: no `evals/` directory exists anywhere under `plugin/skills/formio-react/`
- [x] 1.4 Write failing test: the description is ≤ 1,024 characters, claims only React-named embed triggers, claims no unqualified embed phrasing, and its `Not for:` clause names `formio-form`, `formio-react-resources`, `formio-form-builder`, and `formio-sdk`
- [x] 1.5 Write failing test: `SKILL.md` states it is a nested sub-skill loaded by path, not a separately-registered top-level skill
- [x] 1.6 Write failing test: the spec describes user-visible routing as `formio-react` activating and dispatching, and no scenario anywhere depends on the sub-skill activating by itself

### Green

- [x] 1.7 Create the sub-skill directory, `SKILL.md` with conforming frontmatter, and the six reference stubs

### Refactor

- [x] 1.8 Review implementation and refactor as needed

## 2. Scope boundary — mounting here, behavior in formio-form

<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: no reference under `formio-react-form/` documents `calculateValue`, `validate.json`, component `logic`, conditional syntax, cascading selects, or the JSON Logic primer
- [x] 2.2 Write failing test: each of those topics is reachable from the sub-skill by a resolving relative link into `plugin/skills/formio-form/references/`
- [x] 2.3 Write failing test: `SKILL.md` states that a field-behavior question routes to `formio-form` rather than being answered locally

- [x] 2.4 Write failing test: `SKILL.md` names the form-management components in one line, states that this library documents no form-management guidance, and no reference documents their props or usage
- [x] 2.5 Write failing test: a request to list a resource's submissions routes to `formio-react-resources`

### Green

- [x] 2.6 Write the `SKILL.md` body: scope statement, routing rules, form-management out-of-scope note, standard library obligations

### Refactor

- [x] 2.7 Review implementation and refactor as needed

## 3. The Form component contract

<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write failing test: `mounting.md` states that `form` takes precedence over `src` when both are passed, and explains which side owns fetching in each case
- [x] 3.2 Write failing test: `mounting.md` documents `submission` pre-fill and states it is applied to the live instance rather than rebuilding it
- [x] 3.3 Write failing test: `mounting.md` documents `FormClass` for Wizard and PDF renderers, and marks `formioform` and `formReady` as deprecated aliases
- [x] 3.4 Write failing test: `control.md` documents the `on*` event props and names `otherEvents` as the escape hatch for unmapped events
- [x] 3.5 Write failing test: `control.md` documents capturing the instance from `onFormReady` in a ref, with a not-yet-ready guard, and warns against holding it in state

### Green

- [x] 3.6 Write `mounting.md`
- [x] 3.7 Write `control.md`

### Refactor

- [x] 3.8 Review implementation and refactor as needed

## 4. Lifecycle guidance and the wrapper stance

<!-- depends_on: 1 -->

### Red

- [x] 4.1 Write failing test: `lifecycle.md` puts actionable guidance first and labels the internals section as background rather than instructions
- [x] 4.2 Write failing test: it documents that a non-memoized `options` prop or callback recreates the instance every parent render, gives memoization or live-instance application as the remedy, and states this is a usage requirement rather than a library defect
- [x] 4.3 Write failing test: it states that changing `submission` is cheap because it is applied to the live instance behind an equality check
- [x] 4.4 Write failing test: it requires cloning form definitions reused across instances, because the renderer and builder mutate them in place
- [x] 4.5 Write failing test: each actionable item names a symptom, a cause, and a remedy
- [x] 4.6 Verify StrictMode behavior empirically: mount a form in a StrictMode application, record whether it renders once, twice, or vanishes, and capture the observation for the write-up
- [x] 4.7 Write failing test: `lifecycle.md` has a StrictMode section reporting observed behavior, noting it is development-only if it reproduces, and never presenting the predicted mechanism as a confirmed defect
- [x] 4.8 Write failing test: no guidance anywhere in the sub-skill offers removing StrictMode as a remedy, and `lifecycle.md` states that doing so hides the defect
- [x] 4.9 Write failing test: `mounting.md` presents `Form` as the default and offers no hand-rolled wrapper as an equivalent or simpler path
- [x] 4.10 Write failing test: where `mounting.md` carries an escape-hatch wrapper section, it lists the lifecycle, unmount-guard, definition-equality, and live-submission requirements and notes that `onFormReady` exposes the live instance

### Green

- [x] 4.11 Write `lifecycle.md` from the package source and the monorepo gotchas registry
- [x] 4.12 Add the wrapper stance, and any escape-hatch section, to `mounting.md`

### Refactor

- [x] 4.13 Review implementation and refactor as needed

## 5. Environments, provider, and styling

<!-- depends_on: 1 -->

### Red

- [x] 5.1 Write failing test: `environments.md` names `@vitejs/plugin-react` and shows it configured in `vite.config`
- [x] 5.2 Write failing test: `environments.md` states that marking a file a client component is not sufficient in Next.js, and shows the dynamic import with server-side rendering disabled
- [x] 5.3 Write failing test: `environments.md` states that Create React App and similar bundlers need no extra configuration
- [x] 5.4 Write failing test: `provider.md` documents `FormioProvider`, states `useFormioContext` throws outside a provider, and covers the auth state the context exposes
- [x] 5.5 Write failing test: `provider.md` sources URLs from `project_get`, hardcodes no example host, and links `formio-mcp-setup/references/project-urls.md` rather than restating the URL rules
- [x] 5.6 Write failing test: `provider.md` covers a custom `Formio` instance for multi-deployment applications and states that embedding without a provider is possible by configuring the SDK directly
- [x] 5.7 Write failing test: `provider.md` documents anonymous embedding as first-class — no token, Anonymous role needs create permission on the form — and generates no login flow for an embed request
- [x] 5.8 Write failing test: `provider.md` attributes a 401 on an anonymous submit to form submission access and routes to the access documentation rather than suggesting authentication
- [x] 5.9 Write failing test: `styling.md` states that the renderer ships no stylesheet, names the unstyled-form symptom and its cause, and lists the stylesheet options
- [x] 5.10 Write failing test: `styling.md` points at `Templates` and the template framework as the way to change emitted markup, covers per-instance versus global styling and scoping, and does not restate the parent skill's design-system guidance

### Green

- [x] 5.11 Write `environments.md`
- [x] 5.12 Write `provider.md`
- [x] 5.13 Write `styling.md`

### Refactor

- [x] 5.14 Review implementation and refactor as needed

## 6. Deprecated surfaces and security prose

<!-- depends_on: 2 -->

### Red

- [x] 6.1 Write failing test: `ReactComponent` is marked deprecated wherever it appears and new work is directed to a custom `@formio/js` component
- [x] 6.2 Write failing test: the replacement path is concrete — extend a `@formio/js` component class, register with `Formio.Components.addComponent` using the `Components` re-export, at module scope before any form renders — and the component-class API routes to `formio-sdk`
- [x] 6.3 Write failing test: no example in the sub-skill imports from the legacy Redux modules, and the singular-versus-plural hazard is documented
- [x] 6.4 Write failing test: the security section in `formio-react-form/SKILL.md` is byte-identical to `formio-form/SKILL.md`'s, and is not reduced to a cross-reference
- [x] 6.5 Write failing test: `SKILL.md` carries the library's preflight, no-raw-HTTP, `project_get`, and URL-terminology prose, and passes the existing `preflight-blocking-scope`, `build-time-vs-runtime`, `project-config-preflight`, and `url-terminology` suites
- [x] 6.6 Write failing test: `SKILL.md` routes a not-yet-existing form to `formio-form-builder`

### Green

- [x] 6.7 Add the deprecated-surface notes, the security section, and the standard library obligations to `SKILL.md`

### Refactor

- [x] 6.8 Review implementation and refactor as needed

## 7. formio-react dispatch row goes live

<!-- depends_on: 1 -->

### Red

- [x] 7.1 Write failing test: `formio-react/SKILL.md`'s dispatch table carries a live embed row naming `formio-react-form`, and no row anywhere in the file is marked reserved
- [x] 7.2 Write failing test: the archived requirement is named for what it says — the reserved-branch requirement is renamed rather than left with a header contradicting its body
- [x] 7.3 Write failing test: the embed branch chain excludes `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, `AUTH.md`, and `formio-react-resources`
- [x] 7.4 Write failing test: `SKILL.md` documents re-dispatching an embed request that turns out to want CRUD screens, and saying why the branch changed
- [x] 7.5 Write failing test: the `formio-react` description claims React-named embed triggers, still claims no unqualified embed phrasing, and fits the budget
- [x] 7.6 Write failing test: the greenfield and existing-application chains still document no standalone form embedding

### Green

- [x] 7.7 Update `formio-react/SKILL.md`'s dispatch table, embed-branch chain, re-dispatch rule, and description

### Refactor

- [x] 7.8 Review implementation and refactor as needed

## 8. formio-form host check and disambiguation

<!-- depends_on: 1 -->

### Red

- [x] 8.1 Write failing test: `formio-form/SKILL.md` documents a host check performed before mounting code is written, handing React workspaces to `formio-react`'s embed branch with a one-line reason
- [x] 8.2 Write failing test: the host check is bounded — it does not apply to definition-level questions, it is not a dispatch table with branch documents, and an undetectable host proceeds rather than asking
- [x] 8.3 Write failing test: the Angular branch of the check states that `@formio/angular` ships its own renderer component and that no Angular embedding skill exists yet, without presenting Vanilla JS as the recommended Angular approach
- [x] 8.4 Write failing test: the `formio-form` description's `Not for:` clause names `formio-react` and still fits the budget, and its trigger clause keeps its framework-agnostic phrasing
- [x] 8.5 Write failing test in `collision-guards.test.ts`: React-named embed phrasing routes to `formio-react` and unqualified embed phrasing routes to `formio-form`

### Green

- [x] 8.6 Add the host check to `formio-form/SKILL.md` and update its `Not for:` clause
- [x] 8.7 Add the collision-guard cases

### Refactor

- [x] 8.8 Review implementation and refactor as needed

## 9. Documentation and packaging

<!-- depends_on: 7, 8 -->

### Red

- [x] 9.1 Update the hard-coded skill counts this change breaks, on top of the values change 1 leaves: `preflight-blocking-scope.test.ts` and `no-install-commands-in-skills.test.ts` `gatedSkillMd()` 13 → 14, `project-config-preflight.test.ts` `allSkillMd()` 14 → 15 and `probingSkillMd()` 12 → 13
- [x] 9.2 Write failing test: the plugin manifests and README listings enumerate `formio-react-form` consistently
- [x] 9.3 Write failing test: `CLAUDE.md`'s skill count and skill-library prose match the shipped tree
- [x] 9.4 Write failing test: every relative link in the new and edited skill markdown resolves

### Green

- [x] 9.5 Update `CLAUDE.md`, `README.md`, `plugin/README.md`, and any manifest enumerating skills
- [x] 9.6 Run `pnpm test`, `pnpm lint`, and `pnpm format`, and fix fallout

### Refactor

- [x] 9.7 Review implementation and refactor as needed
