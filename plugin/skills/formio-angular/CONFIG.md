# CONFIG — `FormioAppConfig` and `AppModule` wiring

This document is loaded by the parent `formio-angular` skill during Phase 3. It is **not** a standalone skill — no frontmatter, no independent trigger. The parent reads it after BOOTSTRAP has left the workspace in place and before AUTH.

## External references (authoritative)

- https://help.form.io/developers/introduction/application — the canonical explanation of `FormioAppConfig` and how the Angular client resolves the project vs. base URLs at runtime.
- https://github.com/formio/angular-demo/blob/master/src/app/config.ts — the reference implementation of `src/app/config.ts`. Match this shape.
- https://github.com/formio/angular-demo/blob/master/src/app/app.module.ts — the reference implementation of `AppModule`, including the `FormioAppConfig` provider registration and the `FormioModule` import.

Read these URLs before generating the files below if you are at all unsure about a detail. The templates here are faithful to the demo at the time of writing, but the demo is the source of truth.

## Skip-if-already-wired detection

Before generating anything, inspect the target workspace:

1. Read `src/app/config.ts`. Parse it (even a rough string search is fine) for an exported symbol whose value looks like a `FormioAppConfig` — specifically an object literal with keys `appUrl` and `apiUrl`.
2. Read `src/app/app.module.ts`. Check for an `import { FormioModule } from '@formio/angular';` line AND a `{ provide: FormioAppConfig, useValue: AppConfig }` (or equivalent) entry in the `providers` array.

If both conditions hold AND the captured `appUrl`/`apiUrl` match the SETUP values, **skip this phase**. Tell the user which files triggered the skip:

> Skipping CONFIG — `src/app/config.ts` already exports `AppConfig` with `appUrl = X, apiUrl = Y`, and `AppModule` already imports `FormioModule` and registers the `FormioAppConfig` provider. Moving to AUTH. Say if you want to regenerate `config.ts` anyway.

If the existing values **disagree** with the SETUP values, do not silently overwrite. Show the diff to the user and ask whether to keep the existing values (re-run SETUP to match) or overwrite `config.ts` with the new values. This is the one place in the orchestrator where the user might have meant something different from the SETUP answer.

## `src/app/config.ts` template

Write exactly this file, substituting the SETUP values for `{{FORMIO_PROJECT_URL}}` and `{{FORMIO_BASE_URL}}`. No comments, no `// TODO`, no extras — the file is tiny and must read identically to the `angular-demo` reference.

```ts
import { FormioAppConfig } from '@formio/angular';

export const AppConfig: FormioAppConfig = {
  appUrl: '{{FORMIO_PROJECT_URL}}',
  apiUrl: '{{FORMIO_BASE_URL}}',
};
```

Notes on why this shape:

- `appUrl` is the project API root — this is where forms and submissions live. The `FormioResource` module in the sub-skill appends `/<form-path>` to this URL.
- `apiUrl` is the platform deployment — this is where the SDK fetches tenant metadata, role definitions, and (if relevant) platform-level SSO configuration.
- `FormioAppConfig` is a TypeScript interface exported by `@formio/angular`; using the type ensures compile-time failure if the SDK later adds required fields.
- Exporting `AppConfig` (capital A) matches the demo; the parent skill registers it by that exact name.

## `src/app/app.module.ts` edits

The `AppModule` needs three additions if they are not already present. Edit in place — don't regenerate the whole file.

### 1. Import

At the top of `app.module.ts`, add:

```ts
import { FormioModule, FormioAppConfig } from '@formio/angular';
import { AppConfig } from './config';
```

If there is already a line importing from `@formio/angular`, merge the symbols into that import instead of adding a second one.

### 2. NgModule `imports`

Add `FormioModule` to the `@NgModule({ imports: [...] })` array:

```ts
@NgModule({
  imports: [
    // ...existing imports
    FormioModule,
  ],
  // ...
})
export class AppModule {}
```

### 3. NgModule `providers`

Add the provider registration to `@NgModule({ providers: [...] })`:

```ts
@NgModule({
  // ...
  providers: [
    // ...existing providers
    { provide: FormioAppConfig, useValue: AppConfig },
  ],
  // ...
})
export class AppModule {}
```

## The approval gate — preview then approve

Before writing or editing any files, print a diff-style preview:

```
Files to create
  src/app/config.ts  (new file)

Files to edit
  src/app/app.module.ts
    + import { FormioModule, FormioAppConfig } from '@formio/angular';
    + import { AppConfig } from './config';
    + FormioModule added to @NgModule imports
    + { provide: FormioAppConfig, useValue: AppConfig } added to @NgModule providers

Proceed with these writes? (AUTH is next.)
```

Wait for explicit approval. If the user declines, stop — do not write partial state, do not advance to AUTH. The parent skill's `## When to reset to an earlier phase` rule applies if the user wants to re-run SETUP with corrected URLs.

## After approval

Write `config.ts` and edit `app.module.ts`. Then tell the user what was written and what the next phase is:

> Wrote `src/app/config.ts` and updated `src/app/app.module.ts`. Moving to AUTH.

Proceed to `AUTH.md`.
