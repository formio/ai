## 1. The committed file: shape and discovery
<!-- depends_on: none -->

### Red

- [x] 1.1 Create `packages/mcp-server/src/__tests__/committed-config.test.ts` with a failing test: a `formio.json` holding only `projectUrl` is read, and its value is returned with trailing slashes stripped
- [x] 1.2 Write a failing test: a file holding both `projectUrl` and `baseUrl` returns both
- [x] 1.3 Write a failing test: unknown keys (a `$schema` entry) are ignored rather than rejected
- [x] 1.4 Write a failing test: a file with no `projectUrl` raises an error naming the file's path and the missing key
- [x] 1.5 Write a failing test: a file whose `projectUrl` fails URL validation raises an error naming the path and the `projectUrl` key — and the message does NOT say the directory is unconfigured
- [x] 1.6 Write a failing test: an unparseable file raises a distinguishable error type, so a caller can tell it from "no file found" (mirrors `ProjectMapUnreadableError`)
- [x] 1.7 Write a failing test for the walk: `apps/web/formio.json` wins over a repository-root file when `cwd` is `apps/web`
- [x] 1.8 Write a failing test: a directory with no file of its own is governed by the nearest ancestor's
- [x] 1.9 Write a failing test for the boundary: with `$HOME/formio.json` present and `$HOME/work/app/.git` present, `cwd` of `$HOME/work/app` finds NO committed configuration
- [x] 1.10 Write a failing test: the directory holding `.git` is itself searched, so a repository-root file is found from a nested `cwd`

### Green

- [x] 1.11 Add `packages/mcp-server/src/committed-config.ts` — the file's parse-and-validate (reusing `normalizeHttpUrl`), the upward walk, and the inclusive `.git` boundary
- [x] 1.12 Add the distinguishable unreadable/invalid error class alongside the existing `ProjectMapUnreadableError` pattern

### Refactor

- [x] 1.13 Review implementation and refactor as needed

## 2. Precedence by scope, both URLs
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write a failing test: a committed file outranks a personal mapping, with `sources.projectUrl === 'committed'`
- [x] 2.2 Write a failing test: a personal mapping outranks `FORMIO_PROJECT_URL`, with source `mapping` — the reversal of today's rule, so also assert the environment value is NOT used
- [x] 2.3 Write a failing test: with neither file nor mapping, `FORMIO_PROJECT_URL` resolves with source `environment`
- [x] 2.4 Write a failing test: a CI-shaped setup — environment only, no committed file, no mapping — resolves the environment value, since determinism comes from being the sole candidate rather than from rank
- [x] 2.5 Write a failing test: the base URL resolves through the same order — committed, then mapping, then environment
- [x] 2.6 Write a failing test: a committed `projectUrl` with no committed `baseUrl` still derives by the shape rules (`/one/two` → `/one`, source `derived`)
- [x] 2.7 Write a failing test asserting `project_set` can now redirect a directory whose `FORMIO_PROJECT_URL` names a different project — the behavior today's spec explicitly forbids
- [x] 2.8 Write a failing test: an API-key deployment with an unresolved base URL still completes, unchanged by the new layer
- [x] 2.9 Write a failing test: a broken committed file fails with its own error rather than the unconfigured-project error, from a project-scoped tool call

### Green

- [x] 2.10 Widen `ProjectUrlSource` to `committed | mapping | environment` and `BaseUrlSource` to add `committed`
- [x] 2.11 Rewrite the precedence in `resolveProject` as one ordered candidate list per URL, replacing the current environment-first project branch and the borrow-the-mapped-base-URL special case that only existed because the two halves disagreed
- [x] 2.12 Extend the unresolvable-project error to name `formio.json` alongside `project_set`, and to say the upward walk found no file

### Refactor

- [x] 2.14 Review implementation and refactor as needed

## 3. Writing the committed file
<!-- depends_on: 1 -->

### Red

- [x] 3.1 Write a failing test: `project set --project-url … --cwd X` with no `--scope` writes the personal mapping and creates no `formio.json` — today's behavior, pinned so the default cannot drift
- [x] 3.2 Write a failing test: `--scope repo` with no existing file creates one in the `--cwd` directory and prints the path written
- [x] 3.3 Write a failing test: `--scope repo` with an existing repository-root file updates THAT file rather than creating a nested one, and prints its path
- [x] 3.4 Write a failing test: `--scope repo --base-url` alone updates only the base URL of an existing committed file
- [x] 3.5 Write a failing test: `--scope repo` with neither URL fails naming both flags
- [x] 3.6 Write a failing test for the `project_set` tool: `scope: 'repo'` writes the committed file, and omitting `scope` writes the mapping
- [x] 3.7 Write a failing test: an invalid `--scope` value fails with a message naming the two valid values

