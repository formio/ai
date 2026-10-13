## Why

Most of the wrong statements the pre-1.0 review found would have been caught by a test that compared the skills with the code they describe: an SDK call that does not exist, a tool argument the schema does not take, a hardcoded version that moved. The unit tests also mock Form.io, so they prove the server does what we believe Form.io does — only the live run on 2026-10-13 proved it against a real deployment, and that run was manual. Before 1.0 freezes the surface, this change adds the checks that keep the skills, the server, and their documentation from drifting apart again, and makes the live run repeatable.

## What Changes

- **Live tool runner.** `pnpm test:live` drives the built MCP server over stdio and calls every registered tool against a real Form.io project, with a guaranteed clean-up. It targets the project the repository folder resolves to (a `project_set` mapping or `FORMIO_PROJECT_URL`) and refuses to run unless that URL matches `FORMIO_LIVE_TEST_PROJECT`. A test fails when a registered tool has no live case. Opt-in: not part of `pnpm test` or CI.
- **Skill examples checked against the packages.** Imports in `formio-sdk`, `formio-form`, and `formio-react-form` examples are checked against what the installed packages export, and the self-contained `formio-sdk` TypeScript examples are type-checked against the installed `@formio/js`.
- **Skill text checked against the tool schemas.** Every tool a skill names is registered; every argument named beside a tool is one its input schema takes; documented enum values are the schema's.
- **The preflight's list of writing tools comes from the tool annotations**, not a hand-kept copy.
- **Hardcoded versions become run-time lookups** in `formio-react` and `formio-angular` (React Router and Vite peers, the zone.js peer, "Angular 21", stylesheet sizes), as the Angular bootstrap already does with `npm view`.
- **tools/list headroom.** The per-schema `$schema` key the SDK emits (about 2,550 characters) is removed, and the "fields sent overwrite" sentence repeated in three update tools is shortened.
- **Corrections:**
  - The planner grader no longer requires a Save action on a login form, which the planner deliberately omits, and gains a check that a login form's Save never sets `settings.resource`.
  - `formio-mcp-setup`'s "too old" section loses its dead sub-branch (a same-version pin awaiting publication) and the 0.9.0 notes, and its `>=0.9.0` range, which contradicts the exact pins; the upgrade path itself stays.
  - The `project-url-variables` test that greps `project_set.ts` source moves to the server's registration test.
  - Retired names leave `CLAUDE.md`, five specs, and the README's MCP Inspector screenshots.
- **Unchanged by decision:** the preflight preamble stays inline in every tool-calling `SKILL.md`; the revisions licence check stays, since revisions are a separately licensed package.

## Capabilities

### New Capabilities

- `live-tool-tests`: the opt-in runner against a real deployment.
- `skill-code-checks`: examples checked against installed packages, and skill text checked against tool schemas.

### Modified Capabilities

- `tool-description-budget`: tools/list carries no per-schema `$schema` key.
- `formio-mcp-setup-skill`: the writing-tools list follows the annotations; the too-old section is trimmed.
- `formio-react-skill`, `formio-angular-skill`: versions are resolved at run time.
- `formio-resource-planner-skill`: the grader follows the planner's login-form rule.
- `formio-application-skill`, `formio-form-builder-skill`: the retired `authenticate` tool is removed from their requirements.

## Impact

- `packages/mcp-server`: a `$schema`-stripping step on registration; a live-test harness (`test:live`, its own Vitest config); a registration-test assertion.
- `packages/skill-tests`: new example and tool-reference suites; derived writing-tools list; the moved assertion; dev dependencies for `@formio/react` type-checking.
- `plugin/skills`: `formio-react` and `formio-angular` version text; `formio-mcp-setup` too-old section; `llms-install.md`.
- Planner `grade.py`; READMEs and screenshots; `CLAUDE.md`; five main specs' retired names.
- Changesets: `@formio/mcp` patch, `@formio/ai` patch.
