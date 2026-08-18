# SETUP — URL Interview

This document is loaded by the parent `formio-angular` skill during Phase 1. It is **not** a standalone skill — no YAML frontmatter, no independent trigger. The parent reads it before running the SETUP phase and stops after the approval gate documented below.

## What this phase captures

Two URLs that every later phase depends on. Store both as values the rest of the orchestrator can read — by convention the parent stashes them under the variable names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`, matching the MCP server's environment-variable contract so the same identifiers flow through CONFIG.md, AUTH.md, and the sub-skill.

| Name in this skill | Env-var name the MCP uses | Goes into `config.ts` as | Example |
| --- | --- | --- | --- |
| `Project URL` | `FORMIO_PROJECT_URL` | `appUrl` | `https://abc.form.io` |
| `Base URL` | `FORMIO_BASE_URL` | `apiUrl` | `https://api.form.io` |

The `Project URL` is the user's project API root — where forms and submissions live. The `Base URL` is the Form.io platform deployment that hosts the project. The Form.io SDK needs both so it knows which project to address AND which platform to fetch auth + tenant metadata from.

## First — resolve the project already mapped to this directory

These two URLs are scoped to the working directory, not to the client install: a Form.io project is one-to-one with the application built against it. The MCP server already keeps that scope — `project_set` maps a directory to a Project URL plus a Base URL, and every tool resolves it on each call. This phase reads that mapping instead of competing with it.

Before interviewing, check whether this directory is already mapped. `project_set` is the writer, and either the tool's own report or `npx -y @formio/mcp@0.10.0 project get --cwd <workspace cwd>` tells you what resolves and which source supplied it. Empty output is not a mapping: an `@formio/mcp` older than 0.9.0 has no `project` command and exits 0 printing nothing, whatever is mapped. If a project is mapped, confirm in one line and skip the interview:

> Using the Form.io project already configured for this directory — `<FORMIO_PROJECT_URL>` on `<FORMIO_BASE_URL>`. Say so if you want a different project.

Stash both values exactly as if the interview had run, and go straight to the approval gate. Re-asking for something an earlier session already answered is the single most common way this flow feels broken — and if the answer differs, `src/app/config.ts` and the MCP tools end up pointed at two different projects.

Branch on the exit code rather than on empty output alone: `0` resolved something (read the `Source:` line — a value the mapping did not supply still needs `project_set`), `1` means nothing is mapped so interview — unless stderr carries `npm error`, which means `npx` never fetched the server and nothing was checked — and `2` means the command ran and failed (an unreadable `~/.formio/projects.json`, a malformed entry). On a `2`, report the stderr and stop: `project_set` writes through the same file and fails identically, so interviewing hides the cause. [`formio-application/DEPLOYMENT.md`](../formio-application/DEPLOYMENT.md) owns the full table and the `Source:` rules.

When `formio-application` handed off to this skill, Step 3 (Deployment) already captured and persisted both values; treat them as mapped and do not re-ask.

## When to skip the interview

- **Values already in the workspace.** If Phase 0 (pre-flight) read an existing `src/app/config.ts` that already exports a `FormioAppConfig` with `appUrl` and `apiUrl` set, skip the interview. Surface the found values to the user: "I found `appUrl = X, apiUrl = Y` in `src/app/config.ts`. Using those — say if you want to change them." Advance to the approval gate with the existing values pre-filled.
- **User already told you.** If the conversation already contains the URLs (e.g., the user said "build an Angular app against `https://abc.form.io` on `https://api.form.io`"), skip the question and advance directly to the approval gate.
- **A planner `template.json` was imported from a known platform.** The `template.json` name is the project machine name, but the deployment host is not inside it — still ask for the `Base URL` in that case; don't assume `https://api.form.io`.

Otherwise, run the interview.

## Run the interview — one batched question

**Ask for both URLs in ONE question round,** using the client's structured question mechanism (in Claude Code, `AskUserQuestion`). Do not split them into two prompts: two sequential prompts feel like peppering, and one round reads as a form. If your client's mechanism supports several questions per round, that is exactly what to use.

The round asks two questions:

