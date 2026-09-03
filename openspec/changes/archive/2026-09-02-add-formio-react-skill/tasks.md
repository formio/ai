## 1. Parent skill layout and trigger surface

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test in `packages/skill-tests/src/formio-react/skill-layout.test.ts`: `plugin/skills/formio-react/` contains `SKILL.md`, `SETUP.md`, `BOOTSTRAP.md`, `EXISTING.md`, `CONFIG.md`, and `AUTH.md`, all non-empty
- [x] 1.2 Write failing test: the five sibling documents contain no YAML frontmatter block
- [x] 1.3 Write failing test: `formio-react/SKILL.md` frontmatter `name` is `formio-react` and its description, whitespace-normalized, is ≤ 1,024 characters
- [x] 1.4 Write failing test: the description contains the greenfield AND existing-application React-explicit triggers, claims no embed-a-form trigger, and contains none of the banned generic build-an-app phrases or bare domain archetypes
- [x] 1.5 Write failing test: the description's `Not for:` clause names `formio-application`, `formio-resource-planner`, `formio-form`, and `formio-angular`
- [x] 1.6 Write failing test: `.claude/skills/formio-react` is a symlink resolving to `plugin/skills/formio-react`

### Green

- [x] 1.7 Create `plugin/skills/formio-react/SKILL.md` with conforming frontmatter and the three-clause description
- [x] 1.8 Create the five sibling documents as headed stubs with no frontmatter, to be filled by groups 2–5
- [x] 1.9 Add the `.claude/skills/formio-react` symlink

### Refactor

- [x] 1.10 Review implementation and refactor as needed

## 2. Parent skill body — phases, stack, preflight

<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: `SKILL.md` carries a branch dispatch table with a greenfield row, an existing-application row, and an embed row marked reserved, each naming its document chain
- [x] 2.2 Write failing test: `SKILL.md` requires a one-round branch question when the request is ambiguous, and requires surfacing a workspace state that contradicts the stated branch
- [x] 2.3 Write failing test: `SKILL.md` stays a router — the greenfield bootstrap steps and the existing-application inspection steps are not inlined into it
- [x] 2.4 Write failing test: the greenfield chain documents five phases in order (SETUP, BOOTSTRAP, CONFIG, AUTH, Resources), each loaded by path
- [x] 2.5 Write failing test: each greenfield phase ends with a user-approval gate, and a declined gate stops the flow without writing partial state
- [x] 2.6 Write failing test: `SKILL.md` states that `formio-react` never runs the planner and never imports, and asks the user to invoke `formio-application` when a direct invocation has no approved `template.json`
- [x] 2.7 Write failing test: `SKILL.md` documents when to reset to an earlier phase and what triggers a reset
- [x] 2.8 Write failing test: `SKILL.md` routes an embed request to `formio-form` and discloses that its guidance covers the Vanilla JS renderer, and neither CRUD chain documents standalone form embedding
- [x] 2.9 Write failing test: `SKILL.md` states Next.js App Router is out of scope
- [x] 2.10 Write failing test: `SKILL.md` carries the library's MCP preflight prose — first-tool-call timing, handoff to `formio-mcp-setup`, and the no-raw-HTTP ban scoped to build time — and passes the existing `preflight-blocking-scope` and `build-time-vs-runtime` suites
- [x] 2.11 Write failing test: `SKILL.md` documents `project_get` with `cwd` and branches on `ok` / `not-configured` / `base-url-unresolved`, and shells out for none of it (`project-config-preflight.test.ts` sweeps every `SKILL.md`, so it needs no edit beyond its arity count)
- [x] 2.12 Write failing test: `BOOTSTRAP.md` names Vite, React Router `createBrowserRouter`, TypeScript, and pins the dependency set including `@formio/react` and `@formio/js`
- [x] 2.13 Write failing test: `BOOTSTRAP.md` states the generated application is client-rendered, and `SKILL.md` lists server-rendered React Router framework mode alongside Next.js as out of scope
- [x] 2.14 Write failing test: `BOOTSTRAP.md` installs and imports a renderer stylesheet and states it is separate from the application's design language
- [x] 2.15 Write failing test: `BOOTSTRAP.md` leaves StrictMode enabled and states that removing it is not a remedy for a misbehaving screen
- [x] 2.16 Write failing test: every markdown file under `plugin/skills/formio-react/` passes `url-terminology.test.ts` (it auto-discovers, so that suite needs no edit). The no-hard-wrap rule is a `CLAUDE.md` convention with no detector — check it in review rather than asserting a test that does not exist

