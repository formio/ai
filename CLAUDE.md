# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@formio/ai` — the Form.io agentic coding toolset. A pnpm + Turborepo monorepo shipping three things: the `@formio/mcp` Model Context Protocol server (`packages/mcp-server/`, exposing `form_*` / `role_* `/ `action_*` / `project_*` tools), the `@formio/ai` agent plugin (`plugin/`, bundling the server + skill library behind three manifests — `.claude-plugin/plugin.json` for Claude Code, `.cursor-plugin/plugin.json` for Cursor, and `plugin.json` + `mcp.json` for the vendor-neutral Agent Plugins layout), and a `@formio/skill-tests` package (`packages/skill-tests/`) that runs the `formio-sdk` skill's doc examples against the real `@formio/js`. The skill library lives at `plugin/skills/` (eleven activatable skills). It is also installable skills-only with `npx skills add formio/ai`, in which case [`plugin/skills/formio-mcp-setup/`](plugin/skills/formio-mcp-setup/) connects the MCP server on first use — every other skill carries a preflight that hands off to it when the Form.io tools are missing, and is forbidden from working around the gap with raw HTTP.

## Repository Info

- **Organization:** Form.io
- **License:** MIT
- **Remote:** git@github.com:formio/ai.git

## Skills Library

The repository ships a Claude skills library at [plugin/skills/](plugin/skills/) covering every endpoint in the [Form.io API Postman collection](https://documenter.getpostman.com/view/684631/2sBXiok9LB). The Form.io API surface is consolidated into a single activatable skill at [plugin/skills/formio-api/SKILL.md](plugin/skills/formio-api/SKILL.md); per-capability-group endpoint details live as reference documents under [plugin/skills/formio-api/references/](plugin/skills/formio-api/references/) (one `.md` file per group, no frontmatter). Claude activates the router skill whenever the user asks about a Form.io REST endpoint and navigates into the relevant reference by scope (platform, project, runtime, pdf).

The library's default "build me an app" entry point is [`plugin/skills/formio-application/`](plugin/skills/formio-application/) — a framework-agnostic orchestrator that runs the full pipeline from plain-language intent through `formio-resource-planner`, the `project_import` MCP tool, and handoff to a framework-specific scaffolding skill. Today the only framework implementor is [`plugin/skills/formio-angular/`](plugin/skills/formio-angular/) (with its sub-skill [`plugin/skills/formio-angular/formio-angular-resources/`](plugin/skills/formio-angular/formio-angular-resources/) for per-resource NgModule work); `formio-angular` is no longer a top-level build-an-app skill — it is the Angular-specific implementor that `formio-application` delegates to. Future framework skills (`formio-react`, etc.) add themselves as rows in `plugin/skills/formio-application/FRAMEWORK.md`'s registry table; no other change to the orchestrator is required.

Authentication and authorization are owned by a stand-alone peer skill at [`plugin/skills/formio-auth/`](plugin/skills/formio-auth/). The planner ↔ auth handoff contract is explicit: `formio-resource-planner` owns the data model (roles, the `user` Resource, login/registration forms, group joins) and emits the canonical `template.json` shapes for the Login Action, Role Assignment Action, Group Assignment Action, `access` arrays, `submissionAccess` arrays, and field-based `submissionAccess` on group-reference selects. `formio-auth` owns the auth configuration that runs on top of that model — SSO (OIDC / OAuth, SAML, LDAP) with provider Role Mapping, Token Swap from an external OIDC token, Custom JWT (Enterprise / on-prem, signed with `JWT_SECRET`), email-token (passwordless) authentication, JWT and session mechanics (the `x-jwt-token` header, `jti` Session ID, logout semantics, 2FA, reCAPTCHA), and RBAC tuning beyond default roles. Action JSON shapes are NOT duplicated across the two skills; `formio-auth` references the planner's `references/template-json.md` by file path. When a planner-produced Resource Map's `Users & Auth` section emits a non-`none` `SSO` field, a `Custom JWT: yes`, or any other auth concern beyond resource-backed login plus Role Assignment plus Group Assignment, hand off to `formio-auth` immediately after the Resource Map is approved.

The library also ships [`plugin/skills/formio-sdk/`](plugin/skills/formio-sdk/) — a source-derived reference for the `@formio/js` SDK and `@formio/js/utils` Utilities, authored directly from the Form.io source code (`packages/core/src/sdk`, `packages/core/src/utils`, `packages/formio.js/src/Formio.js`, `packages/formio.js/src/utils`) rather than from drift-prone online docs. Reference docs cover SDK setup, auth, forms, submissions, projects, roles, files, plugins, VanillaJS rendering (`Formio.createForm`), and the Utils surface (Evaluator, form traversal, conditions, logic, JSONLogic, mask/sanitize, misc). The skill mandates ESM imports (`import { Formio } from '@formio/js'`, `import { Utils } from '@formio/js/utils'`), and gates the URL configuration it documents: `Formio.setBaseUrl` / `Formio.setProjectUrl` calls written into a user's application take their values from `project get`, never a hardcoded example host.

The router skill's `description` follows a three-clause template: capability statement, a "Use when the user asks to …" trigger clause, and a "Not for: …" negative-trigger clause disambiguating from `formio-application` (orchestrator) and `formio-resource-planner` (planner). Each reference document includes a `## MCP Tool Preference` section instructing Claude to prefer the MCP server's first-party tools (`form_*`, `role_*`, `project_*`, `authenticate`) when they cover the requested operation.

Project configuration: there is ONE value to supply — the **Project URL**, the full URL of the Form.io project a piece of work reads and writes. The **Base URL** (the deployment hosting it) is derived from that project URL wherever it can be: `https://api.form.io` for a `form.io` host, and the project URL minus its final path segment for a deployment that routes projects to sub-directories. It is asked for only when it cannot be derived, which is a project URL carrying no path on a customer domain (`https://myproject.mysite.com`), whose deployment is a sibling sub-domain that nothing in the project URL names.

A record holds a project and its deployment as a PAIR, and resolution picks ONE record by scope, narrowest first: a committed `formio.json` found by walking up from the working directory (stopping at a directory containing `.git`), then the working-directory mapping in `~/.formio/projects.json`, then `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL` in the environment, which are the WEAKEST source. Both resolved values come from the winning record — its own deployment, or the one derived from its project URL — and halves are never combined across records, so a `FORMIO_BASE_URL` in the environment does not supply the deployment for a project a mapping or a committed file names. The environment therefore does not pin anything, and `project_set` can redirect a directory whose environment names a different project. There is no variable that merely offers a project. The committed `formio.json` is hand-authored: the server reads it and never writes it, and `project_set` records only the mapping.

Skills never interview for these URLs and never restate the guidance the server owns — the one exception is `plugin/skills/formio-mcp-setup/references/project-urls.md`, the canonical copy every other document links to instead of restating. Before its first deployment-touching call, a tool-calling skill calls the `project_get` MCP tool with `cwd` set to the user's working directory and branches on the `status` it returns (`ok` / `not-configured` / `base-url-unresolved`), recording whatever value the report names with `project_set`; a call that fails outright rather than returning a status is a broken record, not an absent one, so it is relayed rather than interviewed around. Skills do NOT shell out to `npx @formio/mcp project get` for this — the connected server answers it over the open transport with the same resolver every other tool uses. The `project get` / `project set` CLI subcommands remain, for `formio-mcp-setup`, which runs before any tool exists to call. `formio-mcp-setup` is the handoff target for a resolution failure; `formio-resource-planner` is exempt because it calls no MCP tool. Writing a URL into a user's application (`Formio.setBaseUrl`, `Formio.setProjectUrl`, `FormioAppConfig`'s `appUrl` = Project URL and `apiUrl` = Base URL) needs the values rather than a deployment, so it takes them from `project_get` when the tools are callable and from the user when they are not — never hardcoded.

Authentication: the MCP server uses a browser-based portal-login flow — a short-lived local Express server renders the Form.io portal login form and captures the returned JWT via a `/callback` endpoint; `formioFetch` then attaches `x-jwt-token` on every request. Skills do NOT use PKCE or API-key auth.

Skill authoring conventions (not enforced by automated tests): the router's frontmatter and three-clause description, required reference files present and non-empty, the required reference-doc heading layout, the canonical portal-login JWT auth paragraph (except in `server-status.md`), and scope consistency. Terminology is strict, and one spelling per job: an `FORMIO_*` name means the **environment variable** and nothing else. That rule IS enforced for the two URL names — `FORMIO_PROJECT_URL` and `FORMIO_BASE_URL` — over every markdown file under `plugin/skills/`: see `packages/skill-tests/src/skill-descriptions/url-terminology.test.ts`, which rejects either name used as a substitution slot (`${…}`, `$…`, `{…}`, `{{…}}`, `<…>`, `YOUR_…`) or as the name of a value passed between phases, and allows the bare name only in a paragraph whose subject is the environment (an `env` block, an environment variable, the resolution order). `formio-angular/BOOTSTRAP.md`'s `FORMIO_ANGULAR_VERSION` / `FORMIO_JS_VERSION` capture labels are outside that rule's scope — they name resolved npm versions, not URLs, and no environment variable of either name exists — so if the rule is ever meant to reach them, widen the validator rather than relying on the prose. A substitution slot in an endpoint heading or code example is `{projectUrl}` / `{baseUrl}` — single braces, so it stays distinct from Postman's `{{baseUrl}}`, which must not appear unresolved in prose. A value handed between phases or skills is named in prose ("the Project URL") or as a field called `projectUrl` / `baseUrl`. Spelling a slot or a handoff value `${FORMIO_PROJECT_URL}` tells an agent to read an environment variable in order to build a URL, which is a different and wrong action.

Skill markdown formatting: no hard line wraps — write each paragraph (and each frontmatter `description`) as a single line. Prose renders identically either way, and unwrapped lines keep edits from forcing a re-flow of the rest of the paragraph. If wraps sneak back in, unwrap the **specific files you edited**, never the tree: `npx prettier --prose-wrap never --ignore-path=/dev/null --write <paths>` (the explicit `--ignore-path` is required because `.prettierignore` excludes `*.md`). Run it on the paths you edited and read the diff — do not sweep the tree. Measured against the pinned Prettier (3.5.3) and this repo's `.prettierrc`, that command does not corrupt `${…}` tokens or `SHOUTY_CASE` names; what it does change is emphasis style (`*x*` becomes `_x_`), and — only if `printWidth` is ever lowered — table alignment padding and the line structure of fenced JSON. It DOES reformat a ` ```markdown ` fence, because Prettier formats embedded markdown as markdown: running it on `formio-resource-planner/references/template-md.md` collapses that file's canonical Resource-block layout into run-together lines (`- <ResourceName> (type: resource) Purpose: … Fields:`), destroying the spec agents copy, and re-pads its token tables. Never run it on a file whose fences contain markdown — hand-unwrap those paragraphs instead. `.prettierignore` excludes `*.md`, so `pnpm format` never touches these files and an explicit invocation is the only way they get reformatted. Read the diff rather than trusting either this note or the command.

## Iterating on skills

Some skills have an eval harness for measuring whether a change improved or regressed the skill. Harnesses live **outside** `plugin/`, because `plugin/` is copied into a consumer's own project by `npx skills add formio/ai` and a grader has no meaning there. The convention is:

- `packages/skill-tests/evals/<skill>/evals.json` — test prompts + `expected_output` per eval
- `packages/skill-tests/evals/<skill>/grade.py` — structural assertions; reads `.eval-artifacts/<skill>/iteration-N/` and writes `grading.json` per run
- `packages/skill-tests/evals/<skill>/README.md` — the teammate-facing runbook (seed fixtures → spawn subagents → grade → aggregate → viewer)
- `packages/skill-tests/evals/<skill>/fixtures/` — optional; inputs the evals need (e.g., seed Angular workspaces)
- `.eval-artifacts/<skill>/iteration-N/` — run outputs, gitignored per this repo's `.gitignore`

`<skill>` is the skill's own name, so a nested sub-skill gets a flat harness directory: `packages/skill-tests/evals/formio-angular-resources/`, not a path mirroring where the skill lives.

**When the user asks to iterate on, test, or measure a skill change, read that harness's `README.md` first — don't improvise.** The standard iteration loop is the same across skills, but each README documents its own add-ons (e.g., the planner's "refresh `references/examples/` after grading" step, or the angular harness's `fixtures/existing-workspace-seed/` copy step). Prefer invoking the `skill-creator` skill to drive the full loop when it's installed; fall back to the README's manual steps otherwise.

Harnesses that exist today: `packages/skill-tests/evals/formio-resource-planner/` and `packages/skill-tests/evals/formio-angular-resources/` (the latter grades the nested sub-skill at `plugin/skills/formio-angular/formio-angular-resources/`). The consolidated `formio-api` skill has no harness — add one at `packages/skill-tests/evals/formio-api/` following the same layout if you need to measure reference-navigation or activation-precision changes there.

## OpenSpec

This project uses [OpenSpec](https://openspec.dev/) for spec-driven development. Specs live in `openspec/specs/` organized by capability, and change proposals are generated in `openspec/changes/`.

Install: `npm install -g @fission-ai/openspec@latest`

Use `/openspec:proposal` to plan changes before implementing. Read existing specs in `openspec/specs/` for context on feature requirements and behavior.

## Definition of Done

Work is not complete until all of the following pass:

- **Tests** — all Vitest tests pass (`pnpm test`)
- **Type-check** — no TypeScript errors (`pnpm lint`)
- **Formatting** — code is formatted (`pnpm format`)

TDD is mandatory. Write failing tests first, then implement the minimum code to make them pass.

## Software Patterns and Practices

### TypeScript

- **No `any`** — use `unknown` with type guards, generics, or explicit types instead
- Enable `strict: true` in all `tsconfig.json` files (already set)

### Functional Style

- Prefer pure functions over classes with mutable state
- Prefer `const` and immutable data; avoid reassignment
- Use `map`, `filter`, `reduce` over imperative loops where it improves clarity
- Keep side effects at the edges (I/O, server setup) — keep core logic pure and testable

### Design Principles

- **Single Responsibility** — each function, module, and tool does one thing; if you need "and" to describe it, split it
- **Open/Closed** — extend behavior by adding new modules/tools rather than modifying existing ones; the tool registry pattern (`registerAllTools`) is the primary extension point
- **No backward compatibility** — unless explicitly requested, make breaking changes cleanly without shims, aliases, or legacy fallbacks
- **Parameter objects** — prefer a single options object over multiple positional parameters for functions with more than two arguments
