## Context

A read-only survey on 2026-10-13 (main after #101) checked each drift item.

**Already covered, so out of scope.** The server tests already cover:

- 401-versus-forbidden;
- network failure and timeouts;
- concurrent writes to the project map and the token cache;
- the `plugin/skills/` path ban, added in #99.

**What remains:**

| Item | State |
| --- | --- |
| Example checks | Only hand-copied SDK snippets run today. `formio-sdk` has about 131 TypeScript examples, roughly 60–80 of them self-contained. `formio-form` has 23 JS examples, `formio-react-form` 16. `@formio/react` is not installed anywhere. |
| Tool references | No test checks that a tool a skill names is registered, beyond a list of seven banned old names. |
| Writing-tools list | A hand-kept copy. The rule `readOnlyHint === false && openWorldHint === true` reproduces it exactly, and leaves out `project_set`, which writes locally. |
| tools/list | 41,426 of 42,000 characters. `"$schema":"http://json-schema.org/draft-07/schema#"` repeats on 50 schemas, 2,550 characters. |
| Hardcoded versions | In `formio-react` (React Router engines and peers, plugin-react ↔ Vite) and `formio-angular` (zone.js peer, "Angular 21", stylesheet sizes). The Angular bootstrap already reads versions with `npm view`. |
| Planner grader | Fails all 26 recorded runs on a correct login form. |
| `project-url-variables` test | Greps `project_set.ts` source lines. |
| Retired names | `hello` / `form_revisions_list` in the README's Inspector screenshots. `authenticate` in `CLAUDE.md` and two specs. Old tool names in three spec Purpose lines. |

**Kept by maintainer decision:**

- The ~950-word preflight preamble stays inline in every tool-calling `SKILL.md`. Effectiveness comes first: the preflight must run even when an agent reads only `SKILL.md`.
- The revisions licence check stays. Revisions are a separately licensed Security & Compliance package.

## Goals / Non-Goals

**Goals:**

- A repeatable proof that every tool works against a real deployment.
- Tests that fail when skill text names a tool, argument, export, or version the code does not have.
- Room in tools/list for the 1.0 surface.

**Non-Goals:**

- Moving the preamble.
- Removing the licence check.
- Running the live suite in CI by default.
- Compiling every fragmentary example.

## Decisions

### 1. The live runner uses the product's own resolution, behind an allowlist

`test:live` resolves its target with `project_get` for the repository folder. That is the same resolver every tool uses, so a developer points it with `project_set` and CI with `FORMIO_PROJECT_URL`. Because the run creates and deletes forms, roles, and tags, it refuses unless the resolved Project URL equals `FORMIO_LIVE_TEST_PROJECT` exactly. A folder mapping that drifted to a real project then fails closed.

- **Auth** is the server's own: the cached portal token, with a browser login on first use, or an API key bound to that URL.
- **TLS:** the runner starts the server, and runs its own test worker, with `--use-system-ca` wherever this Node accepts it. A local deployment whose certificate the operating system already trusts then works with verification on and nothing to set; a maintainer's run first failed for exactly that reason. `NODE_EXTRA_CA_CERTS` and the deployment-scoped `FORMIO_INSECURE_TLS` remain for other cases. The runner's own clean-up requests select their dispatcher with the server's `selectDispatcher`, so they trust exactly the hosts the tools reached. The first live run showed why: the tools passed, but clean-up requests made with the plain global `fetch` were refused by the same certificate.
- **Lives in** `packages/mcp-server`, with its own Vitest config, so `pnpm test` never picks it up.

*Alternatives:* a dedicated env-only target would skip the resolver the tools depend on, and running in CI by default needs a standing deployment and credentials the repository does not have.

### 2. Coverage is enforced from tools/list

A check lists the registered tools and fails for any without a live case. Cases are organised per tool, so a new tool cannot ship untested against a deployment.

### 3. Clean-up is guaranteed and restorative

Clean-up runs in `afterAll` and also on a fatal error. Every created entity carries a per-run prefix:

- forms and roles are deleted through the Form.io API, since no MCP tool deletes them;
- tags are deleted by their main document, which removes the chunk documents too;
- the project's `tag` is restored with `PUT {projectUrl} {tag}`.

These steps are the ones proven by hand on form.test.

### 4. Examples are checked at two depths

- **Imports.** Every named import from `@formio/js`, `@formio/js/utils`, `@formio/core`, and `@formio/react` must be a real export, checked against the installed module's exports. This is cheap, and covers every example including fragments.
- **Type-check.** Self-contained `formio-sdk` examples are extracted to temporary `.ts` files and checked with `tsc --noEmit` against the installed `@formio/js` types. "Self-contained" means a block that imports what it uses and has no `…` placeholders. A deliberate fragment carries a `<!-- example: fragment -->` marker so the extractor skips it.

The type-check reports only wrong-name errors: an undeclared name, a missing export, an unresolved module, or a missing member of an imported object. `@formio/js`'s declarations mark optional parameters required and type some arguments too narrowly, so arity and type-mismatch errors would flag correct examples. Its `Formio` declaration also re-exports a type it never imports, which leaves `Formio` typed `any`. A runtime check therefore confirms every `Formio.x` and `Utils.x` an example reads exists on the real objects. That is what catches a made-up static like `Formio.login`. `@formio/react` becomes a dev dependency of `skill-tests` so `formio-react-form` imports and prop types can be checked.

### 5. Tool references read the real schemas

The tool-reference test runs in `packages/mcp-server`, which already lists tools in-process (`connectTools(registerAllTools)`) and can read `plugin/`.

- It collects backticked identifiers matching the tool-name shape (`(form|role|action|project|server)_[a-z_]+`).
- It fails on an unregistered one. Variable names that happen to fit the shape, such as `project_url`, go on an explicit list.
- For `tool({ arg: … })` and "`tool` with `arg`" patterns, it checks each argument against the input schema.
- For enum values written beside an argument, it checks them against the schema's enum.

It does not require prose to list required arguments; the schema already tells the agent.

### 6. The writing-tools list is derived

The preflight test computes the set from the registered tools' annotations, `readOnlyHint === false && openWorldHint === true`, and compares it with every preflight copy. Adding a writing tool then fails the test until every copy names it, which is the behaviour `project_tag_create` needed by hand in #101.

### 7. `$schema` is stripped at registration

A small wrapper around tool registration removes the top-level `$schema` from each emitted input and output schema. The SDK adds it, and a caller does not act on it. This frees about 2,550 characters. The "fields sent overwrite …" sentence shared by the three update tools is also shortened.

### 8. Versions become reads

Where a `formio-react` or `formio-angular` step depends on a version, the step names the `npm view` read and acts on its result. Prose that only illustrates a version says "the resolved version". The tests that pin the old numbers (`form-sub-skill.test.ts`, `angular-21.test.ts`) assert the read instead.

### 9. Small corrections

- **Planner grader:** follows `phase-b-emission.md`. No Save is required on a login form or an action-less form, and a login form's Save must not set `settings.resource`.
- **`formio-mcp-setup`'s too-old section:** keeps both upgrade paths and loses its dead same-version sub-branch, the 0.9.0 notes, and the `>=0.9.0` range.
- **`project-url-variables` test:** its assertion moves to `project_set-registration.test.ts`, which checks the registered description, not source text.
- **Screenshots:** retaken against the current server.
- **Retired names:** removed from `CLAUDE.md`, and from the specs by delta or, for Purpose lines, by direct edit.

## Risks / Trade-offs

- **[A live run modifies a real project]** → The allowlist, a per-run prefix, guaranteed clean-up, opt-in only, and documented target setup.
- **[The extractor misreads an example's boundaries]** → Fragments carry an explicit marker, and the extractor's own unit tests cover its rules.
- **[The tool-reference regex flags prose that only resembles a tool name]** → An explicit allowlist with a comment per entry.
- **[`$schema` removal confuses a strict client]** → The MCP specification does not require it, and the SDK client's own output validation runs on the server's zod schemas. Covered by the existing output-schema tests and the live run.

## Migration Plan

Tests and documentation, plus one server registration wrapper. `@formio/mcp` and `@formio/ai` patch changesets fold into the pending 1.0 major. The live runner is documented in `CONTRIBUTING.md`, with target setup, the allowlist variable, and TLS.

## Open Questions

None.
