# BOOTSTRAP — install Angular skills and scaffold the workspace

This document is loaded by the parent `formio-angular` skill during Phase 2. It is **not** a standalone skill — no frontmatter, no independent trigger. The parent reads it after SETUP has been approved and before CONFIG.

## Why this phase exists

`formio-angular` does not know how to scaffold an Angular workspace on its own, and it should not try. The Angular team ships a maintained skill library at [`angular/skills`](https://github.com/angular/skills) that already encodes the current best practices for `ng new`, workspace layout, build configuration, and CLI options. The right move is to install that library the first time `formio-angular` runs, then delegate the actual workspace creation to the `angular-new-app` skill from it. `formio-angular` picks the story back up at CONFIG, where it writes the Form.io-specific files (`config.ts`, `AuthModule`, resource NgModules) into the workspace the Angular skill just created.

Doing it this way keeps the framework-agnostic `formio-application` → `formio-angular` (→ its nested `./resources/SKILL.md` sub-skill) chain focused on Form.io concerns, and leans on the Angular team's own skill for the Angular concerns.

BOOTSTRAP also installs the Form.io SDKs (`@formio/angular`, `@formio/js`) and the Bootstrap 5 + Bootstrap Icons stylesheets that the Form.io renderer's default template assumes. All four are pinned with caret ranges so ordinary `npm install` in the future picks up minor/patch releases automatically. Bootstrap can be opted out of by explicit user request; the Form.io SDK pair cannot — every downstream phase imports from them.

## When to skip this phase

Skip BOOTSTRAP if any of the following hold in the target working directory:

1. `angular.json` exists at the workspace root — an Angular workspace is already present. The user invoked `formio-angular` against an existing app; honor that and go straight to CONFIG.
2. `package.json` exists and lists `@angular/core` as a dependency — same as above, slightly different detection signal (monorepos sometimes relocate `angular.json`).
3. `formio-application` invoked you in handoff mode and its handoff context carries a `workspacePath` that already contains `angular.json` — trust the orchestrator's detection.

If any of those hit, tell the user in one sentence: "Angular workspace already present at `<path>` — skipping BOOTSTRAP, continuing to CONFIG." Do not re-run `npx skills add` on a workspace that already exists; it is not destructive but it is noise.

Otherwise, run BOOTSTRAP.

## Step 1 — resolve the target Angular version from `@formio/angular`

Before installing anything, determine which Angular major the **current latest** `@formio/angular` officially supports. The canonical source is the package's own `package.json` on unpkg at an **unpinned** URL — fetch:

```
https://unpkg.com/@formio/angular/package.json
```

unpkg resolves an unpinned package path to the latest published version automatically, so this URL always reflects whatever `@formio/angular` release is current. Do NOT hard-code a version (e.g., `@10.0.1`) into this URL; that would pin the skill to a stale release and defeat the point of fetching the file at runtime.

What to read from it:

1. **The resolved `@formio/angular` version.** The returned JSON has a top-level `"version"` field (e.g., `"10.0.1"`). Capture it as `FORMIO_ANGULAR_VERSION` — this is what you will install in Step 4 and cite in the approval summary.
2. **Highest supported Angular major.** Look under `peerDependencies` for `@angular/core`. The range typically lists several majors (e.g. `^17.0.0 || ^18.0.0 || … || ^N.0.0`). Take the **highest** major in that range — that is the newest Angular `@formio/angular` supports, and always the one to target. Capture it as `FORMIO_ANGULAR_SUPPORTED_MAJOR`. If `peerDependencies` is absent, fall back to `dependencies` for the same key; if neither is present, stop and tell the user — do NOT guess. (The goal is always the latest supported Angular — never an older major, and never a major newer than `@formio/angular` declares.)
3. **Latest patch within that major.** Query the npm registry for the newest published version of `@angular/core` in that major:

   ```bash
   npm view @angular/core@<major>.x.x version
   ```

   This prints the latest patch in that major. Capture the full `MAJOR.MINOR.PATCH` string as `FORMIO_ANGULAR_TARGET_VERSION` — the version you pin the new workspace to in Step 3.

Then do the same resolution for `@formio/js`, the core Form.io SDK that `@formio/angular` wraps. Fetch its unpinned `package.json` from unpkg:

```
https://unpkg.com/@formio/js/package.json
```

Read the top-level `"version"` field and capture it as `FORMIO_JS_VERSION` (e.g., `5.3.3`). You do NOT need to cross-check `@formio/js`'s own peer dependencies against Angular — `@formio/angular` already declares the compatible `@formio/js` range in its own `peerDependencies` / `dependencies`. If the latest `@formio/js` falls outside that range, fall back to the newest version inside the range named by `@formio/angular`'s `package.json`; if it is inside the range, use the latest.

Do the same for Bootstrap 5 and Bootstrap Icons, because the Form.io renderer defaults to its Bootstrap 5 template and without these stylesheets submission forms render unstyled. Fetch the unpinned `package.json` files from unpkg:

```
https://unpkg.com/bootstrap/package.json
https://unpkg.com/bootstrap-icons/package.json
```

Read the top-level `"version"` field from each and capture them as `BOOTSTRAP_VERSION` (e.g., `5.3.3`) and `BOOTSTRAP_ICONS_VERSION` (e.g., `1.11.3`). If unpkg returns a Bootstrap major other than `5`, stop and ask the user — Form.io's default template targets Bootstrap 5, and silently picking up Bootstrap 6+ would break the renderer. The user can opt in explicitly, but the default path stays on Bootstrap 5.

Stash the six results for later phases:

- `FORMIO_ANGULAR_VERSION` — the latest `@formio/angular`, resolved from unpkg
- `FORMIO_JS_VERSION` — the latest `@formio/js`, resolved from unpkg (constrained to `@formio/angular`'s declared range)
- `FORMIO_ANGULAR_SUPPORTED_MAJOR` — the highest Angular major in `@formio/angular`'s peer range
- `FORMIO_ANGULAR_TARGET_VERSION` — the latest `MAJOR.MINOR.PATCH` within that major
- `BOOTSTRAP_VERSION` — the latest Bootstrap (must be a Bootstrap 5 major)
- `BOOTSTRAP_ICONS_VERSION` — the latest Bootstrap Icons

If unpkg is unreachable (offline / proxied environment), fall back to `npm view @formio/angular version` / `npm view @formio/js version` / `npm view bootstrap@5 version` / `npm view bootstrap-icons version` + `npm view @formio/angular peerDependencies` to read the same fields from the npm registry directly. If the npm registry is also unreachable for `@angular/core@<major>.x.x`, fall back to the **highest version listed** in `@formio/angular`'s own `dependencies` for `@angular/core`, and tell the user you could not confirm a newer patch was available. Never silently pick a major the `@formio/angular` package has not declared support for.

**Opt-out:** if the user has explicitly said they do NOT want Bootstrap (e.g., "use Material", "skip Bootstrap", "I'll style it myself"), skip the two Bootstrap unpkg fetches above and set `BOOTSTRAP_VERSION` + `BOOTSTRAP_ICONS_VERSION` to `null`. Step 5 will then skip its install and `angular.json` edits entirely. The default stays on Bootstrap 5 because the Form.io renderer's default template is Bootstrap 5 and unstyled forms are a bad first impression — an override needs a real user signal.

## Step 2 — install the Angular skills library

Run this exactly once per session, before invoking `angular-new-app`:

```bash
npx skills add https://github.com/angular/skills --all -a claude-code -y
```

Notes:

- `--all` installs every skill in the Angular repo. We only need `angular-new-app` for scaffolding, but the Angular team ships related skills (e.g., component and service generators) that may be useful to the nested Resources sub-skill (`./resources/SKILL.md`) later. Installing everything up front is cheaper than re-invoking `npx skills add` per phase.
- `-a claude-code` registers the skills with the Claude Code agent so they become invokable by name from subsequent phases.
- `-y` accepts the default install location and any prompts the `skills` CLI emits.
- If `npx` is not on the user's `PATH`, surface the error verbatim — do not try to fall back to a manual install. The user almost certainly has Node.js installed (Angular requires it), and a missing `npx` means their toolchain is broken in a way that needs their attention before anything Angular-related will work.

If the command fails for any other reason (network outage, `skills` CLI not yet published, repository moved), stop BOOTSTRAP and report the exact error. Do not try to scaffold the workspace by hand with `ng new` — staying out of the Angular team's scaffolding path is the whole point of this phase.

## Step 3 — delegate to `angular-new-app`

Once the install succeeds, invoke the `angular-new-app` skill to create the Angular workspace in the current working directory. The skill is designed to handle its own interview — routing (yes/no), stylesheet choice (CSS/SCSS/etc.), strict mode, and anything else `ng new` accepts — so you do NOT re-ask those questions on its behalf.

What to pass to `angular-new-app`:

- **Working directory:** the absolute path where the workspace should be created. Usually the cwd, or the `workspacePath` from `formio-application`'s handoff context.
- **Project name (if asked):** offer a name derived from the Form.io `Project URL`'s subdomain if the user gave one (e.g., `https://foo.form.io` → `foo`). Otherwise let `angular-new-app` default to the directory name.
- **Angular version (critical):** pass the `FORMIO_ANGULAR_TARGET_VERSION` resolved in Step 1 — the latest patch of the highest Angular major `@formio/angular` supports. If `angular-new-app` exposes a version / CLI-version option, use it; if it shells out to `@angular/cli` and takes CLI flags, pass `@angular/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR>` so `npx` resolves the matching CLI major before running `ng new`. Always target the newest Angular `@formio/angular` supports; the only thing to avoid is an even-newer Angular major that `@formio/angular` has not yet declared, which would break `npm install` at Step 4.
- **Intent note:** "This workspace will be wired against `@formio/angular@<version>`, which supports Angular `<major>`. The Form.io integration (config, auth, resource NgModules) is generated in subsequent phases by `formio-angular` and its nested Resources sub-skill at `./resources/SKILL.md`." The Angular skill does not need this for correctness, but surfacing it keeps the flow transparent to the user watching the transcript.

Do not override `angular-new-app`'s approval gates — it runs its own, and layering a second one on top is confusing. When `angular-new-app` reports success and the workspace exists on disk, BOOTSTRAP is done.

## Step 4 — confirm the workspace is ready for CONFIG

Before advancing, verify all of the following exist:

- `<workspace>/angular.json`
- `<workspace>/src/app/app-module.ts`
- `<workspace>/package.json` with `@angular/core` present at the major resolved in Step 1
- `<workspace>/package.json` with `@formio/angular` pinned as `"^<FORMIO_ANGULAR_VERSION>"` and `@formio/js` pinned as `"^<FORMIO_JS_VERSION>"`

If any are missing, something went wrong inside `angular-new-app` or the follow-up install. Do not patch around it; stop BOOTSTRAP and ask the user whether they want to retry, switch to an existing workspace, or abort. If `@angular/core` in the generated `package.json` is a different major than `FORMIO_ANGULAR_SUPPORTED_MAJOR`, the `angular-new-app` invocation did not honor the version pin — stop and surface the mismatch before continuing. If the Form.io entries landed as exact pins or `~` ranges, rewrite them to `^` as described above and re-run `npm install`.

Also add `@formio/angular` and its peer SDK `@formio/js` to the workspace now so CONFIG can `import` from them without a follow-up install step. Install both in a single npm invocation, and use the caret (`^`) range prefix so the resulting `package.json` entries will auto-pick up future minor + patch releases within the same major without another bootstrap run:

```bash
npm install --save @formio/angular@^<FORMIO_ANGULAR_VERSION> @formio/js@^<FORMIO_JS_VERSION>
```

e.g., `npm install --save @formio/angular@^10.0.1 @formio/js@^5.3.3`. The resulting `package.json` must contain:

```json
{
  "dependencies": {
    "@formio/angular": "^10.0.1",
    "@formio/js": "^5.3.3"
  }
}
```

Run this from inside the workspace directory created by `angular-new-app`. The caret prefix matters — npm's default save-prefix writes `^` already, but do NOT override the user's `.npmrc` if they have configured `save-prefix=~` or `save-exact=true`; in that case, invoke `npm install --save --save-prefix='^' @formio/angular@^<FORMIO_ANGULAR_VERSION> @formio/js@^<FORMIO_JS_VERSION>` to force the `^` regardless. After the install, open the workspace's `package.json` and verify both entries read `"^<version>"` — if either one came out as an exact pin or a `~`, rewrite the line to the `^` form and re-run `npm install` so the lockfile matches.

## Step 5 — add Bootstrap 5 and Bootstrap Icons

Skip this step only if the user explicitly opted out in Step 1 (`BOOTSTRAP_VERSION === null`). Otherwise run it unconditionally — the Form.io renderer ships a Bootstrap 5 default template, and the forms the sub-skill generates assume Bootstrap 5 classes (`form-control`, `btn`, `row`, etc.) and `bi bi-*` icon classes are available globally.

Install both packages with the caret prefix so future minor + patch releases in the same major flow through without re-bootstrapping:

```bash
npm install --save bootstrap@^<BOOTSTRAP_VERSION> bootstrap-icons@^<BOOTSTRAP_ICONS_VERSION>
```

e.g., `npm install --save bootstrap@^5.3.3 bootstrap-icons@^1.11.3`. The resulting `package.json` must contain:

```json
{
  "dependencies": {
    "bootstrap": "^5.3.3",
    "bootstrap-icons": "^1.11.3"
  }
}
```

Then wire the stylesheets into `angular.json` so the Angular build pipeline bundles them. Open `<workspace>/angular.json`, find the first `projects.<projectName>.architect.build.options.styles` array (and repeat for the matching `test` target's `styles` array — usually immediately below `build`), and ensure these three entries appear **before** the workspace's own `src/styles.css` / `src/styles.scss` so application styles can override Bootstrap defaults:

```json
"styles": [
  "node_modules/bootstrap/dist/css/bootstrap.min.css",
  "node_modules/bootstrap-icons/font/bootstrap-icons.css",
  "src/styles.css"
]
```

Notes on why these exact paths:

- `bootstrap/dist/css/bootstrap.min.css` is the pre-compiled Bootstrap 5 CSS bundle; using the SCSS entry point (`bootstrap/scss/bootstrap`) would require an SCSS workspace, which the user may not have chosen in `angular-new-app`'s stylesheet interview. The compiled CSS works for both CSS and SCSS workspaces.
- `bootstrap-icons/font/bootstrap-icons.css` registers the `bi bi-*` class family and ships the webfont; this is the same entry point the Bootstrap Icons docs recommend for non-SCSS consumers.
- Neither stylesheet goes into `main.ts` or an `@import` in `styles.css` — the `angular.json` `styles` array is the Angular-native place to add workspace-wide stylesheets and is what `angular-new-app` expects.

Do NOT add Bootstrap's JavaScript bundle (`bootstrap.bundle.min.js` via `angular.json`'s `scripts` array). The Form.io renderer does not depend on Bootstrap's JS behaviors (dropdowns, modals, tooltips), and pulling the JS in would conflict with Angular's own DOM management. If a future resource module needs a Bootstrap JS feature, the Resources sub-skill (`./resources/SKILL.md`) can add it on a per-module basis.

After editing `angular.json`, re-run a clean `npm install` (or `ng build --configuration=development` as a smoke check) to confirm the new style paths resolve. If either path 404s, verify the package version in `node_modules` — a Bootstrap 5+ major always ships `dist/css/bootstrap.min.css`, and Bootstrap Icons always ships `font/bootstrap-icons.css`, so a 404 means the install did not land.

## Step 6 — pin zoneless change detection explicitly

A generated app must **pin its change-detection mode explicitly** rather than inherit whatever `angular-new-app` / the CLI happened to default to — that default has drifted across Angular releases, which would make generated apps non-deterministic. Because the skill always targets the latest Angular `@formio/angular` supports (Step 1), the app uses **zoneless** change detection. `@formio/angular` is change-detection-mode agnostic, so pinning zoneless is safe; pinning it *explicitly* is what makes the result deterministic.

### 6a. Wire zoneless

Add the provider to the generated `AppModule` `providers` array (alongside `provideBrowserGlobalErrorListeners()`):

```ts
// app-module.ts
import { provideZonelessChangeDetection } from '@angular/core';
// ...providers: [ provideZonelessChangeDetection(), ... ]
```

`zone.js` is not needed; leave the `angular.json` `polyfills` array empty on both `build` and `test` targets:

```json
"polyfills": []
```

For the `test` target, add `provideZonelessChangeDetection()` to the `TestBed.configureTestingModule({ providers: [...] })` of generated specs so unit tests run in the same mode.

### 6b. One Form.io-specific caveat

The Form.io SDK's promises (`loadSubmissions`, `loadForms`, …) resolve outside Angular's zone. Do not reach for `NgZone.run(...)` to refresh the view after them — it is a no-op under zoneless. Update state the standard zoneless way (a `signal()` write, or `ChangeDetectorRef.markForCheck()`). No other special handling is needed — `@formio/angular`'s own components already do this internally.

### 6c. Smoke-check

```bash
ng build --configuration=development
```

A clean build confirms the `polyfills` shape matches the builder and the CD provider import resolves. If the app logs `NG0908` / `Zone is not defined` at runtime, a dependency still expects `zone.js` — re-check that no generated code imports `zone.js` and that `provideZonelessChangeDetection()` is actually registered.

## Step 7 — confirm Claude's `frontend-design` skill is available

### Why this step exists

Every downstream phase in `formio-angular` that authors a user-facing surface (the AUTH phase's `app.component.html` nav chrome, the Resources phase's `resource.component.html` / `view/view.component.html` / per-resource SCSS, any custom login/register component override, any dashboard or landing template) should consult Claude's `frontend-design` plugin before writing output — that is how the generated UI ends up polished instead of generic. `frontend-design` is **strongly recommended but NOT required**. BOOTSTRAP only **detects** its availability and records the status; it does NOT run its own install prompt. The strong recommendation + install prompt is owned by the orchestrator `formio-application` (Step 6a) — keeping it in one place avoids two skills nagging the user about the same plugin.

### 7a. Detect whether `frontend-design` is available — match the namespaced name

`frontend-design` is a Claude Code **plugin** (from the `claude-plugins-official` marketplace), so it registers under the **plugin-namespaced** name `frontend-design:frontend-design`. The bare name `frontend-design` may also appear depending on how it was installed. Check the session's skill registry for **either** form and treat a match as "available". 

Do NOT only look for the bare `frontend-design` — that is the historical bug that made this step silently fail and the UI fall back to plain, unstyled Bootstrap.

### 7b. Honor the handoff status; do not run a competing install prompt

- **Invoked via `formio-application` handoff:** the orchestrator already ran its `frontend-design` pre-check (Step 6a) and passed `frontendDesignStatus`.
  - `frontendDesignStatus: 'available'` → consult `frontend-design` (with the brief from 7d) on every UI surface, as the Stance requires.
  - `frontendDesignStatus: 'declined'` → the user was already offered the plugin and chose to proceed without it. Do NOT re-prompt. Generate UI as best you can, but disclose on **every** UI approval gate (AUTH nav chrome, each Resources Phase A plan) that the file was generated **without** `frontend-design` consultation, so the user can review it critically.
- **Invoked directly (no handoff):** run the 7a detection yourself.
  - Available → consult it normally.
  - Missing → it is strongly recommended, not required. Surface a one-line strong recommendation that the user install it — interactively via `/plugin` (Browse → `claude-plugins-official` → `frontend-design` → Install) or by running `claude plugin install frontend-design@claude-plugins-official`, then restarting Claude Code so the plugin loads — and let them choose to install-then-resume or proceed without it. If they proceed without it, disclose on every later UI gate that the output was generated without `frontend-design`. Do NOT hard-block, and do NOT silently fall back to plain Bootstrap.

### 7c. Record the availability for the summary

Note in BOOTSTRAP's working context whether `frontend-design` is available, declined, or being recommended-pending, so the approval-gate summary can report it and later phases know whether to disclose.

### 7d. Record the Bootstrap-5 design brief for later phases

Once `frontend-design` is available, write (or update) a short design-brief block in the skill's working context that every later phase pastes into the `frontend-design` invocation verbatim. This keeps the brief consistent across AUTH's nav chrome, the Resources sub-skill's per-resource templates, and any future skill that also asks `frontend-design` for advice in this workspace. Stash the brief as `FRONTEND_DESIGN_BRIEF`:

```
## frontend-design brief — Bootstrap 5 Form.io Angular app

Stack (already wired, DO NOT change):
- Angular {{FORMIO_ANGULAR_SUPPORTED_MAJOR}} with NgModules + `standalone: false`.
- Bootstrap {{BOOTSTRAP_VERSION}} — CSS loaded via `angular.json` styles from
  `node_modules/bootstrap/dist/css/bootstrap.min.css`. NO Bootstrap JS bundle.
- Bootstrap Icons {{BOOTSTRAP_ICONS_VERSION}} — `bi bi-*` class family available globally.
- Form.io renderer mounts its own Bootstrap 5 markup for form fields (`form-control`,
  `form-select`, `form-label`, validation feedback) — do not restyle those.

Design constraints:
- Use Bootstrap 5 utility classes first: `container-fluid`, `row`, `col-*`, `g-*`,
  `d-flex`, `align-items-*`, `justify-content-*`, `gap-*`, margin/padding helpers
  (`m[t|b|s|e|x|y]-*`, `p[...]-*`), text helpers (`text-*`, `fs-*`, `fw-*`),
  color helpers (`bg-*`, `text-*`, `border-*`).
- Components to reach for: `card` / `card-body` / `card-header`, `btn` + variants,
  `nav` / `nav-tabs` / `nav-pills`, `navbar`, `list-group`, `badge`, `alert`,
  `table` / `table-hover`, `breadcrumb`, `dropdown`, `modal`-as-markup-only.
- Iconography: Bootstrap Icons only (`<i class="bi bi-...">`). No FontAwesome, no
  inline SVG unless the icon set genuinely lacks the needed glyph.
- Typography: Bootstrap defaults; use `fs-*` / `fw-*` / `lh-*` for adjustments.
  Do not introduce custom font-families.
- Spacing rhythm: Bootstrap's 0.25rem step (0, 1, 2, 3, 4, 5). Do not introduce
  a parallel spacing scale.
- Color: Bootstrap's CSS variables (`--bs-primary`, `--bs-secondary`, `--bs-success`,
  `--bs-danger`, `--bs-warning`, `--bs-info`, `--bs-light`, `--bs-dark`,
  `--bs-body-color`, `--bs-border-color`, `--bs-border-radius`). If the brand
  needs a different primary, override `--bs-primary` in `src/styles.scss` ONCE;
  do not hard-code hex codes per component.
- Responsive: Bootstrap's breakpoints (`sm` 576, `md` 768, `lg` 992, `xl` 1200, `xxl` 1400).
- Accessibility: proper `label for` on form controls (the renderer handles this for
  form fields — you handle it on any hand-rolled controls), visible focus rings
  (leave Bootstrap's defaults in place), `aria-label` on icon-only buttons.
- Anti-patterns to avoid: Tailwind utility names, `@apply`, CSS-in-JS, bespoke
  design tokens, Material Design components, custom CSS that duplicates what a
  Bootstrap utility already does.
- Angular constraints: `*ngIf` / `*ngFor` (NOT `@if` / `@for` standalone control flow),
  `[class.foo]="expr"` / `[ngClass]`, template-driven forms OR Angular Reactive
  Forms — whatever the surrounding component already uses — do NOT introduce a
  different forms approach partway through.

Output shape `frontend-design` should produce:
- A layout description in plain English referencing the Bootstrap 5 classes above.
- A minimal HTML skeleton using those classes (no Tailwind, no custom CSS framework).
- If custom SCSS is truly needed, the file content AND the one-line justification
  for why no Bootstrap utility covered the case.
```

Every later phase that invokes `frontend-design` prepends this brief to the prompt it passes. AUTH's `app.component.html` section references it (see `AUTH.md`'s nav-chrome section). The Resources sub-skill's Phase A plan cites the brief in its `frontend-design consulted:` line (see `resources/SKILL.md`). Keeping the brief in one place avoids drift: update BOOTSTRAP Step 7d once and every downstream phase picks up the new wording.

## The approval gate

BOOTSTRAP's approval gate is lightweight because the destructive work (creating files in the workspace) is gated inside `angular-new-app` itself. After Steps 1–7 succeed, print a one-block summary and pause for acknowledgement:

```
Bootstrap complete
  @formio/angular version:  <FORMIO_ANGULAR_VERSION>      (source of truth)
  @formio/js version:       <FORMIO_JS_VERSION>
  Supported Angular major:  <FORMIO_ANGULAR_SUPPORTED_MAJOR>
  Angular pinned to:        <FORMIO_ANGULAR_TARGET_VERSION>  (latest patch in major)
  Bootstrap version:        <BOOTSTRAP_VERSION>              (or "skipped — user opted out")
  Bootstrap Icons version:  <BOOTSTRAP_ICONS_VERSION>        (or "skipped — user opted out")
  Angular skills installed: <path reported by npx>
  Workspace:                <absolute workspace path>
  Key files:                angular.json, src/app/app-module.ts
  package.json entries:
    "@formio/angular":  "^<FORMIO_ANGULAR_VERSION>"
    "@formio/js":       "^<FORMIO_JS_VERSION>"
    "bootstrap":        "^<BOOTSTRAP_VERSION>"
    "bootstrap-icons":  "^<BOOTSTRAP_ICONS_VERSION>"
  zone.js:                  present in node_modules + registered in angular.json polyfills
  frontend-design plugin:   available in session (strongly recommended; will be consulted on every UI surface)
                            -- or "not installed — proceeding without it; UI gates will disclose this" if the user declined
  angular.json styles (prepended to project build target):
    node_modules/bootstrap/dist/css/bootstrap.min.css
    node_modules/bootstrap-icons/font/bootstrap-icons.css

Continuing to CONFIG — I'll generate src/app/config.ts and wire it into AppModule. Proceed?
```

If the user declines, stop. They may want to inspect the freshly-scaffolded workspace before any Form.io-specific code lands in it.
