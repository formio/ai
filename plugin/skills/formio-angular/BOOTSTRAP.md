# BOOTSTRAP — install Angular skills and scaffold the workspace

This document is loaded by the parent `formio-angular` skill during Phase 2. It is **not** a standalone skill — no frontmatter, no independent trigger. The parent reads it after SETUP has been approved and before CONFIG.

## Why this phase exists

`formio-angular` does not know how to scaffold an Angular workspace on its own, and it should not try. The Angular team ships a maintained skill library at [`angular/skills`](https://github.com/angular/skills) that already encodes the current best practices for `ng new`, workspace layout, build configuration, and CLI options. The preferred move is to offer to install that library the first time `formio-angular` runs — the user decides, because installing skills adds instructions this session follows — and then delegate the actual workspace creation to the `angular-new-app` skill from it. A user who declines gets the local `@angular/cli` fallback in Step 2 instead; either way the workspace exists before CONFIG. `formio-angular` picks the story back up at CONFIG, where it writes the Form.io-specific files (`config.ts`, `AuthModule`, resource NgModules) into the workspace the Angular skill just created.

Doing it this way keeps the framework-agnostic `formio-application` → `formio-angular` (→ its nested `./formio-angular-resources/SKILL.md` sub-skill) chain focused on Form.io concerns, and leans on the Angular team's own skill for the Angular concerns.

BOOTSTRAP also installs the Form.io SDKs (`@formio/angular`, `@formio/js`) and the Bootstrap 5 + Bootstrap Icons stylesheets that the Form.io renderer's default template assumes. All four are pinned with caret ranges so ordinary `npm install` in the future picks up minor/patch releases automatically. Bootstrap can be opted out of by explicit user request; the Form.io SDK pair cannot — every downstream phase imports from them.

## When to skip this phase

Everything in this phase happens at `workspaceRoot`, the absolute path Pre-flight captured and SETUP stashed. Read it from there rather than from the shell: give every command below an absolute path or run it as `cd "<workspaceRoot>" && <command>`, and never let a `cd` from earlier in the session decide where a scaffold lands.

Skip BOOTSTRAP if any of the following hold at `workspaceRoot`:

1. `angular.json` exists at `workspaceRoot` — an Angular workspace is already present. The user invoked `formio-angular` against an existing app; honor that and go straight to CONFIG.
2. `package.json` exists and lists `@angular/core` as a dependency — same as above, slightly different detection signal (monorepos sometimes relocate `angular.json`).
3. `formio-application` invoked you in handoff mode and the `workspacePath` it passed — which is `workspaceRoot` — already contains `angular.json`; trust the orchestrator's detection.

If any of those hit, tell the user in one sentence: "Angular workspace already present at `<path>` — skipping BOOTSTRAP, continuing to CONFIG." Do not re-run `npx skills add` on a workspace that already exists; it is not destructive but it is noise.

**Two parts of this phase still apply, and skipping them is what makes a later phase fail with no visible cause.**

1. **The package manager.** Establish it exactly as Step 4's "Which package manager this workspace uses" describes and capture it as `PACKAGE_MANAGER` before any later phase installs anything — an existing workspace is precisely where a Yarn or pnpm lockfile is likely, and a scaffold you did not create is the one whose lockfile you can silently duplicate.
2. **Step 7, in full.** AUTH, the Resources sub-skill, and the sub-skill's Phase A gate all consume `FRONTEND_DESIGN_BRIEF`, and Step 7d is the only thing that produces it — the Phase A gate makes the agent declare that the brief was passed in, which cannot be answered honestly if nothing ever wrote one. Run 7a–7d here. Step 7d's version and stack slots come from Step 1 on a full run; on this path Step 1 did not run, so read them off the workspace instead — `@formio/angular` and `@angular/core` from `package.json`, and the design language from whatever `angular.json`'s `styles` array actually loads (see Step 7d's own note).

