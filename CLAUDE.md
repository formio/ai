# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Formio MCP Server — a Model Context Protocol (MCP) server for [Form.io](https://form.io). This project is in early development with no source code implemented yet.

## Repository Info

- **Organization:** Form.io
- **License:** MIT
- **Remote:** git@github.com:formio/ai.git

## Skills Library

The repository ships a Claude skills library at [plugin/skills/](plugin/skills/) covering every endpoint in the [Form.io API Postman collection](https://documenter.getpostman.com/view/684631/2sBXiok9LB). The Form.io API surface is consolidated into a single activatable skill at [plugin/skills/formio-api/SKILL.md](plugin/skills/formio-api/SKILL.md); per-capability-group endpoint details live as reference documents under [plugin/skills/formio-api/references/](plugin/skills/formio-api/references/) (one `.md` file per group, no frontmatter). Claude activates the router skill whenever the user asks about a Form.io REST endpoint and navigates into the relevant reference by scope (platform, project, runtime, pdf).

The library's default "build me an app" entry point is [`skills/formio-application/`](skills/formio-application/) — a framework-agnostic orchestrator that runs the full pipeline from plain-language intent through `formio-resource-planner`, the `project_import` MCP tool, and handoff to a framework-specific scaffolding skill. Today the only framework implementor is [`skills/formio-angular/`](skills/formio-angular/) (with its sub-skill [`skills/formio-angular/resources/`](skills/formio-angular/resources/) for per-resource NgModule work); `formio-angular` is no longer a top-level build-an-app skill — it is the Angular-specific implementor that `formio-application` delegates to. Future framework skills (`formio-react`, etc.) add themselves as rows in `skills/formio-application/FRAMEWORK.md`'s registry table; no other change to the orchestrator is required.

Authentication and authorization are owned by a stand-alone peer skill at [`skills/formio-auth/`](plugin/skills/formio-auth/). The planner ↔ auth handoff contract is explicit: `formio-resource-planner` owns the data model (roles, the `user` Resource, login/registration forms, group joins) and emits the canonical `template.json` shapes for the Login Action, Role Assignment Action, Group Assignment Action, `access` arrays, `submissionAccess` arrays, and field-based `submissionAccess` on group-reference selects. `formio-auth` owns the auth configuration that runs on top of that model — SSO (OIDC / OAuth, SAML, LDAP) with provider Role Mapping, Token Swap from an external OIDC token, Custom JWT (Enterprise / on-prem, signed with `JWT_SECRET`), email-token (passwordless) authentication, JWT and session mechanics (the `x-jwt-token` header, `jti` Session ID, logout semantics, 2FA, reCAPTCHA), and RBAC tuning beyond default roles. Action JSON shapes are NOT duplicated across the two skills; `formio-auth` references the planner's `references/template-json.md` by file path. When a planner-produced Resource Map's `Users & Auth` section emits a non-`none` `SSO` field, a `Custom JWT: yes`, or any other auth concern beyond resource-backed login plus Role Assignment plus Group Assignment, hand off to `formio-auth` immediately after the Resource Map is approved.

The router skill's `description` follows a three-clause template: capability statement, a "Use when the user asks to …" trigger clause, and a "Not for: …" negative-trigger clause disambiguating from `formio-application` (orchestrator) and `formio-resource-planner` (planner). Each reference document includes a `## MCP Tool Preference` section instructing Claude to prefer the MCP server's first-party tools (`form_*`, `role_*`, `project_*`, `authenticate`) when they cover the requested operation.

Authentication: the MCP server uses a browser-based portal-login flow — a short-lived local Express server renders the Form.io portal login form and captures the returned JWT via a `/callback` endpoint; `formioFetch` then attaches `x-jwt-token` on every request. Skills do NOT use PKCE or API-key auth.

Skills are validated by [packages/mcp-server/src/skills-validator.ts](packages/mcp-server/src/skills-validator.ts); `pnpm test` fails if the router's frontmatter drifts, the router description is missing its trigger or negative-trigger clause, any required reference file is missing or empty, any reference doc drifts from the required heading layout, the canonical portal-login JWT auth paragraph is missing (except in `server-status.md`), or scope-consistency rules are violated. Terminology is strict: `baseUrl`/`base_url` refers only to `FORMIO_BASE_URL`; `projectUrl`/`project_url` refers only to `FORMIO_PROJECT_URL`.

## Iterating on skills

Some skills ship with their own eval harness for measuring whether a change improved or regressed the skill. The convention is:

- `skills/<skill>/evals/evals.json` — test prompts + `expected_output` per eval
- `skills/<skill>/evals/grade.py` — structural assertions; reads `.eval-artifacts/<skill>/iteration-N/` and writes `grading.json` per run
- `skills/<skill>/evals/README.md` — the teammate-facing runbook (seed fixtures → spawn subagents → grade → aggregate → viewer)
- `skills/<skill>/evals/fixtures/` — optional; inputs the evals need (e.g., seed Angular workspaces)
- `.eval-artifacts/<skill>/iteration-N/` — run outputs, gitignored per this repo's `.gitignore`

**When the user asks to iterate on, test, or measure a skill change, read that skill's `evals/README.md` first — don't improvise.** The standard iteration loop is the same across skills, but each skill's README documents its own skill-specific add-ons (e.g., the planner's "refresh `references/examples/` after grading" step, or the angular skill's `fixtures/existing-workspace-seed/` copy step). Prefer invoking the `skill-creator` skill to drive the full loop when it's installed; fall back to the README's manual steps otherwise.

Skills currently using this pattern: `formio-resource-planner` and `formio-angular` (the resource sub-skill lives at `plugin/skills/formio-angular/resources/` and keeps its own eval harness under `plugin/skills/formio-angular/resources/evals/`). The consolidated `formio-api` skill does not yet have an eval harness — add one under `plugin/skills/formio-api/evals/` following the same layout if you need to measure reference-navigation or activation-precision changes there.

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
