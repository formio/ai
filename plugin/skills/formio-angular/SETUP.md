# SETUP — URL Interview

This document is loaded by the parent `formio-angular` skill during Phase 1. It is **not** a standalone skill — no YAML frontmatter, no independent trigger. The parent reads it before running the SETUP phase and stops after the approval gate documented below.

## What this phase captures

Two URLs that every later phase depends on. Store both as values the rest of the orchestrator can read — by convention the parent stashes them under the variable names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`, matching the MCP server's environment-variable contract so the same identifiers flow through CONFIG.md, AUTH.md, and the sub-skill.

| Name in this skill | Env-var name the MCP uses | Goes into `config.ts` as | Example               |
| ------------------ | ------------------------- | ------------------------ | --------------------- |
| `Project URL`      | `FORMIO_PROJECT_URL`      | `appUrl`                 | `https://abc.form.io` |
| `Base URL`         | `FORMIO_BASE_URL`     | `apiUrl`                 | `https://api.form.io`     |

The `Project URL` is the user's project API root — where forms and submissions live. The `Base URL` is the Form.io platform deployment that hosts the project. The Form.io SDK needs both so it knows which project to address AND which platform to fetch auth + tenant metadata from.

## When to skip the interview

- **Values already in the workspace.** If Phase 0 (pre-flight) read an existing `src/app/config.ts` that already exports a `FormioAppConfig` with `appUrl` and `apiUrl` set, skip the interview. Surface the found values to the user: "I found `appUrl = X, apiUrl = Y` in `src/app/config.ts`. Using those — say if you want to change them." Advance to the approval gate with the existing values pre-filled.
- **User already told you.** If the conversation already contains the URLs (e.g., the user said "build an Angular app against `https://abc.form.io` on `https://api.form.io`"), skip the question and advance directly to the approval gate.
- **A planner `template.json` was imported from a known platform.** The `template.json` name is the project machine name, but the deployment host is not inside it — still ask for the `Base URL` in that case; don't assume `https://api.form.io`.

Otherwise, run the interview.

## Run the interview — one batched question

**Issue a single `AskUserQuestion` call that asks for both URLs in one round.** Do not split them into two prompts. Two sequential prompts feel like peppering; one batched prompt reads as a form. The `AskUserQuestion` tool supports multiple questions in one call — use that.

```
AskUserQuestion({
  questions: [
    {
      question: "What is the Form.io Project URL? (the API root of your project)",
      header: "Project URL",
      options: [
        { label: "https://<your-project>.form.io", description: "Default hosted Form.io projects" },
        { label: "https://<platform-host>/<project-name>", description: "Self-hosted / enterprise deployment where the project is a path on the platform host" }
      ],
      multiSelect: false
    },
    {
      question: "What is the Form.io Base URL? (the platform deployment hosting your project)",
      header: "Base URL",
      options: [
        { label: "https://api.form.io", description: "The standard hosted Form.io platform" },
        { label: "https://<your-platform-host>", description: "Self-hosted or enterprise platform" }
      ],
      multiSelect: false
    }
  ]
})
```

The user will typically pick "Other" and type their actual URL — that is expected and fine.

## Validate the URLs

After capture, before the approval gate, run these checks:

1. **Scheme.** Both URLs should begin with `https://`. Warn if `http://` — acceptable for local dev but not for production.
2. **Trailing slash.** Strip any trailing `/` from both URLs. `@formio/angular`'s internal path joining breaks on double slashes.
3. **Reachability is NOT required.** Do not make any network requests to check whether the URLs resolve. The user may be working offline, behind a VPN, or against a project that isn't deployed yet. Validate syntax only.
4. **Sanity.** If `Project URL == Base URL` exactly, flag it — that usually means the user gave the base URL twice. Confirm before proceeding.

## The approval gate

Print the captured values in one block and wait for an explicit `yes`/`approve`/`proceed` response. Do not write any files yet — CONFIG is the first phase that touches the disk.

```
Form.io deployment
  Project URL (appUrl):  https://<captured>
  Base URL    (apiUrl):  https://<captured>

These will be wired into src/app/config.ts (Phase 3: CONFIG) and referenced from
src/app/auth/auth.module.ts (Phase 4: AUTH). Proceed?
```

If the user declines, stop. Do not advance to CONFIG. Do not write partial state. The parent skill's `## When to reset to an earlier phase` rule applies if the user later realizes the URLs were wrong.

## Where to stash the captured values

Keep the two URLs in the parent orchestrator's working context under the names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`. `CONFIG.md` consumes them directly to populate `appUrl` and `apiUrl` in the `config.ts` template. `AUTH.md` references the project URL when describing how `FormioAuthConfig` picks up the project context.

Do not persist these values to disk outside of the eventual `src/app/config.ts` — there is no separate dotfile, no `.env`, no `appsettings.json`. The Angular application reads them at runtime from the `FormioAppConfig` provider.
