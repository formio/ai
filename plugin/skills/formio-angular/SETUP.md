# SETUP — Resolve the Form.io project

This document is loaded by the parent `formio-angular` skill during Phase 1. It is **not** a standalone skill — no YAML frontmatter, no independent trigger. The parent reads it before running the SETUP phase and stops after the approval gate documented below.

## What this phase captures

Two URLs that every later phase depends on, read from the MCP server rather than interviewed for. Store both as values the rest of the orchestrator can read — by convention the parent stashes them as `projectUrl` and `baseUrl`, so the same two names flow through CONFIG.md, AUTH.md, and the sub-skill. They are values in your working context, not environment variables: nothing reads them from the environment, and nothing writes them there.

| Name in this skill | Handoff field | Goes into `config.ts` as |
| ------------------ | ------------- | ------------------------ |
| `Project URL`      | `projectUrl`  | `appUrl`                 |
| `Base URL`         | `baseUrl`     | `apiUrl`                 |

The `Project URL` is the full URL of the Form.io project this application reads and writes — the one value anyone supplies. The `Base URL` is the deployment hosting it, and `project get` normally derives it from the Project URL rather than asking; it is only ever asked for when the Project URL is a plain sub-domain of a customer domain, whose deployment cannot be derived. The Form.io SDK needs both so it knows which project to address AND which platform to fetch auth + tenant metadata from.

## Ask the server, do not interview

These two URLs are scoped to the working directory, not to the client install: a Form.io project is one-to-one with the application built against it. The MCP server already keeps that scope and is the only thing that knows it, so this phase reads that mapping rather than competing with it:

```bash
npx -y @formio/mcp@0.11.0 project get --cwd "<workspace cwd>"
```

On a zero exit, the two URLs it prints ARE the configuration. Confirm them in one line and go to the approval gate:

> Using the Form.io project configured for this directory — `<projectUrl>` on `<baseUrl>`. Say so if you want a different project.

On exit `1` — nothing is recorded for this directory — relay that message's own instruction, ask the user for the single value it names, run the `project set` command it names, and re-run. On exit `3` the project IS recorded and one named value is still missing — the Base URL, for a project URL that names no deployment of its own: relay that message the same way, ask for that one value, run the `project set --base-url` command it names, and re-run, without re-asking for the Project URL that message deliberately does not request. On exit `2` the command could not answer at all (an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL): relay it and stop rather than interviewing, because `project set` would fail for the same unreported reason. Either way, do not compose an interview of your own: the server's message carries the valid URL shapes and the reason a value cannot be guessed, and it is the single copy of that guidance.

**Run this even when `formio-application` handed the URLs in.** A handoff is a copy; the mapping is what `@formio/angular` and every later tool call actually resolve against. Confirming costs one command and removes the copy.

**Empty output is not a mapping.** An `@formio/mcp` older than 0.9.0 has no `project` command and exits 0 printing nothing, whatever is mapped — so never report a configuration you did not read in the output.

## When an existing config.ts disagrees

If Phase 0 (pre-flight) read an existing `src/app/config.ts` exporting a `FormioAppConfig`, compare its `appUrl` / `apiUrl` against what `project get` reported:

- **They match** — nothing to decide; CONFIG will be skipped for that reason.
- **They differ** — stop and ask. Name both pairs and where each came from: `config.ts` is what the application ships with, and the mapping is what every build-time tool call resolves. Writing either one over the other silently leaves the app pointed at one deployment while the tools target another. The user chooses which is correct before anything is written.

## The approval gate

Print the resolved values in one block and wait for an explicit `yes`/`approve`/`proceed` response. Do not write any files yet — CONFIG is the first phase that touches the disk.

```
Form.io deployment
  Project URL (appUrl):  https://<resolved>
  Base URL    (apiUrl):  https://<resolved>

These will be wired into src/app/config.ts (Phase 3: CONFIG) and referenced from
src/app/auth/auth.module.ts (Phase 4: AUTH). Proceed?
```

If the user declines, stop. Do not advance to CONFIG. Do not write partial state. The parent skill's `## When to reset to an earlier phase` rule applies if the user later realizes the project was wrong.

## Never write the mapping by hand

**Never write `~/.formio/projects.json` yourself** — not with a file write, an edit, a heredoc, or `jq`. `project_set` (the tool) and `formio-mcp project set` (the command) own that file's shape, its `0600` mode, its merge semantics, and its URL normalization. This phase writes through those commands or not at all.

## Where to stash the resolved values

Keep the two URLs in the parent orchestrator's working context as `projectUrl` and `baseUrl`. `CONFIG.md` consumes them directly to populate `appUrl` and `apiUrl` in the `config.ts` template. `AUTH.md` references the project URL when describing how `FormioAuthConfig` picks up the project context.

Write these values into no project file other than the eventual `src/app/config.ts` — no dotfile, no `.env`, no `appsettings.json`. The Angular application reads them at runtime from the `FormioAppConfig` provider.
