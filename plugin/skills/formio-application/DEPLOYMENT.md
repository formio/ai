# DEPLOYMENT — resolve the project, or ask for it

This document is loaded by the parent `formio-application` skill during Step 3. Build-new runs all of it; modify-existing skips the interview and runs the resolve-and-persist parts. It is **not** a standalone skill — no frontmatter.

## What this step captures

Two URLs that Step 4 (Import) and the Step 5 framework handoff both depend on. Stash them under the variable names `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` so downstream steps and the framework-specific SETUP phase can read them without another round of questions.

| Name in this skill | Variable | Form.io SaaS | Customer, sub-domain projects | Customer, sub-directory projects |
| --- | --- | --- | --- | --- |
| **Base URL** | `FORMIO_BASE_URL` | `https://api.form.io` | `https://forms.mysite.com` | `https://forms.mysite.com` |
| **Project URL** | `FORMIO_PROJECT_URL` | `https://examples.form.io` | `https://myproject.mysite.com` | `https://forms.mysite.com/myproject` |

### The three valid shapes — there are only three

Every pair the user can give you is one of these. Recognize which one you have before you validate, derive, or persist anything:

1. **Form.io SaaS (hosted).** The Base URL is **always** `https://api.form.io` — never a `*.form.io` subdomain, never anything else. The Project URL is the project's name as a subdomain of `form.io`: a project named `examples` is `https://examples.form.io`.
2. **Customer deployment, sub-domain project routing.** The customer hosts Form.io themselves — often at a subdomain of their own domain, e.g. `https://forms.mysite.com` — and wants projects on subdomains too. The Project URL is the project's name as a **sibling subdomain of the same parent domain**: `https://myproject.mysite.com`. The project host is NOT under the Base URL's host.
3. **Customer deployment, sub-directory project routing.** Same kind of deployment, again often at a subdomain (`https://forms.mysite.com`), but projects are addressed as paths **within** it: `https://forms.mysite.com/myproject`.

Shapes 1 and 2 are the same pattern; the SaaS deployment is simply the one whose parent domain is `form.io` and whose Base URL host is `api`.

Three consequences worth stating plainly, because each is easy to get backwards:

- A `*.form.io` host is **never** a Base URL. `https://examples.form.io` is a project, and its Base URL is `https://api.form.io`.
- A Project URL is a path under the Base URL **only** in shape 3. In shapes 1 and 2 the project is a sibling subdomain — so never build one by appending the project name to the Base URL, and `https://api.form.io/examples` is not a shape to produce or to offer as an example.
- In shape 2 the two hosts **differ by design**. Differing hosts is not an error to flag, and it means the Base URL cannot be worked out from the Project URL — a project at `https://myproject.mysite.com` tells you nothing about whether the deployment is at `https://forms.mysite.com`, `https://api.mysite.com`, or something else. Ask.

## First — resolve before you ask

The project configuration is captured once, wherever the user first lands, and never re-asked. It may already be on record: `formio-mcp-setup` offers to capture it during setup, and any earlier session in this working directory will have persisted it with `project_set`.

So before interviewing, ask the server what it resolves for this working directory:

```bash
npx -y @formio/mcp project get --cwd "<workspace cwd>"
```

One trap to know about: the `project` command shipped in `@formio/mcp` 0.9.0, and an older binary ignores these arguments, starts its stdio server, reads end-of-input and exits **0 with no output** — indistinguishable from a lookup that found nothing. So never read empty output as an answer of any kind; treat it exactly as `1` and interview.

That command is the only permitted way to read the mapping — no MCP tool reports it, and reading `~/.formio/projects.json` yourself is forbidden by the hard rule below.

Branch on the exit code. The three are distinct answers, and treating them alike is what produces an interview that ends in the same error the interview was supposed to fix:

| Exit | Meaning | Do |
| --- | --- | --- |
| `0` | It resolved something. | Read the `Source:` line — see below. Empty output is not a resolution: treat a zero exit that prints nothing as `1`. |
| `1` | Nothing is mapped for this directory — **or the command never ran.** | Read stderr before acting. `npm error` means `npx` could not fetch the server at all and nothing was checked: report that and stop, because the interview's `project_set` needs the same server. Anything else is a genuinely unmapped directory: run the interview. |
| `2` | The command ran and failed — an unreadable `~/.formio/projects.json`, a relative `--cwd`, a malformed stored URL or entry. | **Do not interview.** Show the user the command's stderr, say the mapping could not be read, and stop. `project_set` would fail for the same reason, and the interview hides the cause. |

**On exit `0`, read the `Source:` line — it is the point of the output.** This command runs in *your* shell, and the MCP server's own environment is not visible from there, so a resolution is only as good as where it came from:

