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
2. **Supported Angular major.** Look under `peerDependencies` for an entry like `@angular/core`. The range (e.g., `^18.0.0`, `>=18 <19`, `~18.2.0`) names the supported major — in this example, Angular `18`. If `peerDependencies` is absent or ambiguous, fall back to `dependencies` for the same key. If neither is present, stop and tell the user — do NOT guess.
3. **Latest patch within that major.** Query the npm registry for the newest published version of `@angular/core` that matches the supported major. The simplest way is:

   ```bash
   npm view @angular/core@<major>.x.x version
   ```

   e.g., `npm view @angular/core@18.x.x version` prints the latest `18.*.*` release (something like `18.2.13`). Capture that full `MAJOR.MINOR.PATCH` string — that is the version you will pin the new workspace to in Step 3.

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

- `FORMIO_ANGULAR_VERSION` — e.g., `10.0.1` (resolved latest from unpkg)
- `FORMIO_JS_VERSION` — e.g., `5.3.3` (resolved latest from unpkg, constrained to `@formio/angular`'s declared range)
- `FORMIO_ANGULAR_SUPPORTED_MAJOR` — e.g., `18`
- `FORMIO_ANGULAR_TARGET_VERSION` — e.g., `18.2.13`
- `BOOTSTRAP_VERSION` — e.g., `5.3.3` (must be a Bootstrap 5 major)
- `BOOTSTRAP_ICONS_VERSION` — e.g., `1.11.3`

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
- **Angular version (critical):** pass the `FORMIO_ANGULAR_TARGET_VERSION` resolved in Step 1 (e.g., `18.2.13`). This pins the generated workspace to the exact Angular major `@formio/angular` supports at its latest patch. If `angular-new-app` exposes a version / CLI-version option, use it; if it shells out to `@angular/cli` and takes CLI flags, pass `@angular/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR>` so `npx` resolves the matching CLI major before running `ng new`. Do NOT let the skill default to "latest" — a newer Angular major than `@formio/angular` declares support for will break `npm install` at Step 4.
- **Intent note:** "This workspace will be wired against `@formio/angular@<version>`, which supports Angular `<major>`. The Form.io integration (config, auth, resource NgModules) is generated in subsequent phases by `formio-angular` and its nested Resources sub-skill at `./resources/SKILL.md`." The Angular skill does not need this for correctness, but surfacing it keeps the flow transparent to the user watching the transcript.

Do not override `angular-new-app`'s approval gates — it runs its own, and layering a second one on top is confusing. When `angular-new-app` reports success and the workspace exists on disk, BOOTSTRAP is done.

## Step 4 — confirm the workspace is ready for CONFIG

Before advancing, verify all of the following exist:

- `<workspace>/angular.json`
- `<workspace>/src/app/app.module.ts`
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

## Step 6 — ensure `zone.js` is registered as a polyfill

Angular's change-detection machinery depends on Zone.js. Older `@angular/cli` versions preconfigured it automatically; newer versions (and certain `angular-new-app` flag combinations such as zoneless or `--no-zone`) can omit it. When it is missing at runtime, the application boots with errors like `Zone is not defined` or `NG0908: In this configuration Angular requires Zone.js`, which is what the Form.io integration will hit if we do not guard against it here.

Because `@formio/angular` relies on the default zone-based change-detection model, BOOTSTRAP must guarantee the Zone.js polyfill is present — regardless of what `angular-new-app` decided.

### 6a. Verify the package is installed

Zone.js ships as a peer / transitive dependency of Angular and should already be present in `node_modules/zone.js`. Confirm with:

```bash
npm ls zone.js
```

If the output shows `zone.js` missing (empty / not-installed), install it explicitly, using the caret range so patch updates flow through automatically:

```bash
npm install --save zone.js@^<ZONE_JS_VERSION>
```

Resolve `ZONE_JS_VERSION` the same way Step 1 resolves the other versions — fetch `https://unpkg.com/zone.js/package.json` and read its top-level `version` field. Fall back to `npm view zone.js version` if unpkg is unreachable. Do NOT hard-code a version in the skill.

### 6b. Register the polyfill in `angular.json`

Open `<workspace>/angular.json` and find the same `projects.<projectName>.architect.build.options` block you edited for styles. There are two accepted shapes depending on the Angular major `angular-new-app` generated:

**Shape A — `polyfills` is an array (Angular 15+ / application builder):**

```json
"polyfills": [
  "zone.js"
]
```

If the array is already present and includes `zone.js`, leave it alone. If the array exists but does NOT include `"zone.js"`, add the entry (keep any existing entries — e.g., `@angular/localize/init`). If the `polyfills` key is missing entirely, add the array with `"zone.js"` as its first entry.

**Shape B — `polyfills` is a string pointing at `src/polyfills.ts` (older Angular majors):**

```json
"polyfills": "src/polyfills.ts"
```

In this shape, open `<workspace>/src/polyfills.ts` and make sure it contains the side-effect import:

```ts
import 'zone.js';
```

If the file does not exist (`angular-new-app` generated Shape A instead), prefer Shape A above — do NOT create a parallel `src/polyfills.ts` just to satisfy an older convention. Match whatever the generated workspace uses.

Apply the same edit to the `test` target's `polyfills` entry (it lives immediately below `build` in most generated configs). Unit tests run in the same zone-based model as the app; skipping the test-target edit produces identical `Zone is not defined` failures in `ng test`.

### 6c. Smoke-check that the polyfill resolves

After editing, run:

```bash
ng build --configuration=development
```

A clean build confirms both that `zone.js` is resolvable in `node_modules` and that the `polyfills` entry shape you wrote matches what the builder expects. If the build errors with `Module not found: zone.js` or `Cannot find module 'zone.js'`, the install in 6a did not land — re-run it. If the build succeeds but the running app still logs `Zone is not defined`, the edit to `angular.json` hit the wrong project / target pair; open `angular.json` again and confirm the `defaultProject` (or the project the user is running) points at the same block you edited.

## Step 7 — confirm Claude's `frontend-design` skill is available

### Why this step exists

Every downstream phase in `formio-angular` that authors a user-facing surface (the AUTH phase's `app.component.html` nav chrome, the Resources phase's `resource.component.html` / `view/view.component.html` / per-resource SCSS, any custom login/register component override, any dashboard or landing template) is required — via the parent skill's Stance bullet — to consult Claude's `frontend-design` skill before writing output. That requirement only works if the skill is loadable in the session. BOOTSTRAP is the right place to confirm it, because BOOTSTRAP is the last phase that runs before any UI file gets written.

### 7a. Detect whether `frontend-design` is already available

`frontend-design` is one of Anthropic's built-in Claude skills. It usually ships with the Claude agent by default, in which case no install is needed and you can just note that it is available. Check the session's skill registry for an entry whose name is `frontend-design`. If present → skip to the approval gate; nothing to do.

### 7b. Install `frontend-design` when missing

If the skill is NOT in the registry — e.g., the user is on a stripped-down Claude Code build, or they explicitly pruned built-in skills — install it using the same `skills` CLI that Step 2 used for `angular/skills`. Anthropic distributes the skill under its public skills repo; pin the install to Claude Code and accept the defaults:

```bash
npx skills add frontend-design -a claude-code -y
```

If `frontend-design` is not distributed via `npx skills add` in the user's environment, surface that as an explicit blocker rather than proceeding: print the exact error, tell the user the Stance bullet in `formio-angular/SKILL.md` requires `frontend-design` for every UI-authoring phase, and ask whether they want to (a) install it manually and then resume, (b) temporarily waive the requirement (in which case you MUST call out every UI write as "generated without `frontend-design` consultation" in the approval gates of later phases so the user can review critically), or (c) abort BOOTSTRAP.

Do NOT fall back to generating UI from memory — the point of the Stance rule is that `frontend-design` encodes visual-design conventions the user's LLM would otherwise hallucinate.

### 7c. Smoke-check that the skill is loadable

After install, list the session's available skills one more time and confirm `frontend-design` appears. If it does not, the install failed silently — stop BOOTSTRAP and report the exact `npx skills add` output.

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
  Key files:                angular.json, src/app/app.module.ts
  package.json entries:
    "@formio/angular":  "^<FORMIO_ANGULAR_VERSION>"
    "@formio/js":       "^<FORMIO_JS_VERSION>"
    "bootstrap":        "^<BOOTSTRAP_VERSION>"
    "bootstrap-icons":  "^<BOOTSTRAP_ICONS_VERSION>"
  zone.js:                  present in node_modules + registered in angular.json polyfills
  frontend-design skill:    available in session (required for every UI-authoring phase)
  angular.json styles (prepended to project build target):
    node_modules/bootstrap/dist/css/bootstrap.min.css
    node_modules/bootstrap-icons/font/bootstrap-icons.css

Continuing to CONFIG — I'll generate src/app/config.ts and wire it into AppModule. Proceed?
```

If the user declines, stop. They may want to inspect the freshly-scaffolded workspace before any Form.io-specific code lands in it.
