---
name: formio-mcp-setup
description: >-
  Connects the Form.io MCP server (`@formio/mcp`) to whatever coding agent is running, so the Form.io skills have tools to call. Use when a Form.io skill's preflight finds the MCP tools missing, when Form.io tool calls fail because no Form.io tools are available, or when the user asks to install, connect, configure, or fix the Form.io MCP server. Also use when the user has installed the Form.io skills on their own but nothing has wired the server yet. Writes the MCP configuration for the client it is running in — Claude Code, Cursor, VS Code, or Codex — behind an approval gate, falling back to all four when the host cannot be established, then asks the server which Form.io project this directory resolves to and captures only whichever URL it reports missing, so the first tool call works, and tells the user how to reload. Not for: authenticating to Form.io (see `formio-auth`); building anything with Form.io — return to the skill that sent you here once the server is connected.
---

# Connect the Form.io MCP server

The Form.io skills call tools — `form_list`, `form_create`, `project_import`, `project_set`, `project_get`, and the rest. Those tools come from the `@formio/mcp` server. Skills installed on their own (`npx skills add formio/ai`) arrive without it, because that installer handles skills only and never touches MCP configuration.

Your job here is to write that configuration, get it approved, and hand control back.

## What you are NOT doing

- **Not** collecting an API key. Nothing you write into a client configuration file contains a URL, a key, or any other secret.
- **Not** continuing the user's original request. Configuration only takes effect after a reload, so this skill ends by asking them to reload and ask again.

You **are** offering to capture which Form.io project to use — see Step 4. That is one errand for the user rather than two, and it means the first Form.io tool call after the reload works instead of failing with "no project configured". It is an offer, never a requirement.

## Step 1 — Confirm the server really is missing

Check whether tools named `form_list`, `form_create`, `project_import`, `project_set`, and `project_get` are available to you.

- **All available** → nothing to do. Say so in one line and return to the skill that sent you here.
- **All missing** → continue to Step 2.
- **Present, but no `project_get`** → the connected server predates that tool, which shipped after the rest of the Form.io tool surface. Skip to "Already connected, but too old" below; the configuration exists, and whether its pinned version can be moved forward is the first thing that branch checks. Decide this from the tool list you can actually call, never from a version number written in prose: the launch commands in this document are restamped on every release and sentences about them are not, so a number here goes stale by one release the moment `project_get` ships.

### Already connected, but too old

Do not write a fresh configuration and do not treat this as a missing server. **First ask where the server came from**, because a plugin install has no file for you to edit: if the user installed the plugin through a marketplace (Claude Code `/plugin install`, Cursor's Customize panel, `copilot plugin install`, VS Code's _Install Plugin From Source_, or the Codex plugin directory), the pinned version belongs to the plugin, so tell them to update the plugin through the same route they installed it and then reload — do not go hunting for an `mcpServers` entry nothing wrote, and do not write one, which would leave two servers configured.

Otherwise the entry is in a file: find the existing `formio-mcp` entry in the file your client reads — identified the way Step 2 identifies it — read the version it pins, and compare that against the version the Step 2 blocks below carry. Branch on the comparison rather than editing straight away.

- **The blocks carry a newer version** → change only the pinned version to that one — the same edit Step 2's note about pinning describes, applied to a file that already exists. Show the user the one-line diff, get approval, then send them to Step 5 to reload. Step 4 is still worth offering afterwards if nothing is mapped for their directory.
- **The entry already names the same version the blocks carry** → there is nothing to edit, and writing that pin over itself would send the user round the same loop on the next run. The pins in this document are restamped only when a release is cut, while the skills install straight off the default branch — so a document whose blocks name the version already running is a document that arrived ahead of the release carrying `project_get`, and that release is not published yet. Say exactly that. Do not edit the file, and do not substitute `latest` or a version you looked up yourself; Step 2's pinning note forbids both. The user's two ways forward are to wait for the release and re-run this skill once its blocks name it, or to name a newer published version themselves — which you may then write, as their explicit choice.

**A not-yet-reloaded install is a different case from a stale pin, and it looks the same from here.** If the tools are missing ENTIRELY and the user says they already installed the plugin through a marketplace (the routes above), the server came with it and the likely cause is that the client has not reloaded since — send them to Step 5 rather than writing files. If the tools are present and only `project_get` is missing, a reload changes nothing: the plugin's own pin is what is stale, so it is the plugin that has to be updated. Ask which of the two they are in rather than guessing, because the remedies do not overlap.

## Step 2 — Preview the configuration

There is no universal MCP configuration file. Each client reads a different path, and two of them do not use the `mcpServers` key at all:

| Client                   | File                 | Key                             |
| ------------------------ | -------------------- | ------------------------------- |
| Claude Code              | `.mcp.json`          | `mcpServers`                    |
| Cursor                   | `.cursor/mcp.json`   | `mcpServers`                    |
| VS Code / GitHub Copilot | `.vscode/mcp.json`   | `servers`                       |
| Codex / ChatGPT          | `.codex/config.toml` | TOML `[mcp_servers.formio-mcp]` |

**Write the one file the client you are running in reads.** Four files for a user who runs one client is three changes they have to review, keep, or delete for products they do not use. Establish the host in this order, stopping at the first step that answers:

1. **Your own identity.** Which product is running you is something you generally know — it is part of how you were launched, not something you have to infer. If it is one of the four in the table above, that is the answer, and the table gives you its path and its key.
2. **One question.** If you are running somewhere the table does not name, or you genuinely cannot tell, ask the user which coding agent they are in. Offer the four by name and a "not sure" choice, in a single round.
3. **Write all four.** That is the fallback for "not sure", for no answer, and for a client the table does not cover. A configuration file for a client that is not present is inert, so writing every file is safe — only noisier than the user needs. Say that you are doing it and why.

**Do not use the filesystem as the signal.** An existing `.vscode/`, `.cursor/`, or `.claude/` directory says somebody once opened this workspace in that editor, not that it is running you now; a workspace that has all three would resolve to whichever you checked first.

Write more than one file when — and only when — the user says they work in more than one client here. Every path in the table is workspace-relative; never write into the user's home directory.

Show the user every file you intend to write, in full, before writing anything. The blocks below carry all four; show the ones you selected.

`.mcp.json` — Claude Code

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp@0.12.1"]
    }
  }
}
```

`.cursor/mcp.json` — Cursor

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp@0.12.1"]
    }
  }
}
```

`.vscode/mcp.json` — VS Code and GitHub Copilot. Note the key: `servers`, not `mcpServers`.

```json
{
  "servers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp@0.12.1"]
    }
  }
}
```

`.codex/config.toml` — Codex and ChatGPT. TOML, with no JSON equivalent.

```toml
[mcp_servers.formio-mcp]
command = "npx"
args = ["-y", "@formio/mcp@0.12.1"]
```

### Why the version is pinned

Every block above launches the package at the exact version written into it — `@formio/mcp@<version>` — never a floating `@formio/mcp`. An unpinned `npx` resolves whatever the registry serves at the moment the client starts the server, so the code that gains tool access to the user's Form.io deployment is chosen at run time rather than reviewed once. Pinned, the user runs the exact build this skill was written against, and an upgrade is a visible edit to a file they approved. Write the version exactly as it appears here — do not substitute `latest`, a caret range, or a version you looked up yourself. If the user asks for a newer server, change the number in every file you wrote and tell them what changed.

