# CONFIG — `FormioAppConfig` and `AppModule` wiring

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `project_get` (called with `cwd` set to the workspace root) when the Form.io MCP tools are callable by you, and otherwise ask the user for them — see [`project-urls.md`](../formio-mcp-setup/references/project-urls.md). Never compose, derive, or hand-type either one yourself.

This document is loaded by the parent `formio-angular` skill during Phase 3. It is **not** a standalone skill — no frontmatter, no independent trigger. The parent reads it after BOOTSTRAP has left the workspace in place and before AUTH.

**Every path in this document is relative to `workspaceRoot`** — the absolute path Pre-flight captured and SETUP stashed. Read and write them as `<workspaceRoot>/src/app/config.ts`, never against wherever the shell happens to stand. Shell working directories persist between commands in an agent session, and BOOTSTRAP's own commands are written `cd "<workspaceRoot>" && <command>`, which does not carry into this phase — so a bare relative path read here can land in a different tree, report that the file is missing, and write the whole Form.io wiring into a tree nobody will look in.

## Skip-if-already-wired detection

Before generating anything, inspect the target workspace at `workspaceRoot`:

1. Read `src/app/config.ts`. Parse it (even a rough string search is fine) for an exported symbol whose value looks like a `FormioAppConfig` — specifically an object literal with keys `appUrl` and `apiUrl`. Compare those two values against the URLs SETUP resolved from `project_get`. They must agree: if they differ, do NOT skip and do NOT overwrite — surface both pairs and which record each came from, and ask which is correct, per SETUP's "When an existing config.ts disagrees". A silent choice here leaves the application pointed at one deployment while every build-time tool call resolves another.
2. Read `src/app/app-module.ts`. Check for an `import { FormioModule } from '@formio/angular';` line AND a `{ provide: FormioAppConfig, useValue: AppConfig }` (or equivalent) entry in the `providers` array.

If both conditions hold AND the captured `appUrl`/`apiUrl` match the SETUP values, **skip this phase**. Tell the user which files triggered the skip:

> Skipping CONFIG — `src/app/config.ts` already exports `AppConfig` with `appUrl = X, apiUrl = Y`, matching the project this directory resolves to, and `AppModule` already imports `FormioModule` and registers the `FormioAppConfig` provider. Moving to AUTH. Say if you want to regenerate `config.ts` anyway.

If the existing values **disagree** with the SETUP values, do not silently overwrite. SETUP owns this case and has already resolved it — see its "When an existing config.ts disagrees", which gives a different action for each of the two answers the user can give. Reaching CONFIG with the disagreement still open means SETUP's check did not run: go back and run it rather than deciding here, because one of the two answers changes the recorded mapping and this phase cannot do that.

## `src/app/config.ts` template

Write exactly this file, substituting the URLs SETUP resolved from `project_get` for `{projectUrl}` and `{baseUrl}`. Those two values are the ONLY source — never compose, derive, or default either one here, and never carry one over from an earlier session or another project: the mapping the server reports is what the build-time tools resolve, so anything else written into this file is a second, disagreeing record. No comments, no `// TODO`, no extras — the file is tiny and must read identically to the `angular-demo` reference.

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

Write `<workspaceRoot>/formio.json` yourself, holding the same Project URL you just wrote into `config.ts` — the MCP server reads that file and never writes it:

```json
{ "projectUrl": "<the Project URL>" }
```

That committed `formio.json` is tracked with the application's own source, so every clone and every later skill invocation in that workspace resolves the project this `config.ts` was written for. Write it at the **workspace root** and never an ancestor of it: discovery walks upward, so a file placed above the workspace governs every unrelated project beside it too. If a `formio.json` already exists there and holds neither `projectUrl` nor `baseUrl`, it is some other document the server will pass over rather than read — so leave it alone and skip this step rather than adding keys to it. Skip silently outside a git repository too — nothing would be tracking the file.

**Include a `baseUrl` key whenever `project_get` reported a `baseUrlSource` other than `derived`.** A deployment that was recorded rather than derived is not recoverable from the Project URL — that is the whole reason it was recorded — so a `formio.json` carrying `projectUrl` alone leaves a fresh clone, which has no mapping of its own, resolving `base-url-unresolved`. That defeats the reason for writing the file at all. Do not decide this by asking whether the report failed to derive anything: once the value is on record the status is `ok`, and `baseUrlSource` is the only field that says where it came from.

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
