# IMPORT — Call `project_import`

> **`FormioAppConfig` renames both URLs.** `appUrl` is the **Project URL** — the project this application reads and writes, and the one value anyone supplies. `apiUrl` is the **Base URL** — the deployment hosting it, which is normally derived from the Project URL rather than supplied. Take both from `npx -y @formio/mcp@0.10.0 project get --cwd "<workspace root>"`; never compose, derive, or hand-type either one yourself.

This document is loaded by the parent `formio-application` skill during Step 3. It is **not** a standalone skill — no frontmatter.

## What this covers

- **Step 3:** present an import-confirmation preview, invoke the `project_import` MCP tool, handle the three error branches.

Step 3 runs on BOTH branches of the orchestrator:

- **Build-new** → directly after Step 2 (Plan), in the same invocation. The Preflight mapped this working directory to the target project, and every tool resolves that mapping on each call, so the project is already live here — there is nothing to reload. Import pushes the full-project `template.json` into a (presumably empty) project.
- **Modify-existing** → directly after Step 2 (Plan) as well. Import pushes the delta `template.json` (only the new resources / fields / actions) into the existing project, which merges additively on top of what is already there.

## Authentication is implicit

There is no named `authenticate` step. The `project_import` MCP call itself is the first authenticated operation in the flow. If a valid JWT is already cached, the call proceeds silently. If no JWT is cached, the MCP server triggers the browser-based portal-login flow automatically; the user signs in, the JWT is cached, and the import call resumes transparently.

### Before calling `project_import` — warn about the browser

Tell the user in one short paragraph BEFORE calling the tool, so a browser window opening mid-call is not surprising:

> I'm about to import the template into your Form.io project. If you are not already signed in on this machine, a browser window will open and ask you to sign in to `<projectUrl>`. Once you log in, the import continues automatically. If you are already signed in (valid cached session), this happens silently.

### Headless-environment fallback

If the environment cannot open a browser (e.g., SSH session without display forwarding, CI, containerized dev environment), the MCP server's auth flow prints the portal-login URL to the console. Watch for that URL and surface it to the user:

> I cannot open a browser window in this environment. Open this URL in your own browser to sign in, then return here: `<printed login URL>`

Detection hint: `process.env.DISPLAY === ""` on Linux, or failing `open` / `xdg-open` on macOS / Linux. Do not over-engineer — if the browser fails to open, the auth flow's own error will surface the URL; pass it through.

## Step 3 — Import

### The offer-to-import gate

Before any import work, ask whether to import at all.

**Build-new:**

> I have the plan ready — the planner wrote `template.md` (architectural intent) and `template.json` (the Form.io structure). Do you want me to import `template.json` into your Form.io project now? (You can also skip this step and import later yourself, or build the framework app against a project you have already set up. `template.md` stays on disk regardless — it is the seed document the framework skill reads.)

**Modify-existing:**

> I have the delta plan ready — the planner wrote a delta `template.md` (architectural intent for the additions) and a delta `template.json` containing ONLY the new resources and actions for this feature. Do you want me to additively import `template.json` into your existing Form.io project now? (You can also skip this and import manually later; the framework wiring in Step 4 can still proceed, but the wired UI will 404 until the import runs. `template.md` stays on disk regardless — the framework extend sub-skill reads it for intent.)

If the user declines, mark the Import step skipped and advance to Step 4 (Framework routing). Do not call `project_import`.

### The confirmation preview

If the user accepts, print a preview BEFORE calling the tool.

**Build-new:**

```
About to import `template.json` into:

  Base URL:    <baseUrl>
  Project:     <projectUrl>

Template contents:
  - <N> resources: <first-three names>, ...
  - <M> roles:     <role names>
  - <K> forms:     <first-three form names>, ...

WARNING: import merges into the existing project. Any existing resources,
forms, or actions in this project with the same machine name will be
overwritten. Consider running `project_export` first to snapshot the
current state of the project.

Proceed with the import?
```

**Modify-existing:**

```
About to ADDITIVELY import delta `template.json` into:

  Base URL:    <baseUrl>
  Project:     <projectUrl>

Delta contents (new resources only):
  - <N> resources: <names>
  - <M> actions:   <names>

Import is additive: existing resources, forms, and actions in your project
are preserved. Same-machine-name items would be overwritten — the planner
uses new names for new features, so collisions are rare, but review the
names above before approving.

Proceed with the additive import?
```

