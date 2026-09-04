# SETUP — Resolve the Form.io project

This document is loaded by the parent `formio-angular` skill during Phase 1. It is **not** a standalone skill — no YAML frontmatter, no independent trigger. The parent reads it before running the SETUP phase and stops after the approval gate documented below.

## What this phase captures

**First, the workspace root — one absolute path, captured in Pre-flight and reused here.** Every later phase writes files into it, `project_get` takes it as `cwd`, and BOOTSTRAP scaffolds into it. The parent skill's Pre-flight captured it before it inspected anything — the `workspacePath` `formio-application` passed in handoff mode, and otherwise the directory the user invoked the skill from — because Pre-flight's own reads are relative to it. Stash that exact string as `workspaceRoot`. Do NOT re-derive it here: a `pwd` run at this point reports wherever the shell has since been moved to, which is the failure the Pre-flight capture exists to prevent. Shell working directories persist between commands in an agent session, so a `cd` run for any reason earlier in the turn silently retargets every relative path that follows; one captured absolute root is what makes that harmless. If Pre-flight did not run — a resumed session, a direct jump into this phase — capture it now under Pre-flight's own rules, confirming the absolute path with the user rather than trusting where the shell stands, and never let a relative path stand in for it.

Then two URLs that every later phase depends on, read from the MCP server rather than interviewed for. Store both as values the rest of the orchestrator can read — by convention the parent stashes them as `projectUrl` and `baseUrl`, so the same two names flow through CONFIG.md, AUTH.md, and the sub-skill. They are values in your working context, not environment variables: nothing reads them from the environment, and nothing writes them there.

| Name in this skill | Handoff field   | Goes into `config.ts` as |
| ------------------ | --------------- | ------------------------ |
| `workspaceRoot`    | `workspacePath` | — (it is where the file goes) |
| `Project URL`      | `projectUrl`    | `appUrl`                 |
| `Base URL`         | `baseUrl`       | `apiUrl`                 |

The `Project URL` is the full URL of the Form.io project this application reads and writes — the one value anyone supplies. The `Base URL` is the deployment hosting it, and `project_get` normally derives it from the Project URL rather than asking; it is only ever asked for when the Project URL is a plain sub-domain of a customer domain, whose deployment cannot be derived. The Form.io SDK needs both so it knows which project to address AND which platform to fetch auth + tenant metadata from.

## Resolve the two URLs

These two URLs are scoped to the working directory, not to the client install: a Form.io project is one-to-one with the application built against it. Which path you take depends on one thing — whether the Form.io MCP tools are callable by you. The full rules for both are in [`project-urls.md`](../formio-mcp-setup/references/project-urls.md); this phase applies them.

**Path A — the tools are callable.** The server keeps that working-directory scope and is the only thing that knows it, so read that mapping rather than competing with it. Call the `project_get` tool with `cwd` set to `workspaceRoot`. Do not shell out for this: the connected server answers it directly, with the same resolver every other tool uses.

On a status of `ok`, the two URLs it reports ARE the configuration. Confirm them in one line and go to the approval gate:

> Using the Form.io project configured for this directory — `<projectUrl>` on `<baseUrl>`. Say so if you want a different project.

On a status of `not-configured` — nothing is recorded for this directory — relay that message's own instruction, ask the user for the single value it names, record it with `project_set`, and call `project_get` again. On a status of `base-url-unresolved` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask the user for that one value, and do exactly what that message names — a `project_set` call where this directory's own mapping holds the project, and an edit to the committed `formio.json` at the path and key it names where that file holds it, since this server never writes one — which record the deployment goes in depends on which record holds the project — then call again, without re-asking the user for the Project URL the report already named. If the call fails outright instead of returning a status, it could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): relay it and stop rather than interviewing, because `project_set` would fail for the same unreported reason — a broken record is not an absent one. On this path do not compose an interview of your own: the server's message carries the valid URL shapes and the reason a value cannot be guessed.

**Path B — no Form.io tools at all.** Ask the user, applying the same rules from the other side. Do NOT install the MCP server to get past this phase and do not hand off to `formio-mcp-setup` for it: what this phase produces is two values for `src/app/config.ts`, and writing that file reaches no deployment. Ask for the **Project URL** first and alone, derive the **Base URL** from it, and ask for the Base URL only in the one shape where it cannot be derived — [`project-urls.md`](../formio-mcp-setup/references/project-urls.md) has the three project-URL shapes, the derivation table, and the rules that hold on both paths. Confirm the pair in the same one-line form as Path A before the approval gate. Nothing is recorded anywhere on this path; if the user installs the server later, offer once to record the same Project URL with `project_set`.

