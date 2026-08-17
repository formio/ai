---
name: formio-mcp-setup
description: >-
  Connects the Form.io MCP server (`@formio/mcp`) to whatever coding agent is running, so the Form.io skills have tools to call. Use when a Form.io skill's preflight finds the MCP tools missing, when Form.io tool calls fail because no Form.io tools are available, or when the user asks to install, connect, configure, or fix the Form.io MCP server. Also use when the user has installed the Form.io skills on their own but nothing has wired the server yet. Writes the MCP configuration for every supported client in one pass — Claude Code, Cursor, VS Code, Codex — behind an approval gate, then offers to capture the Form.io Project URL and Base URL so the first tool call works, and tells the user how to reload. Not for: authenticating to Form.io (see `formio-auth`); building anything with Form.io — return to the skill that sent you here once the server is connected.
---

# Connect the Form.io MCP server

The Form.io skills call tools — `form_list`, `form_create`, `project_import`, `project_set`, and the rest. Those tools come from the `@formio/mcp` server. Skills installed on their own (`npx skills add formio/ai`) arrive without it, because that installer handles skills only and never touches MCP configuration.

Your job here is to write that configuration, get it approved, and hand control back.

## What you are NOT doing

- **Not** collecting an API key. Nothing you write into a client configuration file contains a URL, a key, or any other secret.
- **Not** continuing the user's original request. Configuration only takes effect after a reload, so this skill ends by asking them to reload and ask again.

You **are** offering to capture which Form.io project to use — see Step 4. That is one errand for the user rather than two, and it means the first Form.io tool call after the reload works instead of failing with "no project configured". It is an offer, never a requirement.

## Step 1 — Confirm the server really is missing

Check whether tools named `form_list`, `form_create`, `project_import`, and `project_set` are available to you.

- **Available** → nothing to do. Say so in one line and return to the skill that sent you here.
- **Missing** → continue.

If the user already installed the plugin through a marketplace (Claude Code `/plugin install`, Cursor's Customize panel, `copilot plugin install`, VS Code's _Install Plugin From Source_, or the Codex plugin directory), the server should have come with it. In that case the likely cause is that the client has not reloaded since the install — send them to Step 5 rather than writing files.

## Step 2 — Preview the configuration

There is no universal MCP configuration file. Each client reads a different path, and two of them do not use the `mcpServers` key at all:

| Client                   | File                 | Key                             |
| ------------------------ | -------------------- | ------------------------------- |
| Claude Code              | `.mcp.json`          | `mcpServers`                    |
| Cursor                   | `.cursor/mcp.json`   | `mcpServers`                    |
| VS Code / GitHub Copilot | `.vscode/mcp.json`   | `servers`                       |
| Codex / ChatGPT          | `.codex/config.toml` | TOML `[mcp_servers.formio-mcp]` |

**Write all four.** Do not try to work out which client you are running inside — a configuration file for a client that is not present is inert, and guessing wrong leaves the user with nothing. All four paths are workspace-relative; never write into the user's home directory.

Show the user every file you intend to write, in full, before writing anything:

`.mcp.json` — Claude Code

```json
{
  "mcpServers": {
    "formio-mcp": {
      "command": "npx",
      "args": ["-y", "@formio/mcp"]
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
      "args": ["-y", "@formio/mcp"]
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
      "args": ["-y", "@formio/mcp"]
    }
  }
}
```

`.codex/config.toml` — Codex and ChatGPT. TOML, with no JSON equivalent.

```toml
[mcp_servers.formio-mcp]
command = "npx"
args = ["-y", "@formio/mcp"]
```


### Merging with what is already there

Read each file first if it exists. Add the `formio-mcp` entry alongside any existing servers — never overwrite a file that already configures other MCP servers, and never reformat entries you did not add. If a `formio-mcp` entry already exists and matches, leave it alone and go to Step 4.

### Committing or ignoring

Mention once, without deciding for the user: these files carry no secrets, so committing them lets teammates on other agents pick up the same server. A user who would rather keep them local should add them to `.gitignore`.

## Step 3 — Get approval, then write

Ask for explicit approval before writing. Do not write a partial set: either all four (minus any that already have a matching entry) or none.

After writing, list the paths you created or modified.

## Step 4 — Offer to configure the project

The server starts with no project. Left unconfigured, the first Form.io tool call after the reload fails with an actionable error naming `project_set`, and the user resolves mid-task what could have been resolved here. So offer to capture it now.

### First, check whether it is already configured

```bash
npx -y @formio/mcp project get --cwd "$(pwd)"
```

One trap to know about: the `project` command shipped in `@formio/mcp` 0.9.0, and an older binary ignores these arguments, starts its stdio server, reads end-of-input and exits **0 with no output** — so `project get` looks like a success that found nothing, and `project set` writes nothing while reporting nothing. Never report a mapping you did not read in the output, and never tell the user a project was persisted when `project set` printed nothing.

If that prints a project, the work is already done. Report the Project URL and Base URL in one line and go to Step 5 — do not interview for something already on record.

**Empty output is not a project.** Treat a zero-exit run that prints nothing exactly as you would treat "not configured", and never report a mapping you did not read in the output.

**Exit `1` and exit `2` are different answers.** `1` means nothing is mapped for this directory — ask. `2` means the command ran and failed (an unreadable `~/.formio/projects.json`, a relative `--cwd`, a malformed stored URL or entry): report its stderr and stop. Interviewing on a `2` ends in a `project set` that fails for the same unreported reason. One caveat on `1`: `npx` itself exits `1` when it cannot fetch the server at all (`npm error` on stderr), which means nothing was checked — read stderr before treating a `1` as "not configured".