Wait for explicit approval. Declining returns to the skip path (Step 4 next, no import).

### Call `project_import`

On approval, invoke the MCP tool with the template content loaded from the planner's `template.json` file path. Pass `cwd` — the same working directory the Preflight mapped. Every project-scoped tool resolves its project from that mapping, and omitting `cwd` resolves against the MCP server's own working directory instead, which is fixed at spawn: at best the import fails with "No Form.io project is configured", at worst it merges the template into whatever project that other directory is mapped to.

```
mcp__formio-mcp__project_import({ cwd: <workspace cwd>, template: <the template object> })
```

The tool returns the server's response text on success. Surface it to the user in one sentence ("Imported X resources, Y roles, Z forms into `<project URL>`.") and advance to the config check.

### Post-import — project public config for `{{ config.<key> }}` tokens

Any `{{ config.<key> }}` token in an email template, subject, or other server-rendered string reads from the **project's public configuration**. If the key is absent from the project config, the token renders empty (e.g. an email's "return to app" link ships blank). The importer does NOT populate this — you must set it.

After a successful import, scan the imported `template.json` for `{{ config.<something> }}` tokens (commonly `{{ config.appUrl }}` in Email actions). For each distinct key found:

1. Ask the user for its value (e.g. "What URL should emails link back to? This is your deployed app's address."). Do not guess. If the user is building a 'localhost' application, then use the correct localhost url and inform the user that this will need to be changed when the application is published to a live environment.
2. `PUT` the merged config to the project endpoint:

   ```jsonc
   // PUT <projectUrl>
   { "config": { "appUrl": "<value the user gave>" /* , other keys */ } }
   ```

   `config` merges into the project's existing public configuration. Send all discovered keys in one PUT.

If no `{{ config.* }}` tokens are present, skip this step. Then advance to Step 4.

### Error branches

Three failure modes. Handle each explicitly; do not silently retry or swallow errors.

#### 1. Auth failure (401/403)

The cached JWT was invalid or rejected, or the portal-login flow was interrupted. The MCP server will already have attempted a fresh portal-login; if that failed too, the tool call errors out. Offer the user three choices:

1. Re-enter the Base URL / Project URL (maybe they gave the wrong one).
2. Skip import and continue to Step 4 — the framework app can still be scaffolded/extended against any existing project whose resources are already set up out-of-band.
3. Bail out of the whole flow.

#### 2. Project not found (404)

The project URL did not resolve. Tell the user plainly and offer:

1. Re-enter the Project URL (typo case).
2. Skip import and continue to Step 4.
3. Bail out.

**Do NOT** auto-create the project. If the user needs to create one, point them at the `formio-api` skill (platform-projects reference): "You can create a new project via the `formio-api` skill's `platform-projects` reference, then re-run this flow once it exists."

#### 3. Import validation failure (400)

The server rejected the template. Surface the server's error message verbatim (it usually identifies the offending resource / form / field). Offer:

1. Re-run the planner to fix the template — the user can describe the issue and the planner can revise.
2. Skip import and continue to Step 4 with the already-emitted `template.json` as a local artifact.
3. Bail out.

## What Step 3 hands to Step 4

On successful import, Step 4 receives:

- `projectUrl`, `baseUrl` (as reported by the Preflight's `project get`, on both branches).
- Path to `template.md` on disk (planner wrote it; still there — architectural-intent seed for the framework skill).
- Path to `template.json` on disk (planner wrote it; still there — structured companion).
- A flag: "import succeeded".
- For modify-existing: the list of newly-imported resource names (so the framework's extend sub-skill scaffolds modules for exactly those).

On skipped import (user declined or error branch chose skip), Step 4 receives the same values but with the flag set to "import skipped". Downstream framework SETUP confirms the configuration against `project get` either way — it never interviews for it, so a skipped import changes nothing about how the framework skill resolves the project.

On "bail out", the flow stops. Partial state: the planner's `template.md` + `template.json` pair still exists on disk (by design — they are artifacts the user can use later). Nothing has been written to the Form.io project on the server.
