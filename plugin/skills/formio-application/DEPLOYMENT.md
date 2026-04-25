# DEPLOYMENT — Base URL + Project URL interview

This document is loaded by the parent `formio-application` skill during Step 3 on the build-new branch. It is **not** a standalone skill — no frontmatter.

## What this step captures

Two URLs that Step 4 (MCP Config), Step 5 (Import), and the Step 6 framework handoff all depend on. Stash them under the variable names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` so downstream steps and the framework-specific SETUP phase can read them without another round of questions.

| Name in this skill | Variable              | Example (hosted)            | Example (self-hosted)             |
| ------------------ | --------------------- | --------------------------- | --------------------------------- |
| **Base URL**       | `FORMIO_BASE_URL` | `https://api.form.io`       | `https://forms.acme-corp.com`     |
| **Project URL**    | `FORMIO_PROJECT_URL`  | `https://mycompany.form.io` | `https://forms.acme-corp.com/crm` |

### Plain-language descriptions

When asking the user, use descriptions that do NOT assume they know "project" vs. "deployment" vocabulary:

- **Base URL** — "The Form.io deployment your project lives on. If you are using the hosted Form.io cloud, this is `https://api.form.io`. If your team self-hosts Form.io, this is the address of your platform (e.g., `https://forms.acme-corp.com`). This is the platform, not the specific project."
- **Project URL** — "The full URL of the specific Form.io project this template will be imported into and the app will talk to. Example: `https://mycompany.form.io` for a hosted project, or `https://forms.acme-corp.com/crm` for a self-hosted project identified by a path. The project must already exist — we do not create it."

## Run the interview — one batched `AskUserQuestion`

Put both URL questions in a single `AskUserQuestion` call. Do not split into two rounds; two sequential prompts feel like peppering and one batched call reads like a form.

```
AskUserQuestion({
  questions: [
    {
      question: "What is the Form.io Base URL? (the deployment your project lives on)",
      header: "Base URL",
      multiSelect: false,
      options: [
        { label: "https://api.form.io", description: "Hosted Form.io cloud" },
        { label: "https://<your-self-hosted-host>", description: "Your team's self-hosted Form.io deployment" }
      ]
    },
    {
      question: "What is the Form.io Project URL? (the specific project this app will use)",
      header: "Project URL",
      multiSelect: false,
      options: [
        { label: "https://<your-project>.form.io", description: "Hosted project — pick this if your Base URL is https://api.form.io" },
        { label: "https://<platform-host>/<project-name>", description: "Self-hosted project addressed by a path under your platform" }
      ]
    }
  ]
})
```

The user will typically pick "Other" and type their actual URL — that is expected.

## Validation

After capture, before handing control to Step 4 (MCP Config):

1. **Scheme.** Both URLs SHOULD begin with `https://`. Warn on `http://` (accept for local dev but call it out).
2. **Trailing slash.** Strip trailing `/` from both URLs. Double slashes break `@formio/angular`'s internal path joining.
3. **Reachability is NOT required.** Do not make network requests to check resolvability. The user may be offline, behind a VPN, or addressing a project that has not been deployed yet.
4. **Sanity.** Flag if `Project URL == Base URL` — usually means the user gave the base URL twice. Confirm before proceeding.

## Skip conditions

Skip this step entirely when:

- Intent is **modify-existing** — the workspace already has URLs wired in `FormioAppConfig`. The orchestrator reads them from `src/app/config.ts` (or the framework-specific equivalent) and stashes them as if Deployment had just run. Both Step 5 (Import) and Step 6 (Framework routing) consume them from that stash.
- The user's opening message already contained both URLs in a recognizable form (rare, but honor it).

## What to stash for later steps

```
FORMIO_PROJECT_URL = <captured Project URL with no trailing slash>
FORMIO_BASE_URL = <captured Base URL with no trailing slash>
```

Step 4 (MCP Config — see [`MCP_CONFIG.md`](./MCP_CONFIG.md)) writes these into `./.mcp.json` under the keys `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`. Note the naming shift: this skill's internal state uses `FORMIO_BASE_URL` for the platform deployment URL, but the env-var key written to `.mcp.json` is `FORMIO_BASE_URL` (two names for the same concept — `MCP_CONFIG.md` documents the mapping). Step 5 (Import) passes the Project URL to `project_import` — the first authenticated MCP call, which triggers the portal-login flow on a JWT cache miss. The framework handoff (Step 6) passes both URLs to the framework's SETUP so its URL interview is skipped.

---

## Plugin mode — alternative branch

Everything above describes the standalone (`.mcp.json`) path. When the `@formio/ai` Claude Code plugin is active, the `verify-project-url` hook gates each cwd on a mapping in `~/.formio/projects.json`, and this step runs a different interview and persists the choice via `project_set` instead of through `.mcp.json`.

### Detection — when to take this branch

Take the plugin branch if ANY of the following are true at the start of Step 3:

