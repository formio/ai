# Obtaining the Project URL and the Base URL

The two values every Form.io application is configured with. This document is how you get them — with the MCP server, or without it.

## The two values, and the names they travel under

| Value | What it is | Called this in `FormioAppConfig` | Called this in the SDK |
| --- | --- | --- | --- |
| **Project URL** | The full URL of the one Form.io project this application reads and writes. The single value a user supplies. | `appUrl` | `Formio.setProjectUrl(...)` |
| **Base URL** | The deployment hosting that project. Normally derived from the Project URL rather than supplied. | `apiUrl` | `Formio.setBaseUrl(...)` |

`appUrl` is an alias for `projectUrl` and `apiUrl` is an alias for `baseUrl` — the same two values under different names, never a third and fourth value. Getting that pairing backwards points the application at its deployment for project reads and at its project for platform reads, and both fail in ways that look like permission errors.

## Which path you are on

**If the Form.io MCP tools are callable by you — Path A.** The server already knows what this working directory resolves to, and its answer is what every tool call will target, so asking it keeps the generated application and the tooling on the same project.

**If they are not — Path B.** Ask the user. **Do not install the MCP server to learn these two values**, and do not hand off to `formio-mcp-setup` for them: nothing on this page reads from or writes to a deployment, so a server would be installed to answer two questions the user can answer directly. Install it when something actually needs a tool call — an import, a form write, a role change.

Both paths apply the same rules, which are below and are the same rules the server itself applies.

## Path A — ask the server

Call `project_get` with `cwd` set to the user's current working directory, and branch on `status`:

- **`ok`** — both values are in the report. Use them exactly as reported. Do not ask the user to confirm them.
- **`not-configured`** — nothing is recorded for this directory. Ask the user for the Project URL (one question — see the rules below), record it by calling `project_set` with that `projectUrl` and the same `cwd`, then call `project_get` again. If that Project URL carries no path on the user's own domain it names no deployment, so the call is refused and names the Base URL it still needs: ask for that one value and repeat the call with both.
- **`base-url-unresolved`** — the project is recorded and its deployment could not be derived. Ask the user for the Base URL alone, then make the `project_set` call the report names, and call `project_get` again. Do not re-ask the user for the Project URL: the report named it, and the call it prints carries it for you.

If the call fails outright instead of returning a status, relay the error and stop; do not fall through to Path B. A recorded configuration that cannot be read is not an absent one, and interviewing around it writes a second answer that the broken record still shadows.


**A project and its deployment are recorded together, in one record.** That is why the report names the remedy rather than leaving you to compose one: a deployment goes beside the project it serves, so what records it depends on which record holds that project — a `project_set` update for this directory's own mapping, an edit adding `"baseUrl"` to a committed `formio.json` (hand-authored and versioned with the code; the server reads that file and never writes it), or, for a project that comes only from the environment, a new pair in the mapping, which then governs. Never record a deployment in one record while its project sits in another; nothing in such a record says which project the deployment serves.

## Path B — ask the user

Ask for the **Project URL** first, and alone. Then derive the Base URL from it, and ask for that only in the one shape where it cannot be derived. Two questions is the worst case; one is the common one.

Nothing is recorded on this path — there is no server to record it in — so the values live only in what you write into the application. If the user later installs the MCP server, offer once to record the same Project URL with `project_set` so the tooling resolves what the application already ships with.

## What a Project URL is

The full URL of one Form.io project. It has three shapes, and which one applies depends on the deployment:

- **Form.io hosted cloud** — the project's name as a sub-domain of `form.io`. A project named `examples` is `https://examples.form.io`.
- **Customer-hosted, sub-directory routing** — a path under the deployment: `https://forms.mysite.com/myproject`.
- **Customer-hosted, sub-domain routing** — a sibling sub-domain of the customer's own domain: `https://myproject.mysite.com`.

Rules that hold on both paths:

- **Never build a Project URL by appending a project name to a deployment URL.** In the sub-domain shape the two hosts differ by design, so neither can be built from the other.
- A `*.form.io` host is never a Base URL, and `https://api.form.io/<project>` is not a hosted Project URL.
- Strip a trailing slash before using or recording the value.

## Deriving the Base URL

| Project URL shape | Base URL |
| --- | --- |
| `https://examples.form.io` (any `form.io` host) | `https://api.form.io` |
| `https://forms.mysite.com/myproject` (sub-directory) | the project URL minus its final path segment — `https://forms.mysite.com` |
| `https://forms.mysite.com/one/two` (sub-directory, deployment mounted at a sub-path) | the same rule, one segment up — `https://forms.mysite.com/one` |
| `https://myproject.mysite.com` (path-less, customer domain) | **cannot be derived** — ask for it |

The rule for a project URL with a path is always its **parent path**, never its origin — the third row is what makes the difference visible, and a deployment mounted at a sub-path is where taking the origin instead points the portal login at a host root that serves nothing.

The last row is the only case that needs a second question. That shape names no deployment anywhere in it: the deployment is a sibling sub-domain, and nothing in the project URL says which. Do not answer it with `https://api.form.io` — that value is certainly wrong for a project that is not on a `form.io` host, and it is the guess this table exists to prevent.

Never invent a Base URL, never reuse one from another project or an earlier session, and **never edit `~/.formio/projects.json`** by any means — its shape, its `0600` mode, and its merge rules belong to the server, and `project_set` is how you reach them.

## Before you write either value into a file

State both values in one line and what you are about to write them into, so a wrong target is caught before it ships in the application's own source. A hardcoded example host — `https://examples.form.io` from this page included — points the built application at a deployment nobody manages.