**Run this even when `formio-application` handed the URLs in.** A handoff is a copy; the mapping is what `@formio/angular` and every later tool call actually resolve against. Confirming costs one tool call and removes the copy.

**Tools present without `project_get` is a third case, and not Path B.** `project_get` shipped after the rest of the Form.io tool surface, so a server exposing those tools without it predates it: if `form_list` and `project_set` are callable and `project_get` is not, hand off to `formio-mcp-setup`, whose "Already connected, but too old" step re-pins the configured version. Judge that on the tool list you can actually call, never on a version number written in prose — the pinned version moves with every release and a sentence naming one does not. Path B is for having no Form.io tools at all. Either way, never report a configuration you did not actually read out of a report.

## When an existing config.ts disagrees

If Phase 0 (pre-flight) read an existing `src/app/config.ts` exporting a `FormioAppConfig`, compare its `appUrl` / `apiUrl` against what `project_get` reported:

- **They match** — nothing to decide; CONFIG will be skipped for that reason.
- **They differ** — stop and ask. Name both pairs and where each came from: `config.ts` is what the application ships with, and the mapping is what every build-time tool call resolves. Writing either one over the other silently leaves the app pointed at one deployment while the tools target another. The user chooses which is correct before anything is written, and each answer has a different action:
  - **"The mapping is right, the app is wrong."** Keep the resolved values and let CONFIG overwrite `config.ts` with them. Nothing else to do.
  - **"The app is right, the mapping is wrong."** The record has to change, and which record decides how. When this directory's own mapping is what `project_get` reported resolving from, record the `config.ts` project with `project_set`, passing `cwd` set to `workspaceRoot` — then call `project_get` again and continue with what it now reports. When a committed `formio.json` is the source, that file is the fix: name its path and its key, and ask the user to change it or confirm you may, because the server reads a committed file and never writes one. Either way re-resolve rather than proceeding on the value you were told is right — the point is that the tools and the app agree afterwards, which only re-reading proves.

  Do not offer "re-run SETUP" as a fix on its own: re-running reads the same unchanged record and returns to this same question.

## The approval gate

Print the resolved values in one block and wait for an explicit `yes`/`approve`/`proceed` response. This phase itself writes nothing to the workspace — but the next one does: BOOTSTRAP scaffolds the tree and edits `angular.json` and `app-module.ts`, so this gate is the last stop before the workspace changes.

```
Form.io deployment
  Project URL (appUrl):  https://<resolved>
  Base URL    (apiUrl):  https://<resolved>

These will be wired into src/app/config.ts (Phase 3: CONFIG) and referenced from
src/app/auth/auth.module.ts (Phase 4: AUTH). Proceed?
```

If the user declines, stop. Do not advance to CONFIG. Do not write partial state. The parent skill's `## When to reset to an earlier phase` rule applies if the user later realizes the project was wrong.

## Never write the mapping by hand

**Never write `~/.formio/projects.json` yourself** — not with a file write, an edit, a heredoc, or `jq`. The `project_set` tool owns that file's shape, its `0600` mode, its merge semantics, and its URL normalization. This phase writes through that tool or not at all.

## Where to stash the resolved values

Keep three things in the parent orchestrator's working context: the two URLs as `projectUrl` and `baseUrl`, and `baseUrlSource` — the field of the `project_get` report that says where the Base URL came from (`derived` or otherwise). CONFIG reads `baseUrlSource` to decide whether the committed `formio.json` needs a `baseUrl` key, and by then the report itself is gone. On the no-tools path there is no report and no such field: treat a Base URL the user supplied as not derived, because a value they had to type is by definition one nothing could derive. `CONFIG.md` consumes the two URLs directly to populate `appUrl` and `apiUrl` in the `config.ts` template. `AUTH.md` references the project URL when describing how `FormioAuthConfig` picks up the project context.

Write these values into no project file other than the eventual `src/app/config.ts` — no dotfile, no `.env`, no `appsettings.json`. The Angular application reads them at runtime from the `FormioAppConfig` provider.