- The `verify-project-url` hook has injected a "No project mapped for `<cwd>`…" message into the session (via `SessionStart` `additionalContext` or a `PreToolUse` `permissionDecisionReason`). The presence of that string is conclusive proof the plugin's hook is live.
- Form.io MCP tools are exposed under the `mcp__plugin_formio-ai_formio-mcp__*` namespace (e.g., `mcp__plugin_formio-ai_formio-mcp__project_set`) rather than bare `formio-mcp`.

Otherwise, fall back to the standalone branch above — capture both URLs via the batched interview and let Step 4 (MCP Config) write them into `./.mcp.json`.

### Source of the default

The hook injects an `additionalContext` or `permissionDecisionReason` string of the form:

> No project mapped for `<cwd>`. AskUserQuestion: 'Use default (`<url>`)' or 'Other'. Then project_set({ cwd, projectUrl }), then retry.

The `<url>` in that message is `FORMIO_DEFAULT_PROJECT_URL` as seen by the hook. Treat it as the authoritative default — do NOT re-prompt for a Base URL, and do NOT construct defaults from environment variables yourself. If no default appears (the hook falls back to "AskUserQuestion for URL" with no default), skip straight to the "Define a new project URL" option.

### Run the interview — one `AskUserQuestion`

First-time-in-this-cwd only. If `~/.formio/projects.json` already maps the cwd, the hook exits silently and this step is skipped entirely.

**Option order is intent-dependent.** On the **build-new** branch, the default project is almost always the wrong target — a new app should land in a fresh, empty Form.io project, not additively merge on top of the user's default scratch/authoring project. So on build-new, put "Define a new project URL" first (recommended) and demote the default to second. On **modify-existing**, this step is skipped entirely.

```
// build-new — new project first (recommended), default second
AskUserQuestion({
  questions: [
    {
      question: "Which Form.io project should this app use?",
      header: "Project URL",
      multiSelect: false,
      options: [
        {
          label: "Define a new project URL (Recommended)",
          description: "Target a fresh, empty Form.io project for this new app. Avoids merging the new resources on top of whatever is already in the default project."
        },
        {
          label: "Use default (<FORMIO_DEFAULT_PROJECT_URL from hook>)",
          description: "Import into the plugin's configured default project. Only pick this if the default is empty or you intentionally want to merge this app's resources into it."
        }
      ]
    }
  ]
})
```

- **Define a new project URL / Other** → the user types the full project URL. Stash as `FORMIO_PROJECT_URL`.
- **Use default** → stash `FORMIO_PROJECT_URL = <default from hook>`.

### Derive `FORMIO_BASE_URL`

Parse `FORMIO_PROJECT_URL` and set `FORMIO_BASE_URL` to its origin — scheme, host, and port only; no path. Examples:

| `FORMIO_PROJECT_URL`                     | Derived `FORMIO_BASE_URL`         |
| ---------------------------------------- | --------------------------------- |
| `https://api.form.io/my-project`         | `https://api.form.io`             |
| `https://mycompany.form.io`              | `https://mycompany.form.io`       |
| `https://forms.acme-corp.com/crm`        | `https://forms.acme-corp.com`     |
| `http://localhost:3000/authoring-abc123` | `http://localhost:3000`           |

Do not ask the user to confirm the derivation.

### Persist the mapping

After capture (and only after capture succeeds), call the MCP tool:

```
project_set({ cwd: <workspace cwd>, projectUrl: <FORMIO_PROJECT_URL> })
```

This writes `~/.formio/projects.json` so future sessions in this cwd skip the prompt. `project_set` is exempt from the hook gate, so it can run even while the cwd is unmapped.

### Hard rule — `~/.formio/projects.json` is owned by `project_set`

**Never write `~/.formio/projects.json` by hand.** Not with `Write`, not with `Edit`, not with a shell heredoc (`cat > ... <<EOF`), not with `jq`, not with any other means. The only tool permitted to create, update, or repair this file is the `project_set` MCP tool.

Why: the file's shape, file-mode (`0o600`), and merge semantics are owned by the MCP server. Hand-editing can produce a file the hook reads successfully but the server refuses to write to later, leaving the user in a half-mapped state. `project_set` is also the single place where the URL is normalized (trailing-slash stripping, http/https validation) — hand-editing bypasses that and lets malformed URLs reach downstream tools.

If `project_set` appears to fail or no-op unexpectedly:

1. Check its response text. A "no change / already persisted" message means the on-disk mapping for this cwd already matches — nothing is broken.
2. Verify the file exists: `ls -la ~/.formio/projects.json`. If it is missing, call `project_set` again — the tool creates both the directory and the file.
3. If the tool genuinely errors, surface the error to the user and stop. Do NOT hand-write the file as a workaround. Report the failure so it can be fixed at the tool layer, not papered over per-session.

This rule applies to every step in this skill and to any other skill that needs to persist a cwd→projectUrl mapping.

### Skip conditions (plugin mode)

In addition to the standalone skip conditions above, skip this step entirely when the cwd is already mapped in `~/.formio/projects.json` — the verify-project-url hook is silent, which means a mapping exists. Read `FORMIO_PROJECT_URL` from the hook's injected context (or from a prior `project_set` result) and derive `FORMIO_BASE_URL` as above. No prompt needed.
