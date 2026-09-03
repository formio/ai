# BOOTSTRAP — create the workspace

Greenfield branch only. The existing-application branch never loads this document; it inspects instead, per [`EXISTING.md`](./EXISTING.md).

## 1. Create the workspace

A **Vite + React + TypeScript** workspace, created with the Vite React TypeScript template in the workspace root captured during SETUP.

## 2. Match the workspace's package manager

**Detect it before installing anything.** Read `packageManager` in `package.json` first, then look for a lockfile: `yarn.lock` → Yarn, `pnpm-lock.yaml` → pnpm, `bun.lock` or `bun.lockb` → Bun, `package-lock.json` → npm. `packageManager` wins over any lockfile, and when more than one lockfile is present the first hit in that order wins — `package-lock.json` is checked last because it is the one a stray `npm install` leaves behind in a workspace that belongs to another tool. Default to npm only when the workspace has none of them, and use that one package manager for every install, script and dependency query for the rest of the session.

**Never introduce a second lockfile.** Running `npm install` in a Yarn or pnpm workspace writes a competing lockfile and a parallel `node_modules`, and the user's own commands keep resolving against the tree you did not build. Nothing warns you: the app you build and test passes, and it is not the app they run.

**Then run the project's own dev script once, before reporting the phase complete.** This is the step that catches what a successful install hides. npm hoists every transitive dependency to the top of `node_modules`, so a package that requires something it never declared resolves anyway. Yarn PnP and pnpm's isolated linker do not hoist, and they fail on exactly those imports. A workspace that installs and builds under npm can still fail on the user's first command:

```
[RESOLVE_ERROR] Could not resolve '<transitive>' in <some package>
<package> tried to access <transitive>, but it isn't declared in its dependencies
```

That error names a packaging defect in the dependency, not a mistake in the generated app. Report it as such, and fix it upstream where you can. Where you cannot, the workspace-local escape hatch belongs to the user's package manager — Yarn's `packageExtensions`, pnpm's `dependenciesMeta` / hoisting settings — and it is a stopgap to remove once the dependency declares what it uses, never a step to apply by default.

## 3. Install the dependency set

Pin what you install and record the resolved versions:

- `@formio/react` — the React renderer wrapper. Capture the resolved version as `FORMIO_REACT_VERSION`.
- `@formio/js` — the renderer core. Capture the resolved version as `FORMIO_JS_VERSION`.
- `react-router` — routing, used through its **data-router** API.
- `bootstrap` — the Bootstrap 5 stylesheet the renderer's default template is classed for. See step 4.

Both captured labels name resolved npm versions. They are not URLs and not environment variables.

## 4. Import BOTH renderer stylesheets

A rendered form needs **two** stylesheets, and missing either one produces a form that looks broken rather than one that errors — which sends people to debug mounting instead of styling.

1. **A Bootstrap 5 stylesheet.** The renderer's default template emits Bootstrap-classed markup (`form-control`, `btn`, `col-*`) and does not supply those rules.
2. **`@formio/js/dist/formio.form.css` — the renderer's own stylesheet.** `@formio/js` DOES ship CSS, in `dist/`, and Bootstrap does not substitute for it. It carries ~73 `.formio-*` selectors — datagrid, wizard navigation, file upload, signature, collapse icons, `.formio-errors` — plus every `.choices*` rule the `choicesjs` widget needs. Bootstrap contains none of them. Omit it and each reference select renders as an unstyled list, which is the single most visible symptom because reference selects are how the planner models every relationship.

Import both once at the application entry point, in this order, with the application's own stylesheet last so its overrides win:

```ts
import 'bootstrap/dist/css/bootstrap.min.css'
import '@formio/js/dist/formio.form.css'
import './<app>.css'
```

`dist/*` is exported by `@formio/js`, so that specifier resolves under npm, Yarn PnP and pnpm alike. Pick `formio.form.css` for an app that renders forms; `formio.full.css` is the same plus the form **builder**, so use it only when the app embeds `FormBuilder`, and `formio.builder.css` only for a builder-only surface.

**Verify it landed rather than assuming.** After the first build, confirm a `.formio-component` and a `.choices__list` rule are present in the emitted CSS bundle. A missing stylesheet is invisible in a build log.

This is a **separate decision from the application's design language**. These stylesheets make rendered forms legible; the design language governs the screens you generate around them. Do not conflate them, and do not skip them because a design system is already present.

## 5. Client-rendered, with the data-router API

Route through `createBrowserRouter` with `RouteObject` arrays. The generated resources depend on loaders, actions, `errorElement`, and post-action revalidation.

The generated application is **client-rendered**. Server-rendered React Router framework mode is out of scope: its loaders run on the server, and `@formio/js` is DOM-only, so a loader feeding a server-rendered form screen cannot work. Next.js App Router is out of scope for the same reason.

## 6. Leave StrictMode enabled

Vite's React template enables StrictMode, and it stays enabled. It double-invokes effects in development, which is a deliberate check that surfaces lifecycle bugs — including in the form renderer's asynchronous instance creation.

**Removing StrictMode is not a remedy for a misbehaving screen.** It is the fix a reader reaches for, and it trades a visible development symptom for the same defect hidden in production. If a generated screen misbehaves under it, find the cause.

## 7. Stash the design brief

Stash a `FRONTEND_DESIGN_BRIEF` describing the chosen design language, for the resources sub-skill to prepend when it consults `frontend-design`.

The brief's normative content is the requirement set in [`formio-angular/BOOTSTRAP.md`](../formio-angular/BOOTSTRAP.md) Step 7d: a page shell that owns horizontal gutters and max content width so no screen adds its own page padding, one spacing rhythm, one color source, accessible focus and labels, no parallel token system, and a standing instruction not to restyle the renderer's own field markup. That document writes those requirements in Angular and Bootstrap 5 vocabulary because that is what it installs — keep the requirements verbatim and substitute this stack's own vocabulary, with the shell wrapping `<Outlet />` rather than `<router-outlet>`.

**When `frontendDesignStatus` is `'declined'`**, the orchestrator already offered `frontend-design` and the user chose to proceed without it. The brief is then the design direction itself rather than a prompt prefix: apply it inline, do NOT re-prompt for the skill, and disclose on every later UI approval gate that the output was generated without `frontend-design` consultation so the user can review it critically. That is the `frontend-design consulted: waived` line in `formio-react-resources`' Phase A plan.

## Gate

End with the approval gate: the created workspace, the package manager used, the installed versions, both renderer stylesheets (confirmed present in the built CSS), and the design brief. Proceed only on approval.