### Green

- [x] 3.8 Add `--scope` to `project set` and the write path for the committed file, reusing the discovery walk to find the file to update
- [x] 3.9 Add the `scope` argument to the `project_set` tool and describe both scopes in its description

### Refactor

- [x] 3.10 Review implementation and refactor as needed

## 4. Reporting: which layer won, and what it shadowed
<!-- depends_on: 2, 3 -->

### Red

- [x] 4.1 Write a failing test: `project get` names the winning committed file by its absolute path, not merely as "a committed file"
- [x] 4.2 Write a failing test: a personal mapping shadowed by a committed file is REPORTED, naming the project it holds
- [x] 4.3 Write a failing test: a `FORMIO_PROJECT_URL` shadowed by either file is reported rather than omitted
- [x] 4.4 Write a failing test: with nothing configured, the message names both `project set` and `formio.json`
- [x] 4.5 Write a failing test: on a broken committed file, `project get` exits `2`, names the path, and does not report the directory as unconfigured
- [x] 4.6 Write a failing test: the unresolved-base-URL output names the `formio.json` `baseUrl` key alongside `project set --base-url`
- [x] 4.7 Write a failing test asserting the server's declared `instructions` describe the committed file as the reviewable way to record a target, and state the precedence order in one line

### Green

- [x] 4.8 Extend the `Source:` reporting in `cli/project-command.ts` with the committed source, the winning file's path, and the shadowed-layer lines
- [x] 4.9 Update `SERVER_INSTRUCTIONS` per the `server-config` delta, reading the shape guidance from the existing shared constant rather than restating it

### Refactor

- [x] 4.10 Review implementation and refactor as needed

## 5. Skills and shipped surface
<!-- depends_on: 4 -->

### Red

- [x] 5.1 Write a failing test asserting every tool-calling skill's preflight names `formio.json` as a possible source of the resolved values, without restating the precedence order
- [x] 5.2 Write a failing test asserting `formio-mcp-setup` offers `--scope repo` when the working directory is inside a git repository, states in one line that a committed file is shared with everyone who clones, and does NOT offer it outside a repository
- [x] 5.3 Extend the existing no-restated-guidance sweeps to cover the new file: no skill document may enumerate the precedence order or the `.git` boundary rule — the server reports which layer won, and the skills relay it
- [x] 5.3a Write a failing guard test asserting THIS repository contains no `formio.json` at its root or in any tracked directory — one committed here is discovered by every `project get` in the tree and would silently govern every skill invocation, eval run, and test
- [x] 5.3b Write a failing test asserting the scaffolding skills write `formio.json` into the application workspace they create, never into an ancestor of it

### Green

- [x] 5.4 Add the one-clause mention of `formio.json` to the shared preflight paragraph in all ten tool-calling skills, worded identically so the sweeps hold
- [x] 5.5 Update `formio-mcp-setup/SKILL.md`'s project step with the scope offer and its git-repository condition
- [x] 5.6 Check `README.md`, `plugin/README.md`, and `llms-install.md` for statements that `FORMIO_PROJECT_URL` pins or that the mapping is the only per-directory mechanism, and correct any found

### Refactor

- [x] 5.7 Review implementation and refactor as needed

## 6. Migration, spec sync, and repo checks
<!-- depends_on: 1, 2, 3, 4, 5 -->

### Red

- [x] 6.1 Write a failing test asserting `openspec/specs/project-map-routing/spec.md` no longer ranks the environment above the mapping, and that both URLs are documented as resolving through one order

### Green

- [x] 6.2 Write a changeset with an explicit BREAKING note: `FORMIO_PROJECT_URL` is no longer a pin, and a launch relying on the old precedence silently changes target if — and only if — its checkout carries a `formio.json` or its `cwd` has a mapping. The migration is to remove whichever of those contradicts the intended target
- [x] 6.3 Apply the four delta specs in `openspec/changes/committed-project-configuration/specs/` to their counterparts under `openspec/specs/`, creating `openspec/specs/committed-project-config/spec.md` for the new capability
- [x] 6.4 Run `pnpm test`, `pnpm lint`, and `pnpm format`; prose-wrap only the skill markdown files this change edited, never the whole tree
- [x] 6.5 Confirm no `formio.json` is added to `.gitignore` anywhere, since the file exists to be committed in a consumer's application repository — and confirm none is committed to THIS repository

### Refactor

- [x] 6.6 Review implementation and refactor as needed
