---
'@formio/ai': patch
---

Bring `formio-angular` up to Angular 21 — the newest major `@formio/angular` 11.0.6 supports — and fix three failures a generated application hit on it, each reproduced in a real Angular 21 `--no-standalone` workspace before the fix was written.

**A plain `ng build` failed.** The CLI's default `initial` budget errors at 1 MB, and an application carrying `@formio/angular` and `@formio/js` is about 2.1 MB before compression, so the user's first release build failed on a workspace whose own code was untouched; the development-only smoke check never saw it. BOOTSTRAP's new Step 6c raises the budget to 2.5 MB warning / 3 MB error and allows `@formio/js` and `lodash` as CommonJS dependencies, and the smoke check (now 6e) builds the production configuration too.

**`ng test` failed.** Angular 21 runs specs with Vitest through `@angular/build:unit-test`, and any spec reaching `@formio/angular` failed to load — `Named export 'assign' not found` from `lodash`, then `matchMedia is not a function` from jsdom. Step 6d adds a `runnerConfig` that inlines `@formio/angular` and a setup file that stubs `matchMedia`; both halves are needed.

**Installing into a zone-based workspace failed with `ERESOLVE`.** `@formio/angular`'s optional `zone.js` peer is `~0.14.0 || ~0.15.0`, while Angular 21 accepts 0.16. The existing-workspace path and the embed branch now check an installed `zone.js` and offer `zone.js@~0.15.0`, and never pass `--legacy-peer-deps` or `--force`. The embed branch also checks the installed `@angular/core` against the peer range before installing, since npm's `latest` Angular is a major `@formio/angular` does not support yet.

Generated templates use built-in control flow (`@if` / `@for` / `@switch`): the design brief no longer mandates the `*ngIf` / `*ngFor` directives deprecated since Angular 20, and every example in the skill family is converted. The CLI fallback scaffolds with `--no-standalone`, so it never needs the standalone-to-NgModule conversion. Step 6 no longer describes a `polyfills` array or `provideZonelessChangeDetection()` that Angular 21's `ng new` does not generate, a test target's `styles` array is repeated only on the Karma-era workspaces that have one, and workspaces generated before Angular 20 have their `app.module.ts` / `app-routing.module.ts` edited under their own names. Example versions move to `@formio/angular` 11.0.6, `@formio/js` 5.6.1, Bootstrap 5.3.8, and Bootstrap Icons 1.13.1, and the inlined stylesheet is measured at ~41 KB.

The eval seed becomes a buildable Angular 21 NgModule workspace — it previously imported an `AppComponent` and `HomeComponent` it did not contain — and the grader accepts both module file-name conventions, where before eval-1's merge checks could pass only if the agent renamed the user's files.