### Green

- [x] 2.17 Write the `SKILL.md` body: dispatch table, branch selection, shared preflight, project-configuration resolution, handoff contract including `branch` and inspection findings
- [x] 2.18 Write `SETUP.md` — workspace determination and project-URL resolution
- [x] 2.19 Write `BOOTSTRAP.md` — Vite workspace creation, dependency install, version capture, `FRONTEND_DESIGN_BRIEF` stash (greenfield branch only)

### Refactor

- [x] 2.20 Review implementation and refactor as needed

## 3. CONFIG phase — FormioProvider wiring

<!-- depends_on: 2 -->

### Red

- [x] 3.1 Write failing test: `CONFIG.md` documents generating `src/config.ts` and mounting `FormioProvider` with `projectUrl` and `baseUrl`
- [x] 3.2 Write failing test: `CONFIG.md` sources both URLs from `project_get` (or the user when tools are absent), hardcodes no example host, and links to `formio-mcp-setup/references/project-urls.md` rather than restating the rules
- [x] 3.3 Write failing test: `CONFIG.md` documents the disagreement branch — an existing `src/config.ts` whose URLs differ from `project_get` stops and asks

### Green

- [x] 3.4 Write `CONFIG.md`

### Refactor

- [x] 3.5 Review implementation and refactor as needed

## 4. AUTH phase — router-native authentication

<!-- depends_on: 2 -->

### Red

- [x] 4.1 Write failing test: `AUTH.md` documents public `/login`, `/register`, `/logout` routes rendering the planner's forms through `@formio/react`'s `Form`, with the submit handled by a route `action` returning `redirect()`
- [x] 4.2 Write failing test: `AUTH.md` loads the current user in a root route loader and reads it downstream with `useRouteLoaderData`
- [x] 4.3 Write failing test: `AUTH.md` documents `requireUser(loader)` protection and states the protected screen never mounts for an anonymous navigation
- [x] 4.4 Write failing test: `AUTH.md` documents no `useUser` hook that fetches after mount, no `isReady` flag, and no guard component that redirects from an effect
- [x] 4.5 Write failing test: `AUTH.md` defaults protection to authentication-only, generates role or group checks only on explicit request, and references no Redux or `modules/auth` import

### Green

- [x] 4.6 Write `AUTH.md` with the auth routes, root-loader user, and `requireUser`

### Refactor

- [x] 4.7 Review implementation and refactor as needed

## 5. Existing-application branch

<!-- depends_on: 2 -->

### Red

- [x] 5.1 Write failing test: `EXISTING.md` defines the inspection — router style, installed `@formio/react` and `@formio/js` versions, renderer stylesheet, `FormioProvider` state, existing auth and current-user source, design conventions — and requires reporting before any modification
- [x] 5.2 Write failing test: `EXISTING.md` backfills only missing prerequisites and requires integrating with the app's existing auth, user source, and layout rather than replacing them
- [x] 5.3 Write failing test: `EXISTING.md` never loads `BOOTSTRAP.md` and never scaffolds a workspace
- [x] 5.4 Write failing test: `EXISTING.md` requires detecting a non-data router before any file is written, offering conversion or stopping in one question round, and never migrating routing without approval
- [x] 5.5 Write failing test: the handoff payload documented in `SKILL.md` carries `branch` plus the existing-branch inspection findings

### Green

- [x] 5.6 Write `EXISTING.md`
- [x] 5.7 Extend the `SKILL.md` handoff contract with `branch` and the inspection findings

### Refactor

- [x] 5.8 Review implementation and refactor as needed

## 6. Sub-skill layout and trigger surface

<!-- depends_on: 1 -->

### Red