Read its `Source:` line for what it is: this command runs in your shell, and the MCP server's own environment is **not visible** from there. When it names your shell's `FORMIO_PROJECT_URL`, that pin is real and no configuring here will redirect it. When it names the working-directory mapping, that is what is on disk — a `FORMIO_PROJECT_URL` in the server's own `env` block (a plugin install, an `.mcp.json`) would still override it, and this command cannot see that.

### Otherwise, ask — in one question round

Ask for the Project URL and the Base URL together, in ONE question round, using the client's structured question mechanism (in Claude Code, `AskUserQuestion`). Both need a free-text answer alongside any example options.

Use the plain-language descriptions and example values from [`formio-application/DEPLOYMENT.md`](../formio-application/DEPLOYMENT.md) — that document owns this wording, including the three valid URL shapes, and it is not repeated here. In short: on the hosted cloud the Base URL is always `https://api.form.io` and the Project URL is the project name as a subdomain (`https://examples.form.io`); on a deployment the customer hosts, the Base URL is the platform host (`https://forms.mysite.com`) and the Project URL is either a sibling subdomain of their own domain (`https://myproject.mysite.com`) or a sub-directory of the platform (`https://forms.mysite.com/myproject`), depending on how that deployment routes projects. A `*.form.io` host is never a Base URL, and a project host that differs from the Base URL's host is normal in the sub-domain shape.

Ask for the Base URL rather than assuming the default. It builds the portal-login URL and keys the cached token, so a self-hosted user who gets the default silently ends up logging in against the wrong deployment.

### Apply it with the server's own command

```bash
npx -y @formio/mcp project set --project-url "<project url>" --base-url "<base url>" --cwd "$(pwd)"
```

Then confirm rather than assume:

```bash
npx -y @formio/mcp project get --cwd "$(pwd)"
```

Report what it prints — and if it prints nothing, report that nothing was persisted rather than that the project was set. The mapping is read at tool-call time, so it is live the moment the server starts — there is nothing further to configure after the reload.

**Two things never to do here.** Never edit `~/.formio/projects.json` yourself: its shape, its `0600` mode, and its merge rules belong to the server, and the command above is how you reach them. And never put `FORMIO_PROJECT_URL` into a client configuration file's `env` block: for the project URL an environment value takes **precedence** over the mapping, which pins the server to one project and makes every later `project_set` silently do nothing.

`FORMIO_BASE_URL` is the opposite and is genuinely useful in an `env` block — the shipped plugin manifests set it from the install-time prompt, and the `.mcpb` bundle from its user config. It resolves the other way round: a base URL mapped for a working directory **wins** over the environment, so the global is the default for directories that have not named their own deployment. Setting it pins nothing and blocks no later `project_set`; do not strip it from a configuration that has it, and do not add it to one that does not — that value is the host's prompt to own.

### When to skip it

Skipping is a normal outcome, not a failure. Skip when:

- The user does not know their Project URL, or has not created a project yet.
- The request that brought you here needs no project at all — an API-reference question, a schema question.
- The user would simply rather not.

Say what happens instead, in one line: the first Form.io tool call will ask for the project and persist it with `project_set`. Then continue to Step 5. Do not re-ask, and do not describe setup as incomplete.

**If the command fails, or succeeds while printing nothing** — no version satisfying `>=0.9.0` available, a blocked registry, or an older binary that swallowed the arguments — treat it exactly like a skip. Report what failed in one line, name `project_set` on the first tool call as the fallback, and carry on to Step 5. The server configuration you wrote in Step 3 is still good.

## Step 5 — Reload, then hand control back

MCP configuration is read when a session starts, not when a tool is called, so the new server does not exist until the client reloads. Tell the user the step for their client — you do not need to know which one they use, so give the short list:

- **Claude Code** — restart the session, or run `/mcp` to reconnect.
- **Cursor** — toggle `formio-mcp` off and on under Customize → MCP, or restart Cursor.
- **VS Code** — run _Developer: Reload Window_.
- **Codex** — restart Codex. It may ask you to trust this directory before it reads `.codex/config.toml`.

Then stop. Ask them to reload and re-issue the request that brought them here, and say which skill will pick it up. Do not claim the original task is finished, and do not attempt it without tools.

## When `npx` cannot reach the registry

Some environments block the public npm registry — an offline machine, an air-gapped network, a locked-down corporate host. Two alternatives, in order of preference:

1. **Global install from an internal registry or a cached tarball**, then point the configuration at the binary instead of `npx`:

   ```bash
   npm install -g @formio/mcp
   ```

   Replace `"command": "npx", "args": ["-y", "@formio/mcp"]` with `"command": "formio-mcp", "args": []` in each file (and the TOML equivalent).

2. **The desktop bundle.** For Claude Desktop and other hosts that accept one, the `.mcpb` bundle attached to each GitHub release carries the server with no registry access required.

If neither is possible, say so plainly rather than leaving the user with a configuration that cannot start.

## Never work around missing tools

If the user declines setup, or setup cannot complete, stop. Do **not** fall back to direct HTTP requests against a Form.io deployment, and do not write code that does. The skills document the full REST surface, which makes hand-rolling requests tempting and wrong: it bypasses the guardrails the tools enforce, and it can write to a live deployment in ways nobody reviewed. Report what is blocking and let the user decide.