- **Both from `the working-directory mapping`** — this is the configured case. Confirm in one line, stash, and skip the rest of this document; there is nothing to persist.
- **Project URL from `this shell's environment`** — a `FORMIO_PROJECT_URL` exported in your shell (or by CI) resolved that value, and the MCP server does not share your shell. Nothing is on record for this directory. Confirm the URL with the user as a suggestion, then **persist it with `project_set`** — without that, Step 4's `project_import` fails with "No Form.io project is configured".
- **Base URL from `the default`** — nothing supplied one; `https://api.form.io` is a fallback, not the user's answer. Never present it as their configured deployment. Derive or ask for the Base URL as described below, then persist both with `project_set`.

So: confirm and skip only when the source is the mapping for *both* values. Whenever any part of the answer came from the environment or the default, capture what is missing and call `project_set` before continuing.

The confirmation line, for the fully-mapped case:

> Using the Form.io project already configured for this directory — `<FORMIO_PROJECT_URL>` on `<FORMIO_BASE_URL>`. Say so if you want a different project.

Stash both values exactly as if the interview had run. Asking again for something already answered is the single most common way this flow feels broken — and confirming a value the user never gave is the other.

## Plain-language descriptions

When asking the user, use descriptions that do NOT assume they know "project" vs. "deployment" vocabulary:

- **Base URL** — "The Form.io deployment your project lives on. If you are using the hosted Form.io SaaS, this is always `https://api.form.io`. If your team hosts Form.io itself, this is the address of your platform — often a subdomain of your own domain, e.g. `https://forms.mysite.com`. This is the platform, not the specific project."
- **Project URL** — "The full URL of the specific Form.io project this template will be imported into and the app will talk to. On the hosted SaaS it is your project's name as a subdomain — a project named `examples` is `https://examples.form.io`. On a deployment your team hosts it is either a subdomain of your own domain (`https://myproject.mysite.com`) or a sub-directory of your platform (`https://forms.mysite.com/myproject`), depending on how that deployment routes projects. The project must already exist — we do not create it."

## Run the interview — ONE question round

Ask for both URLs together, in a single round, using the client's structured question mechanism (in Claude Code, `AskUserQuestion`). Do not split into two rounds; two sequential prompts feel like peppering, and one round reads like a form.

The round asks two questions:

1. **Base URL** — "What is the Form.io Base URL? (the deployment your project lives on)", offering `https://api.form.io` described as "Hosted Form.io SaaS — always this exact value" and `https://<your-platform-host>` described as "A Form.io deployment your team hosts, e.g. https://forms.mysite.com".
2. **Project URL** — "What is the Form.io Project URL? (the specific project this app will use)", offering three shapes: `https://<your-project>.form.io` described as "Hosted SaaS project — your project name as a subdomain; pick this if your Base URL is https://api.form.io", `https://<your-project>.<your-domain>` described as "Self-hosted deployment that routes projects to subdomains of your own domain", and `https://<platform-host>/<project-name>` described as "Self-hosted deployment that routes projects to sub-directories of the platform".

Both questions need a free-text answer alongside the fixed options — the options are shapes to recognize, not real URLs, so the user will normally type their own. Whatever mechanism your client offers for that, make sure typing a URL is possible; a round that only accepts the placeholder options is useless here.

**On build-new, a fresh empty project is almost always the right target.** A new app should land in an empty Form.io project rather than merging additively on top of a project the user already uses for something else. If the user offers an existing project, confirm that merging into it is what they want before continuing.

### If only the Project URL is known

When the user gives a Project URL but no Base URL, read which shape it is. Only two of the three can be derived at all:

- **Any `*.form.io` host is SaaS.** The Base URL is `https://api.form.io`. Do not derive it from the project's own origin.
- **A Project URL with a path is sub-directory routing.** The Base URL is the Project URL's origin — scheme, host, and port only, dropping the path.
- **A Project URL with no path, on any other domain, is sub-domain routing — and cannot be derived.** The deployment lives at a different subdomain of the same parent domain, and nothing in the project's own URL says which. Ask for the Base URL; do not fall back to the project's origin.

| `FORMIO_PROJECT_URL`                     | Derived `FORMIO_BASE_URL`                              |
| ---------------------------------------- | ------------------------------------------------------ |
| `https://examples.form.io`               | `https://api.form.io` (SaaS)                           |
| `https://forms.mysite.com/myproject`     | `https://forms.mysite.com` (sub-directory)             |
| `http://localhost:3000/authoring-abc123` | `http://localhost:3000` (sub-directory)                |
| `https://myproject.mysite.com`           | **not derivable** (sub-domain) — ask for the Base URL  |

The SaaS rule matters because the derived value is persisted by `project_set` and then used for real: it keys the cached JWT (per deployment, not per project) and it is what the portal-login URL is built from. Deriving `https://examples.form.io` as the Base URL would key one token cache per project and point the login at the project subdomain — and deriving `https://myproject.mysite.com` for a sub-domain-routed deployment does exactly the same damage on a customer host.

Do not ask the user to confirm a derivation you could make. Do ask, in one short question, when the shape is sub-domain routing and there is nothing to derive. Never guess a Base URL from anywhere else — not from environment variables, not from a previous project.

## Validation

After capture, before persisting:

1. **Scheme.** Both URLs SHOULD begin with `https://`. Warn on `http://` (accept for local dev but call it out).
2. **Trailing slash.** Strip trailing `/` from both URLs. Double slashes break `@formio/angular`'s internal path joining.
3. **Reachability is NOT required.** Do not make network requests to check resolvability. The user may be offline, behind a VPN, or addressing a project that has not been deployed yet.
4. **Sanity.** Flag if `Project URL == Base URL` — usually means the user gave the base URL twice. Confirm before proceeding.
5. **Shape agreement.** The pair must be one of the three shapes above. The Base URL never carries a path of its own, in any of them. Then, by Project URL:
   - **On a `*.form.io` host** → the Base URL must be exactly `https://api.form.io`. Anything else — including the project's own subdomain — is wrong; correct it silently and say what you used.
   - **With a path, on any other host** → sub-directory routing: the path must sit under the Base URL's origin, so the two origins must match exactly.
   - **With no path, on any other host** → sub-domain routing: the two hosts are SUPPOSED to differ, so do not flag that. Check only that they share a parent domain (`myproject.mysite.com` and `forms.mysite.com` both end in `mysite.com`).
   - Flag it only when none of the three fits — a `*.form.io` project with a customer Base URL, or two hosts with nothing in common. Then ask which value is wrong rather than repairing one at random: either could be the one that belongs to a different deployment.

## Persist the mapping

After capture succeeds — and only then — call:

```
project_set({ cwd: <workspace cwd>, projectUrl: <FORMIO_PROJECT_URL>, baseUrl: <FORMIO_BASE_URL> })
```

This writes the working-directory → project mapping that every Form.io tool resolves against on each call. It takes effect immediately: Step 4 (Import) runs in the same invocation, with nothing to reload and no configuration file to write.

Pass `baseUrl` as well as `projectUrl`. It is optional in the tool and consequential in practice — the base URL builds the portal-login URL and keys the cached token, and omitting it falls back to `https://api.form.io`, which sends a self-hosted user's login to the wrong deployment.

### Hard rule — the project mapping is owned by `project_set`

**Never write `~/.formio/projects.json` by hand.** Not with a file write, not with an edit, not with a shell heredoc, not with `jq`, not by any other means. The tools permitted to create, update, or repair this file are the `project_set` MCP tool and the server's own `formio-mcp project set` command.

Why: the file's shape, its `0600` file mode, and its merge semantics are owned by the MCP server. Hand-editing can produce a file that reads successfully now and that the server refuses to write to later, leaving the user half-mapped. `project_set` is also the single place where the URL is normalized (trailing-slash stripping, http/https validation) — hand-editing bypasses that and lets malformed URLs reach downstream tools.

If `project_set` appears to fail or no-op unexpectedly:

1. Check its response text. A "no change / already persisted" message means the on-disk mapping for this working directory already matches — nothing is broken.
2. Confirm what the server resolves: `npx -y @formio/mcp project get --cwd <workspace cwd>` prints the active project, the base URL, and which source won. Empty output is not an answer — an `@formio/mcp` older than 0.9.0 has no `project` command and exits 0 printing nothing, whatever is mapped. Exit `2` here means the command itself failed rather than that nothing is mapped; report its stderr instead of re-running the interview.
3. If the tool genuinely errors, surface the error to the user and stop. Do NOT hand-write the file as a workaround. Report the failure so it can be fixed at the tool layer rather than papered over per session.

This rule applies to every step in this skill and to any other skill that needs to persist a working-directory → project mapping.

## Skip conditions

What is skipped here is the **interview**, never the `project_set` call. Skip the questions when:

- The working directory is already mapped to a project — that is, `project get` exited `0` and named `the working-directory mapping` as the source of **both** URLs. Confirm in one line, stash, continue; the mapping already exists, so there is nothing to persist. A resolution sourced from the shell's environment or from the default is NOT a mapping — see "resolve before you ask" above, and persist it with `project_set`.
- Intent is **modify-existing** — the workspace already has URLs wired in `FormioAppConfig`. The orchestrator reads them from `src/app/config.ts` (or the framework-specific equivalent) and stashes them as if Deployment had just run. Both Step 4 (Import) and Step 5 (Framework routing) consume them from that stash. Then run `project get` as above and, if the directory is not already mapped to that project, call `project_set` with the values read from `FormioAppConfig` — a workspace cloned onto a fresh machine has the URLs in its source and nothing on record, and `project_import` fails without the mapping.
- The user's opening message already contained both URLs in a recognizable form (rare, but honor it) — still persist them with `project_set`.

## What to stash for later steps

```
FORMIO_PROJECT_URL = <captured Project URL with no trailing slash>
FORMIO_BASE_URL = <captured Base URL with no trailing slash>
```

Step 4 (Import) passes the Project URL to `project_import` — typically the first authenticated call, which triggers the portal-login flow on a token cache miss. The framework handoff (Step 5) passes both URLs to the framework's SETUP so its URL interview is skipped.
