# CONFIG — `src/config.ts` and `FormioProvider`

Generates the application's URL configuration and mounts the provider. Runs on the greenfield chain, and on the existing-application chain only when the inspection found no provider.

## 1. Generate `src/config.ts`

Export the two URLs as an ordinary module, and configure the SDK from them in the same module:

- `projectUrl` — the **Project URL**, the project this application reads and writes.
- `baseUrl` — the **Base URL**, the deployment hosting it.
- After the two exports, call `Formio.setBaseUrl(baseUrl)` and `Formio.setProjectUrl(projectUrl)` at module scope. This is where the SDK globals are set — not in `FormioProvider`. `createBrowserRouter` runs the initial loaders when it is called, before React renders the provider, and `Formio.currentUser()` reads these globals; setting them here, in the module every loader imports, is what makes the ordering hold. See the kernel contract's "URL resolution" section in [`formio-react-resources/references/kernel-contract.md`](./formio-react-resources/references/kernel-contract.md).

Both values come from the `project_get` MCP tool, called with `cwd` set to the workspace root, when the Form.io tools are callable — and from the user when they are not. Never hardcode a value from an example host, never compose one by appending a project name to a deployment URL, and never carry one over from another project or an earlier session. The shapes each URL takes are in [`project-urls.md`](../formio-mcp-setup/references/project-urls.md); this document does not restate them.

**This module is the single source of truth for both URLs.** The provider reads it, and so does the resource kernel — kernel loaders run outside React and cannot read context, so they import this module directly. One module, no divergence, and the SDK is configured as a side effect of importing it.

## 2. Record the target with the application

`src/config.ts` tells the running application which project to talk to. It does not tell the tooling — a clone on another machine resolves whatever that machine happens to have mapped, which is how a generated app and the tools that maintain it end up pointed at different projects. Offer to record it alongside the code, in one line, and run it if the user agrees:

Write `<workspaceRoot>/formio.json` yourself, holding the same Project URL you just wrote into `src/config.ts` — the MCP server reads that file and never writes it:

```json
{ "projectUrl": "<the Project URL>" }
```

That committed `formio.json` is tracked with the application's own source, so every clone and every later skill invocation in that workspace resolves the project this `src/config.ts` was written for. Write it at the **workspace root** and never an ancestor of it: discovery walks upward, so a file placed above the workspace governs every unrelated project beside it too. If a `formio.json` already exists there and holds neither `projectUrl` nor `baseUrl`, it is some other document the server will pass over rather than read — so leave it alone and skip this step rather than adding keys to it. Skip silently outside a git repository too — nothing would be tracking the file.

**Include a `baseUrl` key whenever `project_get` reported a `baseUrlSource` other than `derived`.** A deployment that was recorded rather than derived is not recoverable from the Project URL — that is the whole reason it was recorded — so a `formio.json` carrying `projectUrl` alone leaves a fresh clone, which has no mapping of its own, resolving `base-url-unresolved`. That defeats the reason for writing the file at all. Do not decide this by asking whether the report failed to derive anything: once the value is on record the status is `ok`, and `baseUrlSource` is the only field that says where it came from.

## 3. Mount `FormioProvider`

Mount `<FormioProvider projectUrl={...} baseUrl={...}>` at the application root, above the router, taking both values from `src/config.ts`.

The provider configures the **renderer** — the `Form` component — and exposes authentication state. It also calls the same `set*Url` statics `src/config.ts` already called, which is harmless. It does not configure the kernel's data layer, and the kernel must not depend on the provider having rendered: loaders run before it does.

## 4. When `src/config.ts` already exists

Compare its URLs against what `project_get` reports.

- **They agree** — proceed.
- **They disagree** — stop and ask which is correct, naming both pairs and where each came from. A clone on a fresh machine, a re-pointed project, and a hand edit all produce this, and writing against one while the tools resolve the other is a split brain that surfaces much later.

## Gate

End with the approval gate: the generated or verified config, and the provider mount point. Proceed only on approval.