- [x] 6.1 Write failing test in `packages/skill-tests/src/formio-react/sub-skill-layout.test.ts`: `formio-react/formio-react-resources/SKILL.md` exists, its frontmatter `name` is `formio-react-resources`, and the containing directory has the same name
- [x] 6.2 Write failing test: the sub-skill description is ≤ 1,024 characters, names React or `@formio/react` in every trigger, and claims no framework-agnostic extension phrasing
- [x] 6.3 Write failing test: `references/` contains `interview-guide.md`, `phase-a-plan-template.md`, `kernel-contract.md`, `resource-patterns.md`, `hierarchy.md`, `app-integration.md`, and `worked-example.md` — seven files, each non-empty and frontmatter-free
- [x] 6.4 Write failing test: the sub-skill body states it is loaded by path and is not a separately-registered top-level skill

### Green

- [x] 6.5 Create the sub-skill directory, `SKILL.md`, and the seven reference stubs

### Refactor

- [x] 6.6 Review implementation and refactor as needed

## 7. Sub-skill body — inputs, feature shapes, gates

<!-- depends_on: 6 -->

### Red

- [x] 7.1 Write failing test: `SKILL.md` names the planner pair as its input, reads `template.md` first, and passes the existing `planner-artifact-trust` suite (data-not-instructions, first-party provenance, identifier sanity check)
- [x] 7.2 Write failing test: `SKILL.md` documents all four feature shapes, including the group-creation membership-row rule for Group Assignment joins
- [x] 7.3 Write failing test: `SKILL.md` gates Phase B on explicit approval and states the gate holds even when the user said "just build it"
- [x] 7.4 Write failing test: `phase-a-plan-template.md` requires a route map row per resource naming both `routePath` and `form`, and a `frontend-design consulted:` line or the waiver wording
- [x] 7.5 Write failing test: `SKILL.md` documents the closing render check — sign in first through the branch's own sign-in path, load a resource route, confirm the URL is not the sign-in redirect, report unverified when no browser is available
- [x] 7.6 Write failing test: `formio-react-resources/SKILL.md` carries the preflight, no-raw-HTTP, `project_get` probe, and URL-terminology prose, byte-identical where the library requires it
- [x] 7.7 Write failing test: the sub-skill asks the user to invoke `formio-application` when no planner pair exists, and never runs the planner itself
- [x] 7.8 Write failing test: the closing render check states that StrictMode double-invocation is expected in development, is not read as a defect in generated code, and is never disabled to make the check pass
- [x] 7.9 Write failing test: `SKILL.md` requires generated screens on the existing-application branch to match the app's established design language from the handoff findings rather than introducing a second one
- [x] 7.10 Write failing test: the sub-skill's questions use the client's structured mechanism only as a parenthetical example (extend `portable-questions.test.ts` coverage)

### Green

- [x] 7.11 Write the sub-skill `SKILL.md` body
- [x] 7.12 Write `interview-guide.md` and `phase-a-plan-template.md`

### Refactor

- [x] 7.13 Review implementation and refactor as needed

## 8. Kernel contract documentation

<!-- depends_on: 6 -->

### Red

