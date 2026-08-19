# CONFIG — `FormioAppConfig` and `AppModule` wiring

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `npx -y @formio/mcp@0.10.0 project get --cwd "<workspace root>"`; never compose, derive, or hand-type either one yourself.

This document is loaded by the parent `formio-angular` skill during Phase 3. It is **not** a standalone skill — no frontmatter, no independent trigger. The parent reads it after BOOTSTRAP has left the workspace in place and before AUTH.

## Skip-if-already-wired detection

Before generating anything, inspect the target workspace:

1. Read `src/app/config.ts`. Parse it (even a rough string search is fine) for an exported symbol whose value looks like a `FormioAppConfig` — specifically an object literal with keys `appUrl` and `apiUrl`. Compare those two values against the URLs SETUP resolved from `project get`. They must agree: if they differ, do NOT skip and do NOT overwrite — surface both pairs and which record each came from, and ask which is correct, per SETUP's "When an existing config.ts disagrees". A silent choice here leaves the application pointed at one deployment while every build-time tool call resolves another.
2. Read `src/app/app-module.ts`. Check for an `import { FormioModule } from '@formio/angular';` line AND a `{ provide: FormioAppConfig, useValue: AppConfig }` (or equivalent) entry in the `providers` array.

If both conditions hold AND the captured `appUrl`/`apiUrl` match the SETUP values, **skip this phase**. Tell the user which files triggered the skip:

> Skipping CONFIG — `src/app/config.ts` already exports `AppConfig` with `appUrl = X, apiUrl = Y`, matching the project this directory resolves to, and `AppModule` already imports `FormioModule` and registers the `FormioAppConfig` provider. Moving to AUTH. Say if you want to regenerate `config.ts` anyway.

If the existing values **disagree** with the SETUP values, do not silently overwrite. Show the diff to the user and ask whether to keep the existing values (re-run SETUP to match) or overwrite `config.ts` with the new values. This is the one place in the orchestrator where the user might have meant something different from the SETUP answer.

## `src/app/config.ts` template

Write exactly this file, substituting the URLs SETUP resolved from `project get` for `{projectUrl}` and `{baseUrl}`. Those two values are the ONLY source — never compose, derive, or default either one here, and never carry one over from an earlier session or another project: the mapping the server reports is what the build-time tools resolve, so anything else written into this file is a second, disagreeing record. No comments, no `// TODO`, no extras — the file is tiny and must read identically to the `angular-demo` reference.

```ts
import { FormioAppConfig } from '@formio/angular';

export const AppConfig: FormioAppConfig = {
  appUrl: '{projectUrl}',
  apiUrl: '{baseUrl}',
};
```

Notes on why this shape:

- `appUrl` is the project API root — this is where forms and submissions live. The `FormioResource` module in the sub-skill appends `/<form-path>` to this URL.
- `apiUrl` is the platform deployment — this is where the SDK fetches tenant metadata, role definitions, and (if relevant) platform-level SSO configuration.
- `FormioAppConfig` is a TypeScript interface exported by `@formio/angular`; using the type ensures compile-time failure if the SDK later adds required fields.
- Exporting `AppConfig` (capital A) matches the demo; the parent skill registers it by that exact name.

## Record the target with the application

`config.ts` tells the running application which project to talk to. It does not tell the tooling — a clone on another machine resolves whatever that machine happens to have mapped, which is how a generated app and the tools that maintain it end up pointed at different projects. Offer to record it alongside the code, in one line, and run it if the user agrees:

```bash
npx -y @formio/mcp@0.10.0 project set --project-url "<the Project URL you just wrote>" --scope repo --cwd "<workspace root>"
```

That writes a committed `formio.json` holding the same Project URL, tracked with the application's own source, so every clone and every later skill invocation in that workspace resolves the project this `config.ts` was written for. Pass the **workspace root** as `--cwd` and never an ancestor of it: discovery walks upward, so a file placed above the workspace governs every unrelated project beside it too. Add `--base-url` only if `project get` reported one it could not derive. Skip it silently outside a git repository — nothing would be tracking the file.

## `src/app/app-module.ts` edits

The `AppModule` needs three additions if they are not already present. Edit in place — don't regenerate the whole file.

### 1. Import

At the top of `app-module.ts`, add:

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

This `useValue` form is all that is needed: `FormioModule` reads the provided `FormioAppConfig` in its constructor and calls `Formio.setBaseUrl`/`setProjectUrl` at bootstrap, so the SDK is configured even though `useValue` skips the `FormioAppConfig` constructor. No `forRoot` / `FORMIO_CONFIG` wiring is required.

## The approval gate — preview then approve

Before writing or editing any files, print a diff-style preview:

```
Files to create
  src/app/config.ts  (new file)

Files to edit
  src/app/app-module.ts
    + import { FormioModule, FormioAppConfig } from '@formio/angular';
    + import { AppConfig } from './config';
    + FormioModule added to @NgModule imports
    + { provide: FormioAppConfig, useValue: AppConfig } added to @NgModule providers

Proceed with these writes? (AUTH is next.)
```

Wait for explicit approval. If the user declines, stop — do not write partial state, do not advance to AUTH. The parent skill's `## When to reset to an earlier phase` rule applies if the user wants to re-run SETUP with corrected URLs.

## After approval

Write `config.ts` and edit `app-module.ts`. Then tell the user what was written and what the next phase is:

> Wrote `src/app/config.ts` and updated `src/app/app-module.ts`. Moving to AUTH.

Proceed to `AUTH.md`.