The package is first-party: `@formio/mcp` is published from the same repository as these skills ([formio/ai](https://github.com/formio/ai)) through npm Trusted Publishing, so npm carries a provenance attestation for the build.

### Merging with what is already there

Read each file first if it exists. Add the `formio-mcp` entry alongside any existing servers — never overwrite a file that already configures other MCP servers, and never reformat entries you did not add. If a `formio-mcp` entry already exists and matches, leave it alone and go to Step 4.

### Committing or ignoring

Mention once, without deciding for the user: these files carry no secrets, so committing them lets teammates on other agents pick up the same server. A user who would rather keep them local should add them to `.gitignore`.

## Step 3 — Get approval, then write

Ask for explicit approval before writing. Write exactly the set Step 2 selected — all of it, minus any file that already carries a matching entry, or none of it. Do not quietly add files the user did not approve, and do not drop one you showed them.

After writing, list the paths you created or modified.

## Step 4 — Offer to configure the project

The server starts with no project. Left unconfigured, the first Form.io tool call after the reload fails with an actionable error — a good error, but one the user resolves mid-task when it could have been resolved here. So probe now, and ask only for what the probe says is missing.

[`references/project-urls.md`](./references/project-urls.md) is this library's canonical description of the two values you may end up asking for — what a Project URL is in each of the three deployment shapes, how the Base URL is derived from it, and the one shape where it cannot be. Read it before you ask the user for either one, here or on behalf of a skill that has no server to ask. Every other skill in the library links to that file rather than restating it, and so does this one.

### First, ask the server what this directory resolves to

```bash
npx -y @formio/mcp@0.12.1 project get --cwd "$(pwd)"
```

On a zero exit it prints the Project URL, the Base URL, and which source supplied each. The work is already done: report both URLs in one line and go to Step 5. Do not interview for something already on record.

One trap to know about: the `project` command shipped in `@formio/mcp` 0.9.0, and an older binary ignores these arguments, starts its stdio server, reads end-of-input and exits **0 with no output** — so `project get` looks like a success that found nothing, and `project set` writes nothing while reporting nothing. **Empty output is not a project.** Never report a mapping you did not read in the output, and never tell the user a project was persisted when `project set` printed nothing.

Read the `Source:` line for what it is: this command runs in your shell, and the MCP server's own environment is **not visible** from there. That does not make the answer unreliable — the environment is the **weakest** source, so a `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL` set in the server's own `env` block cannot override what this command reports. When the line names your shell's `FORMIO_PROJECT_URL`, that is a value you can still redirect: record one here and the mapping wins. When it names the working-directory mapping or a committed `formio.json`, that is what is on disk and what the server resolves.

### Otherwise, relay what it says and ask for that one value

On exit `1` — nothing is recorded for this directory — the command explains what is missing and names the command that fixes it. Relay that instruction to the user, ask for the **single value it names**, and persist it with the command it named:

```bash
npx -y @formio/mcp@0.12.1 project set --project-url "<project url>" --cwd "$(pwd)"
```

**When the working directory is inside a git repository, offer the choice of where to record it, in the same round you ask for the URL.** A committed `formio.json` in the application's own folder records the target with the code — shared with everyone who clones the repository, and it survives a fresh checkout — while `project set` records it for this machine only. The committed file is hand-authored: the server reads it and never writes it, so if the user picks it, write the file yourself, in the application's own folder and never an ancestor (discovery walks upward, so a file placed higher governs every unrelated folder beneath it):

```json
{ "projectUrl": "<project url>" }
```

Say the consequence in one line and let the user pick; do not explain how the two are ranked, because `project get` reports which one supplied a value. Outside a git repository, do not offer the committed file — nothing would be tracking it.

Then re-run `project get`. Most of the time that is the end of it: the Base URL is derived from the Project URL — `https://api.form.io` for a project on a `form.io` host, the parent path for a project addressed as a sub-directory — so there is no second value to collect.

The exception is a Project URL that is a plain sub-domain of the user's own domain, e.g. `https://myproject.mysite.com`, whose deployment is a sibling sub-domain that nothing in the Project URL names. A record holds a project and its deployment together, so that shape cannot be recorded on its own: the `project set` above exits `1` naming `--base-url` as the value it still needs, and prints the command carrying both. Ask the user for the Base URL alone at that point — never before, and never by assuming a default — and run what it printed:

```bash
npx -y @formio/mcp@0.12.1 project set --project-url "<project url>" --base-url "<base url>" --cwd "$(pwd)"
```

A deployment on its own is a valid update only for the record that already holds the project — this directory's own mapping. Where the project lives in a committed `formio.json`, the refusal names that file's path and the `"baseUrl"` key to add beside `"projectUrl"` — an edit you make to the file, since the server never writes one. Where it lives in the environment, the refusal names the mapping write carrying both URLs. Either way the user is asked for one value: the message carries the Project URL the report already printed.

**An exit `3` from either command is the same round reached from the other side.** The project is already recorded — in a committed `formio.json`, in this directory's own mapping, or in the environment — and only its deployment is missing, which is what happens in a repository that ships a `formio.json` naming a project whose deployment cannot be derived, or in a container configured entirely by environment. Ask the user for the Base URL alone and do exactly what the report says: run the command it printed, or, for a committed `formio.json`, add the `"baseUrl"` key to the file it names. It carries the Project URL for you.

`project set` exits `3` for the state it just left the directory in, not for a write that failed: the record it was given went to disk, and the committed file that governs the directory still supplies no deployment. Its `stdout` carries the same block `get` prints — the pair that RESOLVES, with the record just written named in the note beneath it — and `stderr` carries the report, so treat it exactly as the `get` above — ask for the Base URL alone and make the edit the report names. Do not re-run the same `project set`; it would write the same record and report the same gap.

**Exit `1` from either command is an answer, not a failure.** It names one missing value and the command that supplies it. That is the code to act on.

**Exit `2` is none of those branches.** It means the command could not answer at all — an unreadable `~/.formio/projects.json`, a `formio.json` that will not parse, a malformed URL. Do not interview and do not run `project set`: it would fail for the same unreported reason, and the user would see an interview-then-error loop that never names the cause. Relay the message, which names what to fix and whether a repair has to happen by hand first, and treat the step as skipped.

**Do not compose your own version of this guidance.** The server's messages carry the valid URL shapes, an example of each, and why a value cannot be guessed — they reach an agent that never read this skill, so they are the single copy. Relay them; do not paraphrase them, and do not add shape rules of your own here.

Report what the final `project get` prints — and if it prints nothing, report that nothing was persisted rather than that the project was set. The mapping is read at tool-call time, so it is live the moment the server starts; there is nothing further to configure after the reload.

**Two things never to do here.** Never edit `~/.formio/projects.json` yourself: its shape, its `0600` mode, and its merge rules belong to the server, and the commands above are how you reach them. And never put `FORMIO_PROJECT_URL` into a client configuration file's `env` block — not because it would pin anything, but because it is the wrong **scope** for the value: an `env` block is one answer for every directory that client opens, while a Form.io project is one-to-one with the application built against it. Record it per directory with the commands above instead.

`FORMIO_BASE_URL` is safe in an `env` block, read from the other end: a project and its deployment resolve from ONE record, and the environment is the weakest of the three — so those variables answer only where neither a committed `formio.json` nor this directory's mapping names a project, and they are ignored entirely as soon as one does. Where the environment IS the record that answers, its `FORMIO_BASE_URL` is that project's deployment, exactly as a `baseUrl` recorded in either of the other two records would be. Setting it blocks no later `project_set`; do not strip it from a configuration that has it, and do not add it to one that does not — that value is the host's prompt to own.

### When to skip it

Skipping is a normal outcome, not a failure. Skip when:

- The user does not know their Project URL, or has not created a project yet.
- The request that brought you here needs no project at all — an API-reference question, a schema question.
- The user would simply rather not.

Say what happens instead, in one line: the first Form.io tool call will raise the same actionable message, and `project_set` will handle it then. Then continue to Step 5. Do not re-ask, and do not describe setup as incomplete.

**If the command fails, or succeeds while printing nothing** — no version satisfying `>=0.9.0` available, a blocked registry, or an older binary that swallowed the arguments — treat it exactly like a skip. Report what failed in one line, name `project_set` on the first tool call as the fallback, and carry on to Step 5. The server configuration you wrote in Step 3 is still good.

## Step 5 — Reload, then hand control back

MCP configuration is read when a session starts, not when a tool is called, so the new server does not exist until the client reloads. Tell the user the step for the client Step 2 identified. If Step 2 fell back to writing everything, give the whole list instead:

- **Claude Code** — restart the session, or run `/mcp` to reconnect.
- **Cursor** — toggle `formio-mcp` off and on under Customize → MCP, or restart Cursor.
- **VS Code** — run _Developer: Reload Window_.
- **Codex** — restart Codex. It may ask you to trust this directory before it reads `.codex/config.toml`.

Then stop. Ask them to reload and re-issue the request that brought them here, and say which skill will pick it up. Do not claim the original task is finished, and do not attempt it without tools.

## When the pinned version does not exist yet

Every configuration in this skill names an exact server version. If `npx` fails with `E404` — `npm error 404 Not Found - GET https://registry.npmjs.org/@formio%2fmcp` naming the pinned version specifically — the package exists but that release has not landed on npm yet. It is a release still in flight, not a broken configuration, and it resolves itself within minutes.

Tell the user that, then offer one of two things rather than editing the pin yourself: wait and reload, or install the immediately preceding published version — `npm view @formio/mcp versions` lists what npm actually has, and the highest entry below the pinned one is the fallback. Say which version you used and that it is a temporary substitute. Never replace the pin with `@latest` or an unpinned `@formio/mcp`: that is the pattern the pin exists to remove, and it silently outlives the release it was meant to work around.

## When `npx` cannot reach the registry

Some environments block the public npm registry — an air-gapped network, a locked-down corporate host that serves an internal mirror instead. Two alternatives, in order of preference:

1. **Global install from an internal registry or a cached tarball**, then point the configuration at the binary instead of `npx`:

   ```bash
   npm install -g @formio/mcp@0.12.1
   ```

   Replace `"command": "npx", "args": ["-y", "@formio/mcp@0.12.1"]` with `"command": "formio-mcp", "args": []` in every file you write (and the TOML equivalent).

2. **The desktop bundle.** For Claude Desktop and other hosts that accept one, the `.mcpb` bundle attached to each GitHub release carries the server with no registry access required.

If neither is possible, say so plainly rather than leaving the user with a configuration that cannot start.

## Never work around missing tools

If the user declines setup, or setup cannot complete, stop. Do **not** fall back to direct HTTP requests against a Form.io deployment, and do not write a throwaway script that makes them for you. The skills document the full REST surface, which makes hand-rolling requests tempting and wrong: it bypasses the guardrails the tools enforce, and it can write to a live deployment in ways nobody reviewed. Report what is blocking and let the user decide.

This is about **build-time** work — what you do in this session on the user's behalf. An application built with these skills calls the Form.io REST API **at runtime** as a matter of course; that code is not a workaround and is not covered by this rule.