- [x] 8.1 Write failing test: `kernel-contract.md` carries the Angular-construct-to-router-primitive table and states that the service, registry, alert bus, and refresh emitter are deliberately not built
- [x] 8.2 Write failing test: `kernel-contract.md` specifies the pure functions — `applyParentContext`, `parentFilters`, `resourcePermissions`, `resourceUrls`, `preserveDraftState` — and requires them to import neither `react` nor `react-router`
- [x] 8.3 Write failing test: `kernel-contract.md` specifies `applyParentContext` as non-mutating, setting `hidden: true` and `clearOnHide: false` and returning submission defaults at the resolved component path
- [x] 8.4 Write failing test: `kernel-contract.md` specifies the loader and action factories, and states that permissions are computed in the item loader rather than in a hook
- [x] 8.5 Write failing test: `kernel-contract.md` states loaders take URLs by importing the generated `src/config.ts` and construct a `Formio` per request, reading neither React context nor SDK globals
- [x] 8.6 Write failing test: `kernel-contract.md` makes the loader the only list-screen data owner, forbids composing `SubmissionTable`, and puts pagination in route search params
- [x] 8.7 Write failing test: `kernel-contract.md` requires the renderer to receive loader-supplied form JSON via the `form` prop, not a `src` URL
- [x] 8.8 Write failing test: `kernel-contract.md` specifies the config as `{ routePath, param, form, parents }`, requires a distinct param per resource derived from its name, forbids a bare `:id`, and documents that no registry key exists
- [x] 8.9 Write failing test: `kernel-contract.md` specifies ancestor bindings as `{ resource, field, filter }` with `resource` a direct config-object reference, and states that ancestor ids come from `params[parent.resource.param]` because loaders run in parallel
- [x] 8.10 Write failing test: `kernel-contract.md` requires the filter key to use the reference component's resolved data path rather than its `key`, and requires a missing reference component to be a hard error rather than an unfiltered query
- [x] 8.11 Write failing test: `kernel-contract.md` requires create to pre-fill the whole ancestor submission object and edit to verify rather than overwrite the stored ancestor
- [x] 8.12 Write failing test: `kernel-contract.md` specifies the `currentUser` binding for author-stamping and my-records filtering
- [x] 8.13 Write failing test: `kernel-contract.md` specifies `resourceRoutes` output — list, `new`, and item layout with view and edit children, each with its loader/action and an `errorElement` — and array composition for nesting at any depth
- [x] 8.14 Write failing test: `kernel-contract.md` requires child screens to render inside the parent item layout's `<Outlet />`, the item layout to link its child resources, and a breadcrumb built from the declared ancestor chain
- [x] 8.15 Write failing test: `kernel-contract.md` specifies delete as a `useFetcher` submit to the item action with a dialog, and forbids a `delete` route
- [x] 8.16 Write failing test: `kernel-contract.md` forbids a global `Formio.clearCache()` on unmount and documents revalidation plus per-request `ignoreCache` instead
- [x] 8.17 Write failing test: `kernel-contract.md` forbids Redux and third-party data-fetching libraries, and requires per-resource files to import only from the kernel index

### Green

- [x] 8.18 Write `kernel-contract.md`
- [x] 8.19 Write `resource-patterns.md` with the concrete generated code for each pattern — pure functions, loader/action factories, route assembly
- [x] 8.20 Write `hierarchy.md` — the `/customer/:customerId/quote/:quoteId` walk-through: param derivation, ancestor bindings, composing route arrays at depth, filtered child list, pre-filled create screen, breadcrumbs, current-user binding, and the data-model precondition
- [x] 8.21 Write `app-integration.md` — `createBrowserRouter` assembly, root loader, `requireUser` wiring, list-screen composition over `SubmissionTable`, error boundaries

### Refactor

- [x] 8.22 Review implementation and refactor as needed

## 9. Worked example and reference-integrity

<!-- depends_on: 7, 8 -->

### Red

- [x] 9.1 Write failing test: `worked-example.md` walks one domain from planner input through the Phase A plan to representative generated files, and its hierarchy is at least three levels deep
- [x] 9.2 Write failing test: `hierarchy.md` documents param naming, ancestor bindings, depth composition, filtering, pre-fill, and breadcrumbs
- [x] 9.3 Write failing test: the sub-skill stops and reports when a child's form in `template.json` carries no reference component for a requested parent
- [x] 9.4 Write failing test: every relative link in the new skill's markdown resolves (extend `cross-reference-integrity.test.ts` coverage)
- [x] 9.5 Write failing test: shared prose blocks copied from `formio-angular` stay byte-identical where the `shared-prose-stays-identical` suite requires it, and diverge only where React genuinely differs

### Green

- [x] 9.6 Write `worked-example.md` and fix any link or shared-prose failures

### Refactor

- [x] 9.7 Review implementation and refactor as needed

## 10. FRAMEWORK.md registry row and routing

<!-- depends_on: 1 -->

### Red

- [x] 10.1 Write failing test: `FRAMEWORK.md`'s registry table has a React row with entry skill `formio-react`, extend sub-skill `formio-react-resources`, and the detection signal "`react` in `package.json` AND no `angular.json`"
- [x] 10.2 Write failing test: the registry table has a `Default` column, exactly one row carries `yes`, and that row is Angular
- [x] 10.3 Write failing test: `FRAMEWORK.md` documents the multi-row build-new question round with per-framework option descriptions naming what each generates, and the default row presented first and labelled as the default
- [x] 10.4 Write failing test: `FRAMEWORK.md` states that the default resolves the question only when the user declines to choose, that it is not a licence to skip asking, and that the chosen framework is stated when the default resolves it
- [x] 10.5 Write failing test: `FRAMEWORK.md` scopes the preference question to build-new and states that modify-existing detects rather than asks
- [x] 10.6 Write failing test: `FRAMEWORK.md` documents the double-match branch — a workspace with both `angular.json` and a `react` dependency asks the user rather than resolving by signal order
- [x] 10.7 Write failing test: the `formio-application` description's `Not for:` clauses name `formio-react` and `formio-react-resources` and still fit the 1,024-character budget
- [x] 10.8 Write failing test: `FRAMEWORK.md` still contains no client-specific install or reload command, and the framework question names the client's structured mechanism only as a parenthetical example

