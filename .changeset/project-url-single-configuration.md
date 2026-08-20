---
'@formio/mcp': minor
'@formio/ai': minor
---

Make the Project URL the single piece of configuration, resolve it by scope, and let the server own the guidance for it.

Configuring a project used to mean answering two questions in several places. The Project URL and the Base URL were collected together at install time and again per directory; the base URL silently defaulted to `https://api.form.io` whether or not that could be right; the environment outranked the per-directory mapping for one URL and lost to it for the other; and the guidance for choosing either value was duplicated across five skill documents that could each drift. This release reduces all of it to one value, one order, and one owner.

## One value to supply

**The Project URL is the only value a user is asked for.** The Base URL is derived from it wherever it can be:

- a project on a `form.io` host derives `https://api.form.io`;
- a project addressed as a sub-directory derives its **parent path** — `https://forms.mysite.com/one/two` derives `https://forms.mysite.com/one`, not the bare origin, because a deployment may itself be mounted at a sub-path;
- a path-less project URL on a customer domain derives nothing, because its deployment is a sibling sub-domain that nothing in the project URL names.

Guidance that said a base URL never carries a path is corrected: a sub-path-mounted deployment is legitimate, and the server must not publish a rule its own derivation breaks.

**BREAKING (runtime behavior, narrowly): the base URL is never defaulted.** In the third shape above it stays unresolved, and the first call that authenticates with a JWT fails naming `project set --base-url`, the `formio.json` `baseUrl` key, and the project it applies to. Previously that setup silently attempted a portal login against `https://api.form.io` and keyed its token cache there — a setup that could not authenticate anyway, so this converts a late, opaque auth failure into an early, actionable one. Resolution itself still succeeds with the value absent, and API-key deployments never read it, so they are unaffected. Nothing else changes: the hosted cloud and sub-directory routing both derive as before, with the reported source now `derived` rather than `default`. **`sources.baseUrl` and `project get`'s `Source:` line change strings for that case.**

**`FORMIO_DEFAULT_PROJECT_URL` is removed.** It existed only because `FORMIO_PROJECT_URL` used to pin the server, so an install-time prompt wired to it would defeat every later mapping. With the environment now the weakest source (below), `FORMIO_PROJECT_URL` already suggests without pinning — exactly what the offering variable was invented to guarantee. It never took part in resolution, so nothing resolves differently; it simply no longer appears in the resolution error, `project get`, the server instructions, or the registry environment list. **Migration:** remove it wherever it is set. Where an install-time answer is the only route — the `.mcpb` desktop bundle — set `FORMIO_PROJECT_URL` instead; the bundle now does exactly that.

## One resolution order, by scope

**BREAKING: resolution is ordered narrowest scope first, and identically for both URLs** — a committed `formio.json`, then the per-directory mapping in `~/.formio/projects.json`, then the environment. Previously the project URL resolved environment-first while the base URL already resolved mapping-first, so one pair resolved in two directions.

`FORMIO_PROJECT_URL` is therefore **no longer a pin**: a committed file or a mapping overrides it, and `project_set` can redirect a directory whose environment names a different project. A launch that relied on the old precedence changes target if — and only if — its checkout carries a `formio.json` or its working directory has a mapping. The migration is to remove whichever source contradicts the intended target; a deployment that must resolve one project deterministically should supply only the source it wants used.

**A committed `formio.json` is the new versionable source.** It holds `projectUrl` and optionally `baseUrl`, and is found by walking up from the working directory, taking the first file and never ascending past a directory containing `.git`. The nearest file wins, so a monorepo can point two application folders at two projects. Unlike the machine-local map, it travels with the code: it survives a clone and is visible in review. Write it with `project set --scope repo` or the `project_set` tool's `scope: "repo"`, which records it in the application's own folder rather than an ancestor — a file placed higher governs every unrelated project beneath it. `formio-angular` now writes one into the workspace it configures, so a clone resolves the project its `config.ts` was generated for.

Relatedly, an unreadable `~/.formio/projects.json` is no longer skipped for a launch that sets `FORMIO_PROJECT_URL`. Skipping it was safe only while the map ranked below the environment; now that it ranks above, reading past a file that cannot be parsed could resolve a value the unreadable entry would have overridden. It is still tolerated when a committed file supplies both URLs, because nothing is left for the map to decide.

## The server owns the guidance; the skills relay it

**Configuration errors are self-sufficient and staged.** Each names the exact remedy command in both vocabularies — the MCP tool and the runnable shell command — so an agent that never read the server's instructions can still act. They arrive one at a time: no project URL resolves → an error asking for the Project URL alone, describing what one is with an example per deployment kind; a project URL resolves but its base URL cannot be determined → a separate error naming that project URL and asking for the deployment alone. Fixing the first surfaces the second instead of presenting a compound failure.