Also check what the existing workspace is missing that a full run would have installed: `@formio/angular` and `@formio/js` in `package.json` (Step 4's "Add the Form.io packages"), and a Bootstrap 5 stylesheet in `angular.json` if the generated screens are to be styled at all (Step 5). Neither is automatic on this path. Add what is absent under the same approval you would ask for on a full run, and say in one line which of the two you found already present — a workspace with `@formio/angular` but no Bootstrap renders correct forms with no styling, and that reads as a rendering bug.

**Those two steps need versions, and Step 1 — which captures them — did not run.** Resolve only the ones you actually need, the same way Step 1 does and from the same registry: `npm view @formio/angular version` and `npm view @formio/js version` for `FORMIO_ANGULAR_VERSION` / `FORMIO_JS_VERSION`, and `npm view bootstrap@5 version` / `npm view bootstrap-icons version` for `BOOTSTRAP_VERSION` / `BOOTSTRAP_ICONS_VERSION` (the `@5` selector prints every 5.x release — take the last line). A package the workspace already has supplies its own version from its installed `package.json` and needs no query. `FORMIO_ANGULAR_TARGET_VERSION` and `FORMIO_ANGULAR_SUPPORTED_MAJOR` are NOT needed here, because nothing on this path scaffolds a workspace — but do check that the `@angular/core` already installed falls inside `@formio/angular`'s peer range before installing, and surface a mismatch rather than installing over it. If the registry is unreachable, follow Step 1's offline list: read what is on disk, then ask for what is still unset, and never carry an unresolved `<…>` token into a command.

Otherwise, run BOOTSTRAP.

## Step 1 — resolve the target Angular version from `@formio/angular`

Before installing anything, determine which Angular major the **current latest** `@formio/angular` officially supports. Read it from the npm registry with `npm view` — the same registry `npm install` resolves against, queried through the local npm client. Do not fetch a package manifest from a CDN or any other URL: a document fetched at run time decides what this skill installs and which Angular major it targets, so the answer has to come from the registry the install itself will use.

```bash
npm view @formio/angular version
npm view @formio/angular peerDependencies
```

What to read from the output:

1. **The resolved `@formio/angular` version.** `npm view @formio/angular version` prints the latest published version (e.g., `10.0.1`). Capture it as `FORMIO_ANGULAR_VERSION` — this is what you will install in Step 4 and cite in the approval summary. Do NOT hard-code a version into the query; resolving the current release is the point.
2. **Highest supported Angular major.** In the `peerDependencies` output, find `@angular/core`. The range typically lists several majors (e.g. `^17.0.0 || ^18.0.0 || … || ^N.0.0`). Take the **highest** major in that range — that is the newest Angular `@formio/angular` supports, and always the one to target. Capture it as `FORMIO_ANGULAR_SUPPORTED_MAJOR`. If `peerDependencies` prints nothing, fall back to `npm view @formio/angular dependencies` for the same key; if neither names `@angular/core`, stop and tell the user — do NOT guess. (The goal is always the latest supported Angular — never an older major, and never a major newer than `@formio/angular` declares.)
3. **Latest patch within that major.** Query the registry for the newest published `@angular/core` in that major:

   ```bash
   npm view @angular/core@<major>.x.x version
   ```

   A range selector prints every matching version, newest last — take the last line. Capture that full `MAJOR.MINOR.PATCH` string as `FORMIO_ANGULAR_TARGET_VERSION`, the version you pin the new workspace to in Step 3.

Then do the same for `@formio/js`, the core Form.io SDK that `@formio/angular` wraps:

```bash
npm view @formio/js version
```

Capture it as `FORMIO_JS_VERSION` (e.g., `5.3.3`). You do NOT need to cross-check `@formio/js`'s own peer dependencies against Angular — `@formio/angular` already declares the compatible `@formio/js` range in its own `peerDependencies` / `dependencies`. If the latest `@formio/js` falls outside that range, fall back to the newest version inside the range `@formio/angular` names; if it is inside the range, use the latest.

Do the same for Bootstrap 5 and Bootstrap Icons, because the Form.io renderer defaults to its Bootstrap 5 template and without these stylesheets submission forms render unstyled:

```bash
npm view bootstrap@5 version
npm view bootstrap-icons version
```

Capture them as `BOOTSTRAP_VERSION` (e.g., `5.3.3`) and `BOOTSTRAP_ICONS_VERSION` (e.g., `1.11.3`) — again, the `@5` range prints every 5.x release, so take the last line. The `@5` selector keeps Bootstrap on the major the renderer targets; if it resolves nothing, stop and ask the user rather than installing a different major — Form.io's default template targets Bootstrap 5, and silently picking up Bootstrap 6+ would break the renderer.

**If the registry is unreachable.** On an air-gapped or proxy-restricted host the queries above fail with a network error rather than an empty answer — the same kind of environment `formio-mcp-setup` keeps a documented offline path for. Do not substitute a CDN or any other URL for the registry, and do not guess a major. Work down this list and stop at the first step that answers:

1. **A manifest already on disk.** If the target directory or its parent workspace has `node_modules/@formio/angular/package.json`, read it with your file tools: its `version` is `FORMIO_ANGULAR_VERSION`, and its `peerDependencies['@angular/core']` carries the same range `npm view` would have printed, so `FORMIO_ANGULAR_SUPPORTED_MAJOR` is still the highest major in it. If `node_modules/@angular/core/package.json` is also present and its `version` is in that major, that full `MAJOR.MINOR.PATCH` is `FORMIO_ANGULAR_TARGET_VERSION`. Resolve `@formio/js`, `bootstrap`, and `bootstrap-icons` the same way from their own installed manifests where present. A file already on this machine is not a document fetched at run time — this is the offline equivalent of the registry query, not a way around it.
2. **Ask the user for whatever step 1 did not answer.** Tell them in one line that the registry is unreachable, then ask in a single round for exactly the variables still unset: the `@formio/angular` version to install (`FORMIO_ANGULAR_VERSION`), the Angular version to target (`FORMIO_ANGULAR_TARGET_VERSION`), the `@formio/js` version to install alongside it (`FORMIO_JS_VERSION`), and the Bootstrap 5 and Bootstrap Icons versions (`BOOTSTRAP_VERSION`, `BOOTSTRAP_ICONS_VERSION`). Use what they give you verbatim; do not round any of it up to a newer major. If they name only a major rather than a full version for Angular, set `FORMIO_ANGULAR_TARGET_VERSION` to that major alone — `ng new` and `@angular/cli@<major>` both accept a bare major, and inventing a `.MINOR.PATCH` nobody named would pin the workspace to a release that may not exist.

   Two of the six are then set from those answers rather than asked for separately:
   - `FORMIO_ANGULAR_SUPPORTED_MAJOR` is the major of the `FORMIO_ANGULAR_TARGET_VERSION` the user named — both `19.2.4` and a bare `19` give `19`. That is not a guessed major; it is the major the user chose, and it is the value Step 2's `@angular/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR>` fallback, Step 3's CLI flag, Step 4's `@angular/core` check, and the approval summary all read. Only the reverse derivation stays forbidden: never build a target version out of a major by appending `.MINOR.PATCH`.
   - `BOOTSTRAP_VERSION` and `BOOTSTRAP_ICONS_VERSION` are `null` when the user cannot name them. That is the same state as the Step 1 opt-out, so Step 5 skips its install and its `angular.json` edits. Tell the user in one line that submission forms will render unstyled until Bootstrap is added, and report it in the approval summary as `skipped — registry unreachable`, never as a version.

   Never fill any of the six in yourself, and never carry an unresolved placeholder into a command: a literal `@angular/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR>` on the command line installs nothing, and an invented major fails at CONFIG after `ng new` has already written the tree.

`FORMIO_ANGULAR_TARGET_VERSION` has no other offline source: it is the newest patch in a major, and only the registry knows that. Do not derive it from `FORMIO_ANGULAR_SUPPORTED_MAJOR` by appending `.0.0`.

Whichever step answered, say so in the Phase 2 approval summary — "resolved from `node_modules`" or "supplied by you", not a bare version — so a number that did not come from the registry is never presented as though it did. If neither step answers, stop and tell the user Phase 2 cannot proceed without registry access or those versions. Never scaffold against an assumed Angular major: a workspace on a major `@formio/angular` does not support fails at CONFIG, after `ng new` has already written the tree.

Stash the six results for later phases:

- `FORMIO_ANGULAR_VERSION` — the latest `@formio/angular`, resolved from the npm registry
- `FORMIO_JS_VERSION` — the latest `@formio/js` (constrained to `@formio/angular`'s declared range)
- `FORMIO_ANGULAR_SUPPORTED_MAJOR` — the highest Angular major in `@formio/angular`'s peer range
- `FORMIO_ANGULAR_TARGET_VERSION` — the latest `MAJOR.MINOR.PATCH` within that major
- `BOOTSTRAP_VERSION` — the latest Bootstrap 5
- `BOOTSTRAP_ICONS_VERSION` — the latest Bootstrap Icons

Report the six resolved versions to the user in the Step 2 approval summary — they are what the workspace gets built against, and a version nobody saw is a version nobody agreed to.

Never guess an Angular major, and never read a package manifest from a CDN or any other URL: the registry `npm view` queries here is the one `npm install` resolves against in Step 4, so it is the only source these six versions may come from.

**Opt-out:** if the user has explicitly said they do NOT want Bootstrap (e.g., "use Material", "skip Bootstrap", "I'll style it myself"), skip the two Bootstrap queries above and set `BOOTSTRAP_VERSION` + `BOOTSTRAP_ICONS_VERSION` to `null`. Step 5 will then skip its install and `angular.json` edits entirely. The default stays on Bootstrap 5 because the Form.io renderer's default template is Bootstrap 5 and unstyled forms are a bad first impression — an override needs a real user signal.

## Step 2 — offer the Angular skills library, then install it if the user agrees

Scaffolding is delegated to the Angular team's own `angular-new-app` skill, which arrives by installing their skill library. That install writes skills into the user's agent configuration, and those skills then direct this session — so it is the user's call, not yours, and it needs an explicit yes before anything runs.

Ask once, showing the exact command you would run and where it comes from:

```bash
npx skills add https://github.com/angular/skills --all -a <agent> -y
```

State three things with the offer: the source is the Angular team's official repository on GitHub (`angular/skills`), `--all` installs every skill in it — not only `angular-new-app` — and the installed skills become instructions this session follows. Then wait for an answer.

**If the user agrees**, run it exactly once per session, before invoking `angular-new-app`, and report what it installed.

- `-a <agent>` is the client you are actually running in — substitute it (`claude-code`, `cursor`, `codex`, `copilot`, …) so the skills register where this session will look for them. If you cannot determine the running client, omit the flag entirely: the default target is the universal `.agents/skills/` directory, which Cursor, Codex, and Copilot all read, and which Claude Code reads through a symlink. Never hardcode one client. Run the command from `workspaceRoot` and stay there — those directories are where the CLI writes, not somewhere to move the shell to, and a session that walks into one scaffolds the user's application inside their agent configuration.
- `-y` accepts the default install location and any prompts the `skills` CLI emits. It does not stand in for the user's approval above — that approval is what allows the command to run at all.
- If the command fails, never retry it against a different source. No other repository, fork, or mirror stands in for `angular/skills`, and no hand-assembled copy of those skills stands in for the CLI that installs them.

**If the user declines — or the install fails and they do not want to retry — scaffold the workspace locally instead.** Run the Angular CLI directly, pinned to the major resolved in Step 1, in the target directory:

```bash
cd "<workspaceRoot>" && npx -y @angular/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR> new <project-name> --directory . --routing --style=scss
```

`--directory .` is relative, so the `cd` in front of it is what decides where the workspace lands. Substitute the absolute `workspaceRoot` there; do not run the command bare and trust the shell to already be in the right place.

Show the command and get approval for it too, then continue at Step 4 — Step 3 does not apply, because there is no `angular-new-app` to delegate to. The delegated path stays the default because the Angular team's skill encodes current `ng new` practice and keeps up with it; this fallback exists so declining a third-party skill install never leaves the user stuck, not because the two are equivalent.

## Step 3 — delegate to `angular-new-app`

Skip this step entirely when Step 2 took the local `@angular/cli` fallback — there is no `angular-new-app` to call. **Two things it would have decided still need deciding**, because the fallback command names them: the project name (same rule as below — derive it from the Project URL's first path or sub-domain segment when there is one, otherwise use the directory's own name, and never invent one the user has not seen, since `--directory .` writes it permanently into `angular.json` and `package.json`), and the Angular version, which the command already carries as `@angular/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR>`. Otherwise, once the install succeeds, invoke the `angular-new-app` skill to create the Angular workspace at `workspaceRoot` — the captured absolute path, never the shell's current directory. The skill is designed to handle its own interview — routing (yes/no), stylesheet choice (CSS/SCSS/etc.), strict mode, and anything else `ng new` accepts — so you do NOT re-ask those questions on its behalf.

What to pass to `angular-new-app`:

- **Working directory:** `workspaceRoot`, the absolute path Pre-flight captured and SETUP stashed. Pass that string. Do not pass `.`, do not pass a path relative to anything, and do not re-read the shell's current directory to fill this in — that is the value a stray `cd` corrupts.
- **Project name (if asked):** offer a name derived from the Form.io `Project URL`'s subdomain if the user gave one (e.g., `https://foo.form.io` → `foo`). Otherwise let `angular-new-app` default to the directory name.
- **Angular version (critical):** pass the `FORMIO_ANGULAR_TARGET_VERSION` resolved in Step 1 — the latest patch of the highest Angular major `@formio/angular` supports, or, on the offline path, a bare major the user named. Either form is valid here: `@angular/cli@<major>` resolves the newest CLI in that major, so pass a bare major through unchanged rather than padding it to `<major>.0.0`. If `angular-new-app` exposes a version / CLI-version option, use it; if it shells out to `@angular/cli` and takes CLI flags, pass `@angular/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR>` so `npx` resolves the matching CLI major before running `ng new`. Always target the newest Angular `@formio/angular` supports; the only thing to avoid is an even-newer Angular major that `@formio/angular` has not yet declared, which would break `npm install` at Step 4.
- **Intent note:** "This workspace will be wired against `@formio/angular@<version>`, which supports Angular `<major>`. The Form.io integration (config, auth, resource NgModules) is generated in subsequent phases by `formio-angular` and its nested Resources sub-skill at `./formio-angular-resources/SKILL.md`." The Angular skill does not need this for correctness, but surfacing it keeps the flow transparent to the user watching the transcript.

Do not override `angular-new-app`'s approval gates — it runs its own, and layering a second one on top is confusing. When `angular-new-app` reports success and the workspace exists on disk, BOOTSTRAP is done.

## Step 4 — confirm the workspace is ready for CONFIG

Before advancing, verify all of the following exist:

- `<workspaceRoot>/angular.json`
- an application bootstrap — **either** `<workspaceRoot>/src/app/app-module.ts` (NgModule) **or** `<workspaceRoot>/src/app/app.config.ts` plus a standalone root component. See "Which bootstrap shape landed" immediately below; one of the two is a normal outcome, not a failure.
- `<workspaceRoot>/package.json` with `@angular/core` present at the major resolved in Step 1
- `<workspaceRoot>/package.json` with `@formio/angular` pinned as `"^<FORMIO_ANGULAR_VERSION>"` and `@formio/js` pinned as `"^<FORMIO_JS_VERSION>"`

Check them at that absolute path, spelled out. A check written against "the workspace" and run wherever the shell sits passes in the wrong tree and reports a scaffold that is not where anyone will look for it. If `angular.json` is absent at `workspaceRoot`, stop this phase and find where it actually landed — a tree written to the wrong directory is a scaffold to move or delete with the user's say-so, not one to patch around or re-run on top of.

### Which bootstrap shape landed

Every later phase — CONFIG's provider registration, AUTH's `AuthModule` import, and every resource module the sub-skill generates — edits `src/app/app-module.ts`, and the skill's stance is NgModules with `standalone: false`. Recent Angular CLI versions scaffold a **standalone** application instead: `app.config.ts` with `ApplicationConfig` providers, a standalone root component, and no `app-module.ts` at all. Nothing this phase passes to the scaffolder reliably changes that, so detect the shape rather than assuming it.

- **`app-module.ts` present.** Nothing to do; continue.
- **`app.config.ts` present and no `app-module.ts`.** Convert the bootstrap here, in BOOTSTRAP, so every later phase finds the file it expects. This is a real change to the user's new workspace, so show it and get approval first — it is small, and it is the alternative to five phases of conditional edits.

  Create `<workspaceRoot>/src/app/app-module.ts` declaring the existing root component, importing `BrowserModule` and the router module the scaffolder configured, carrying over every provider from `app.config.ts`'s `providers` array, and bootstrapping that component:

  ```ts
  @NgModule({
    declarations: [App],
    imports: [BrowserModule, RouterModule.forRoot(routes)],
    providers: [/* everything app.config.ts provided */],
    bootstrap: [App],
  })
  export class AppModule {}
  ```

  Then point `src/main.ts` at it — `platformBrowser().bootstrapModule(AppModule)` in place of `bootstrapApplication(App, appConfig)` — set `standalone: false` on the root component and remove its `imports` array, and delete `app.config.ts` once nothing references it. Verify with the Step 6c build before advancing.

  Say in one line what you changed and why: the generated Form.io wiring is NgModule-based, so the workspace's bootstrap has to be too.

If `angular.json` is missing, or neither bootstrap shape is present, something went wrong inside the scaffolding step (`angular-new-app`, or the `@angular/cli` fallback) or the follow-up install. Do not patch around it; stop BOOTSTRAP and ask the user whether they want to retry, switch to an existing workspace, or abort. If `@angular/core` in the generated `package.json` is a different major than `FORMIO_ANGULAR_SUPPORTED_MAJOR`, the `angular-new-app` invocation did not honor the version pin — stop and surface the mismatch before continuing. If the Form.io entries landed as exact pins or `~` ranges, rewrite them to `^` as described above and re-run the install with `PACKAGE_MANAGER`.

### Which package manager this workspace uses

Establish it here, before the first install below — nothing in this document runs a package manager until it is known. Read `packageManager` in `<workspaceRoot>/package.json` first, then look for a lockfile: `yarn.lock` → Yarn, `pnpm-lock.yaml` → pnpm, `bun.lock` or `bun.lockb` → Bun, `package-lock.json` → npm. `packageManager` wins over any lockfile, and when more than one lockfile is present the first hit in that order wins — `package-lock.json` is checked last because it is the one a stray `npm install` leaves behind in a workspace that belongs to another tool. Capture the answer as `PACKAGE_MANAGER` and use that one tool for every install and script for the rest of the session. Default to npm only when the workspace has none of them. The `npm install` / `npm view` commands written throughout this document assume npm; translate them to `PACKAGE_MANAGER` when it is something else.

**Never introduce a second lockfile.** Running `npm install` in a Yarn or pnpm workspace writes a competing lockfile and a parallel `node_modules`, and the user's own commands keep resolving against the tree you did not build. Nothing warns you: the app you build and test passes, and it is not the app they run.

**The smoke check in Step 6c is where the un-hoisted failure surfaces — run it through `PACKAGE_MANAGER`, never bare `npm`/`npx`.** A successful install hides one class of failure: npm hoists every transitive dependency to the top of `node_modules`, so a package that requires something it never declared resolves anyway. Yarn PnP and pnpm's isolated linker do not hoist, and they fail on exactly those imports — so a workspace that installs and builds under npm can still fail on the user's first command with a resolve error naming a package the app never imported. The failure can only appear once the Form.io packages are installed (below, and Step 5), which is why the check lives in 6c and not here, and it is caught by a terminating `ng build`, not a dev server — do not start `ng serve` in this phase. That error is a packaging defect in the dependency, not a fault in the generated app: report it as such, and fix it upstream where you can. Where you cannot, the escape hatch belongs to the user's package manager — Yarn's `packageExtensions`, pnpm's `dependenciesMeta` / hoisting settings — and it is a stopgap to remove once the dependency declares what it uses, never a step to apply by default.

### Add the Form.io packages

Also add `@formio/angular` and its peer SDK `@formio/js` to the workspace now so CONFIG can `import` from them without a follow-up install step. Install both in a single `PACKAGE_MANAGER` invocation (the commands below are written for npm — translate them), and use the caret (`^`) range prefix so the resulting `package.json` entries will auto-pick up future minor + patch releases within the same major without another bootstrap run:

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

Run this from `workspaceRoot` — the directory `angular-new-app` created the workspace in — either by giving `npm` that path or by prefixing `cd "<workspaceRoot>" && `. The caret prefix matters — npm's default save-prefix writes `^` already, but do NOT override the user's `.npmrc` if they have configured `save-prefix=~` or `save-exact=true`; in that case, invoke `npm install --save --save-prefix='^' @formio/angular@^<FORMIO_ANGULAR_VERSION> @formio/js@^<FORMIO_JS_VERSION>` to force the `^` regardless. After the install, open the workspace's `package.json` and verify both entries read `"^<version>"` — if either one came out as an exact pin or a `~`, rewrite the line to the `^` form and re-run the install with `PACKAGE_MANAGER` so the lockfile matches.

## Step 5 — add Bootstrap 5 and Bootstrap Icons

Skip this step only when `BOOTSTRAP_VERSION === null` — either because the user explicitly opted out in Step 1, or because the registry was unreachable and they could not name the versions. Otherwise run it unconditionally — the Form.io renderer ships a Bootstrap 5 default template, and the forms the sub-skill generates assume Bootstrap 5 classes (`form-control`, `btn`, `row`, etc.) and `bi bi-*` icon classes are available globally.

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

Then wire the stylesheets into `angular.json` so the Angular build pipeline bundles them. Open `<workspaceRoot>/angular.json`, find the first `projects.<projectName>.architect.build.options.styles` array (and repeat for the matching `test` target's `styles` array — usually immediately below `build`), and ensure these three entries appear **before** the workspace's own `src/styles.css` / `src/styles.scss` so application styles can override the defaults:

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
- **Do NOT add `@formio/js/dist/formio.form.css` here — `@formio/angular` already supplies it.** Its `FormioComponent` declares `styleUrls: ['.../@formio/js/dist/formio.form.min.css']` with `encapsulation: ViewEncapsulation.None`, and ng-packagr inlines that stylesheet into the published FESM bundle (~44 KB, verified in `@formio/angular@11.0.5`). `ViewEncapsulation.None` is what makes it work: the styles are emitted globally, so they reach the DOM the renderer builds imperatively, which scoped component styles never would. Adding the file to `angular.json` would ship a second copy of the same ~44 KB for no benefit. This is a real difference between the frameworks — `@formio/react` ships no CSS at all and its applications must import the stylesheet explicitly, which is why `formio-react/BOOTSTRAP.md` requires exactly what this document forbids.
- None of these go into `main.ts` or an `@import` in `styles.css` — the `angular.json` `styles` array is the Angular-native place to add workspace-wide stylesheets and is what `angular-new-app` expects.

Do NOT add Bootstrap's JavaScript bundle (`bootstrap.bundle.min.js` via `angular.json`'s `scripts` array). The Form.io renderer does not depend on Bootstrap's JS behaviors (dropdowns, modals, tooltips), and pulling the JS in would conflict with Angular's own DOM management. If a future resource module needs a Bootstrap JS feature, the Resources sub-skill (`./formio-angular-resources/SKILL.md`) can add it on a per-module basis.

After editing `angular.json`, re-run a clean install (with the workspace's own package manager — see Step 4) or `cd "<workspaceRoot>" && ng build --configuration=development` as a smoke check, to confirm the new style paths resolve. If any path 404s, verify the package version in `node_modules` — a Bootstrap 5+ major always ships `dist/css/bootstrap.min.css` and Bootstrap Icons always ships `font/bootstrap-icons.css`, so a 404 means the install did not land.

**Confirm the renderer's own styles reached the page — later, not here.** No form renders during BOOTSTRAP, and Angular injects a `ViewEncapsulation.None` component's styles only when that component is first instantiated, so this check has no moment in this phase. Carry it forward to the first phase that renders a `<formio>` component (AUTH's login screen at the earliest): a `.formio-component` rule should then be present in the document's stylesheets, supplied by `@formio/angular`'s inlined component styles rather than by anything in `angular.json`. If it is absent there, suspect the `@formio/angular` install, not a missing entry in the styles array.

## Step 6 — pin zoneless change detection explicitly

A generated app must **pin its change-detection mode explicitly** rather than inherit whatever `angular-new-app` / the CLI happened to default to — that default has drifted across Angular releases, which would make generated apps non-deterministic. Because the skill always targets the latest Angular `@formio/angular` supports (Step 1), the app uses **zoneless** change detection. `@formio/angular` is change-detection-mode agnostic, so pinning zoneless is safe; pinning it _explicitly_ is what makes the result deterministic.

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
cd "<workspaceRoot>" && ng build --configuration=development
```

Invoke it through `PACKAGE_MANAGER` (`npx ng`, `pnpm exec ng`, `yarn ng`, `bunx ng`) so the build resolves against the tree the user's own commands use — this is the run that surfaces an undeclared transitive dependency under Yarn PnP or pnpm's isolated linker (see Step 4, "Which package manager this workspace uses"). A clean build confirms the `polyfills` shape matches the builder and the CD provider import resolves. If the app logs `NG0908` / `Zone is not defined` at runtime, a dependency still expects `zone.js` — re-check that no generated code imports `zone.js` and that `provideZonelessChangeDetection()` is actually registered.

## Step 7 — confirm the `frontend-design` skill is available

### Why this step exists

Every downstream phase in `formio-angular` that authors a user-facing surface (the AUTH phase's shell layout and nav UI in `app.html` (legacy `app.component.html`), the Resources phase's `resource.component.html` / `view/view.component.html` / per-resource SCSS, any custom login/register component override, any dashboard or landing template) should consult the `frontend-design` skill before writing output — that is how the generated UI ends up polished instead of generic. "User-facing surface" means anything touching: HTML templates, SCSS/CSS, page layout (the app shell's page gutters, max content width, and top spacing around `<router-outlet>`), component layout, spacing, typography, color, nav UI, empty states, loading states, error states, list-vs-card layouts, form styling beyond `form-control` defaults, responsive behavior, and accessibility (focus order, ARIA, contrast). Form-field styling that comes directly from the Form.io renderer's default Bootstrap 5 template is exempt — you do not override what the renderer already provides — but anything the skill itself authors outside the renderer's output is NOT exempt. `frontend-design` is **strongly recommended but NOT required**. BOOTSTRAP only **detects** its availability and records the status; it does NOT run its own install prompt. The strong recommendation + install offer is owned by the orchestrator `formio-application` (Step 5a) — keeping it in one place avoids two skills nagging the user about the same skill.

### 7a. Detect whether `frontend-design` is available — match the skill, not one client's prefix

`frontend-design` is a portable Agent Skill, so how it is registered depends on the client that installed it. It may appear under the bare name `frontend-design` or under a client-namespaced form such as `frontend-design:frontend-design`. Check your skill list for **any** of those forms and treat a match as "available".

Do NOT look only for one form — matching a single client's naming is the historical bug that made this step silently fail and the UI fall back to plain, unstyled Bootstrap.

### 7b. Honor the handoff status; do not run a competing install prompt

- **Invoked via `formio-application` handoff:** the orchestrator already ran its `frontend-design` pre-check (Step 5a) and passed `frontendDesignStatus`.
  - `frontendDesignStatus: 'available'` → consult `frontend-design` (with the brief from 7d) on every UI surface, as the Stance requires.
  - `frontendDesignStatus: 'declined'` → the user was already offered the skill and chose to proceed without it. Do NOT re-prompt. Apply the Step 7d brief inline as your own design direction, and disclose on **every** UI approval gate (AUTH nav UI, each Resources Phase A plan) that the file was generated **without** `frontend-design` consultation, so the user can review it critically.
- **Invoked directly (no handoff):** run the 7a detection yourself.
  - Available → consult it normally.
  - Missing → it is strongly recommended, not required. Surface a one-line recommendation that the user install `frontend-design` — it ships at <https://github.com/anthropics/claude-plugins-public/tree/main/plugins/frontend-design> and installs like any other Agent Skill, however this client installs them — and let them choose to install-then-resume or proceed without it. If they proceed without it, apply the Step 7d brief inline and disclose on every later UI gate that the output was generated without `frontend-design`. Do NOT hard-block, and do NOT silently fall back to plain Bootstrap.

### 7c. Record the availability for the summary

Note in BOOTSTRAP's working context whether `frontend-design` is available, declined, or being recommended-pending, so the approval-gate summary can report it and later phases know whether to disclose.

### 7d. Record the Bootstrap-5 design brief for later phases

Write (or update) a short design-brief block in the skill's working context. When `frontend-design` is available, every later phase pastes this brief into its invocation verbatim; when it is not, every later phase treats the brief itself as the design direction to follow. Either way it keeps the visual language consistent across AUTH's nav UI, the Resources sub-skill's per-resource templates, and any future skill working in this workspace. Stash the brief as `FRONTEND_DESIGN_BRIEF`:

```
## frontend-design brief — Bootstrap 5 Form.io Angular app

READ THIS FIRST — what is normative and what is vocabulary. The `Design constraints`
and `Stack` sections below are written in Bootstrap 5 vocabulary because Bootstrap 5
is what this skill installs by default. If a later phase's interview selected a
different design language (Tailwind, Angular Material, the workspace's existing design
system, or unstyled HTML), the REQUIREMENTS still hold verbatim — a page shell that
owns gutters, one spacing rhythm, one color source, accessible focus and labels, no
parallel token system — and only the class names, component names, and token names are
replaced by that language's own equivalents. Substitute; do not drop the requirement.

Stack (already wired, DO NOT change):
- Angular {{FORMIO_ANGULAR_SUPPORTED_MAJOR}} with NgModules + `standalone: false`.
- Bootstrap {{BOOTSTRAP_VERSION}} — CSS loaded via `angular.json` styles from
  `node_modules/bootstrap/dist/css/bootstrap.min.css`. NO Bootstrap JS bundle.
- Bootstrap Icons {{BOOTSTRAP_ICONS_VERSION}} — `bi bi-*` class family available globally.
- Form.io renderer mounts its own Bootstrap 5 markup for form fields (`form-control`,
  `form-select`, `form-label`, validation feedback) — do not restyle those.

Design constraints:
- Page shell: the app shell wraps `<router-outlet>` in ONE page-layout element that
  owns horizontal gutters, max content width, and top spacing. Page templates never
  add their own page-level wrapper. Library-rendered routes (create / edit / delete /
  index / login / register) inherit gutters only from that shell element, so it is the
  only place page padding can come from. In this stack, realize it with:
  `<main class="container-xxl px-3 px-md-4 py-4">`, with the navbar's own inner
  container being the SAME `container-xxl px-3 px-md-4` so the brand aligns with the
  content (padding the full-bleed `<nav>` element instead misaligns it above the
  container's max width).
- Use Bootstrap 5 utility classes first: `row`, `col-*`, `g-*`,
  `d-flex`, `align-items-*`, `justify-content-*`, `gap-*`, margin/padding helpers
  (`m[t|b|s|e|x|y]-*`, `p[...]-*`), text helpers (`text-*`, `fs-*`, `fw-*`),
  color helpers (`bg-*`, `text-*`, `border-*`). The container is NOT a free choice:
  the page shell above fixes it at `container-xxl`, so do not reach for
  `container-fluid` / `container` there — `container-fluid` spans the full viewport
  and drops the max content width the shell contract requires.
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
  needs a different primary, override `--bs-primary` ONCE in the workspace's
  global stylesheet (`src/styles.css`, or `src/styles.scss` on an SCSS workspace);
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

Every later phase that invokes `frontend-design` prepends this brief to the prompt it passes. AUTH's shell-template section references it (see `AUTH.md`'s nav section). The Resources sub-skill's Phase A plan cites the brief in its `frontend-design consulted:` line (see `formio-angular-resources/SKILL.md`). Keeping the brief in one place avoids drift: update BOOTSTRAP Step 7d once and every downstream phase picks up the new wording.

## The approval gate

BOOTSTRAP's gate covers what happens outside `angular-new-app`. Creating the workspace tree is gated inside that skill's own approval, but Steps 4 through 6 are not: the package installs, the `angular.json` `styles` edits, the change-detection provider, and any bootstrap conversion from Step 4 all land before this gate prints. So the gate is where the user reviews those, and the summary below has to name them rather than only reporting that a workspace exists. After Steps 1–7 succeed, print a one-block summary and pause for acknowledgement:

```
Bootstrap complete
  @formio/angular version:  <FORMIO_ANGULAR_VERSION>      (source of truth)
  @formio/js version:       <FORMIO_JS_VERSION>
  Supported Angular major:  <FORMIO_ANGULAR_SUPPORTED_MAJOR>
  Angular pinned to:        <FORMIO_ANGULAR_TARGET_VERSION>  (latest patch in major)
  Bootstrap version:        <BOOTSTRAP_VERSION>              (or "skipped — user opted out" / "skipped — registry unreachable")
  Bootstrap Icons version:  <BOOTSTRAP_ICONS_VERSION>        (or "skipped — user opted out" / "skipped — registry unreachable")
  Angular skills installed: <path reported by npx>
  Package manager:          <PACKAGE_MANAGER>
  Workspace:                <absolute workspace path>
  Key files:                angular.json, src/app/app-module.ts
  package.json entries:
    "@formio/angular":  "^<FORMIO_ANGULAR_VERSION>"
    "@formio/js":       "^<FORMIO_JS_VERSION>"
    "bootstrap":        "^<BOOTSTRAP_VERSION>"
    "bootstrap-icons":  "^<BOOTSTRAP_ICONS_VERSION>"
  change detection:         zoneless — provideZonelessChangeDetection() registered, angular.json polyfills empty (no zone.js)
  frontend-design:          available in session (strongly recommended; will be consulted on every UI surface)
                            -- or "not installed — applying the Bootstrap 5 brief inline; UI gates will disclose this"
  angular.json styles (prepended to project build target):
    node_modules/bootstrap/dist/css/bootstrap.min.css
    node_modules/bootstrap-icons/font/bootstrap-icons.css

Continuing to CONFIG — I'll generate src/app/config.ts and wire it into AppModule. Proceed?
```

If the user declines, stop. They may want to inspect the freshly-scaffolded workspace before any Form.io-specific code lands in it.