### Green

- [x] 10.9 Write failing test: `FRAMEWORK.md`'s "How to add a new framework" worked example names Vue, and the file carries no React detection signal other than the registry row's
- [x] 10.10 Write failing test: each row's detection signal tests only for its own framework, so a workspace with both frameworks genuinely multi-matches
- [x] 10.11 Write failing test: the extend-payload note names each framework's own generated config path rather than assuming Angular's `src/app/config.ts`
- [x] 10.12 Add the React row and the `Default` column to `FRAMEWORK.md`, retire the React how-to-add example in favour of Vue, and generalize the config-path note
- [x] 10.13 Write the build-new framework-question branch: one round, default row first and labelled, decline-to-choose falls through to Angular with the choice stated, build-new only
- [x] 10.14 Add the double-match branch to `FRAMEWORK.md`
- [x] 10.15 Update the `formio-application` description's `Not for:` clauses within budget

### Refactor

- [x] 10.16 Review implementation and refactor as needed

## 11. Eval harness

<!-- depends_on: 7, 8 -->

### Red

- [x] 11.1 Write failing test in `packages/skill-tests/src/shipped-surface/eval-harness-location.test.ts`: `packages/skill-tests/evals/formio-react-resources/` contains `evals.json`, `grade.py`, and `README.md`, and `fixtures/` holds a seed React workspace
- [x] 11.2 Write failing test: no `evals/` directory exists anywhere under `plugin/skills/formio-react/`
- [x] 11.3 Write failing test: `grade.py` resolves the repository root from its own depth and defaults its artifacts directory to `.eval-artifacts/formio-react-resources/`

### Green

- [x] 11.4 Create the harness directory with `evals.json` covering a simple resource, a two-level hierarchy, a three-level hierarchy, a bidirectional join, and an extend run
- [x] 11.5 Add grader assertions for the hierarchy evals: distinct params per level, filter query on the resolved component path, ancestor pre-fill on the create screen, and route composition at depth
- [x] 11.6 Write `grade.py` with the structural assertions and correct root resolution
- [x] 11.7 Write the harness `README.md` runbook and seed the `fixtures/` React workspace

### Refactor

- [x] 11.8 Review implementation and refactor as needed

## 12. Documentation and packaging

<!-- depends_on: 10, 11 -->

### Red

- [x] 12.1 Update the four hard-coded skill counts the new skills break: `preflight-blocking-scope.test.ts` `gatedSkillMd()` 11 → 13, `no-install-commands-in-skills.test.ts` `gatedSkillMd()` 11 → 13, `project-config-preflight.test.ts` `allSkillMd()` 12 → 14 and `probingSkillMd()` 10 → 12
- [x] 12.2 Write failing test: the plugin manifests and README listings enumerate the new skills — a NEW assertion, not an extension of `generated-mirrors.test.ts` (untracked mirror dirs) or `readme-install-routes.test.ts` (install commands)
- [x] 12.3 Write failing test: `formio-react` and `formio-react-resources` do not claim each other's triggers, in `collision-guards.test.ts`
- [x] 12.4 Write failing test: the kernel-divergence report and the phase-reset rule each have a covering assertion
- [x] 12.5 Write failing test: `CLAUDE.md`'s harness list names `packages/skill-tests/evals/formio-react-resources/` and its skill count matches the shipped tree

### Green

- [x] 12.6 Update `CLAUDE.md`, `README.md`, `plugin/README.md`, and any manifest enumerating skills
- [x] 12.7 Run `pnpm test`, `pnpm lint`, and `pnpm format`, and fix fallout

### Refactor

- [x] 12.8 Review implementation and refactor as needed