1. **Project URL** — "What is the Form.io Project URL? (the API root of your project)", offering `https://<your-project>.form.io` described as "Hosted Form.io SaaS — your project name as a subdomain", `https://<your-project>.<your-domain>` described as "Self-hosted / enterprise deployment that routes projects to subdomains of your own domain", and `https://<platform-host>/<project-name>` described as "Self-hosted / enterprise deployment that routes projects to sub-directories of the platform host".
2. **Base URL** — "What is the Form.io Base URL? (the platform deployment hosting your project)", offering `https://api.form.io` described as "The hosted Form.io SaaS — always this exact value" and `https://<your-platform-host>` described as "Self-hosted or enterprise platform, often a subdomain of your own domain such as https://forms.mysite.com".

Neither question is single-choice in practice: the options are shapes to recognize, not real URLs, so the user will normally type their own. Make sure a free-text answer is possible alongside the fixed options.

## Validate the URLs

After capture, before the approval gate, run these checks:

1. **Scheme.** Both URLs should begin with `https://`. Warn if `http://` — acceptable for local dev but not for production.
2. **Trailing slash.** Strip any trailing `/` from both URLs. `@formio/angular`'s internal path joining breaks on double slashes.
3. **Reachability is NOT required.** Do not make any network requests to check whether the URLs resolve. The user may be working offline, behind a VPN, or against a project that isn't deployed yet. Validate syntax only.
4. **Sanity.** If `Project URL == Base URL` exactly, flag it — that usually means the user gave the base URL twice. Confirm before proceeding.
5. **Shape agreement.** There are three valid pairs, and the Base URL never carries a path in any of them:
   - **Hosted SaaS** — the Base URL is **always** `https://api.form.io` and the project is a subdomain of `form.io` (`https://examples.form.io`). A `*.form.io` host is never a Base URL, not even the project's own. If a `*.form.io` Project URL arrived with some other Base URL, correct it to `https://api.form.io` and say so at the gate.
   - **Self-hosted, sub-domain project routing** — the Base URL is the platform host (`https://forms.mysite.com`) and the project is a sibling subdomain of the same parent domain (`https://myproject.mysite.com`). The hosts differ by design; check only that they share a parent domain, and never derive one from the other.
   - **Self-hosted, sub-directory project routing** — the Base URL is the platform host (`https://forms.mysite.com`) and the project is a path under that exact origin (`https://forms.mysite.com/myproject`).

   Flag it only when none of the three fits — then ask which value is wrong rather than repairing one at random.

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

## Persist the mapping before CONFIG

Once the gate is approved and the values did NOT come from an existing mapping, persist them so the MCP tools and the application agree on one project:

```
project_set({ cwd: <workspace cwd>, projectUrl: <FORMIO_PROJECT_URL>, baseUrl: <FORMIO_BASE_URL> })
```

Always pass `cwd` — without it the mapping is keyed to the MCP server's own working directory, which is not where the user is. Always pass `baseUrl` alongside the project URL: it builds the portal-login URL and keys the cached token, so a self-hosted project mapped without it logs in against the wrong deployment.

Skip this call when the values came from the directory mapping in the first place (nothing changed), or when the user's answers came from an existing `src/app/config.ts` and already match what the mapping resolves. If they came from `config.ts` and differ from the mapping, ask which project is correct before writing anything — do not silently re-point either side.

**Never write `~/.formio/projects.json` by hand** — not with a file write, an edit, a heredoc, or `jq`. `project_set` (the tool) and `formio-mcp project set` (the command) own that file's shape, its `0600` mode, its merge semantics, and its URL normalization.

## Where to stash the captured values

Keep the two URLs in the parent orchestrator's working context under the names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL`. `CONFIG.md` consumes them directly to populate `appUrl` and `apiUrl` in the `config.ts` template. `AUTH.md` references the project URL when describing how `FormioAuthConfig` picks up the project context.

Write these values into no project file other than the eventual `src/app/config.ts` — no dotfile, no `.env`, no `appsettings.json`. The Angular application reads them at runtime from the `FormioAppConfig` provider. The one exception is the directory mapping above, and that is written only through `project_set`, never by editing a file.