**`project set --project-url` is optional once a directory has a project mapped**, which is what makes the base-URL remedy runnable: `project set --base-url <url>` no longer fails for a project URL the directory already has. Either flag alone is a valid partial update; with nothing mapped, `--project-url` is still required.

**`project get` is the single read surface.** It prints both URLs, names the winning source for each — including a committed file by absolute path — reports any source it shadowed, and exits `0` / `1` / `2` so a caller can tell "nothing recorded here" from "this command could not answer". Every skill that calls Form.io tools now runs it before its first deployment-touching call and relays whatever it says, branching on exit `1` (interview) versus exit `2` (do not interview — an unreadable map, a broken `formio.json`, a malformed URL, all of which a `project set` would fail on for the same unreported reason). `formio-mcp-setup` probes first and interviews only on failure. `formio-resource-planner` is the one exemption: it calls no MCP tool, and its Phase B emission now reads as the menu it prints rather than as calls it makes, naming who owns the gate for each option.

**Skills stop carrying URL wording.** Deleted from the library and left to the server: the three-valid-shapes enumeration, the plain-language descriptions and example values, the validation rules, the Base-URL derivation table, and the per-skill exit-code tables. `formio-application/DEPLOYMENT.md` is deleted outright — once the wording moves, what remains is four lines that belong in the preflight every skill now carries. With resolution in the preflight there is no Deployment step left to order, so **`formio-application` drops to four steps: Intent → Plan → Import → Framework.** (Breaking for the spec and its assertions, not for users.)

**No client prompts for anything at install time.** The Claude Code and Cursor manifests launch the server with `command` and `args` alone — no `userConfig`, no `variables`, no `env`. An install-time answer is the wrong scope for both values: a Form.io project is one-to-one with the application built against it, so an answer typed once is right for one directory and wrong for the next, and a global base URL silently satisfied every project including ones on another deployment. The `.mcpb` desktop bundle keeps its prompts deliberately — a desktop host has no working directory to map and no repository to commit into — and its project prompt sets `FORMIO_PROJECT_URL`, which now suggests without pinning.

## One name per job, enforced

Three uses were conflated under a single spelling. Each now has one:

| Use | Spelling |
| --- | --- |
| A substitution slot in an endpoint or example | `{projectUrl}` / `{baseUrl}` — single braces |
| A value passed between phases or skills | prose, or a `projectUrl` / `baseUrl` field |
| The environment variable | `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL`, only where the subject is the environment |

Spelling a slot or a handoff value with an `FORMIO_*` name told an agent to read an environment variable in order to build a URL — a different and wrong action, and one that finds nothing, because no shipped manifest sets an environment at all. 234 endpoint roots across the `formio-api` references were renamed, plus 24 slots (`{{FORMIO_PROJECT_URL}}`, `$FORMIO_PROJECT_URL`, `<FORMIO_BASE_URL>`, `YOUR_FORMIO_BASE_URL`, `{FORMIO_PROJECT_URL}`) and 24 handoff values across 18 skill documents. Single braces keep a slot distinct from Postman's `{{baseUrl}}`, which stays disallowed outside code spans.

**The rule is now checked rather than described.** `api-skills-validation` had specified a `validateLibrary` suite that no longer existed, so its rules — this one included — were prose nothing ran. The validator is rebuilt in `@formio/skill-tests` and fails the run on a regression, covering the terminology rule, resolved Postman placeholders, the required reference layout, the canonical portal-login auth paragraph, legacy-auth tokens, PDF proxy scope, example-value suffixes, and the `formio-sdk` import rules. `@formio/core` is not banned outright there: the SDK skill documents a named set of helpers `@formio/js` does not re-export, and importing those is the fallback it teaches, so only a default, namespace, or unsanctioned named import fails.

## Two smaller behavior changes

**A global `FORMIO_BASE_URL` no longer overwrites a derivable one.** `project_set` and `formio-mcp project set` fall back to the environment's base URL only for a project URL that derives no deployment of its own. Previously, setting a project on `https://forms.mysite.com/myproject` with `FORMIO_BASE_URL=https://api.form.io` exported wrote that global into the mapping, where it outranked derivation for that directory permanently and pointed the portal login at a deployment the user does not use. Directories already mapped that way keep what is recorded; pass `--base-url` to change one deliberately. `smithery.yaml` stopped defaulting the same value into every install for the same reason.

**`project get` reports more.** Shadowed base URLs are reported alongside shadowed project URLs, from separately tracked candidate lists — the two halves resolve independently, so one shared list credited a shadowed deployment to whichever layer supplied the project. And a note about an ignored unusable `FORMIO_BASE_URL` now travels with the unresolved-base-URL failure it caused instead of being dropped.
