## Why

The Project URL and Base URL are needed at exactly one moment — when an `@formio/mcp` tool calls the deployment API — yet the guidance for choosing them is duplicated across the skills library. `formio-application/DEPLOYMENT.md` is the declared owner of the wording; `formio-mcp-setup` restates the three URL shapes anyway "in short"; `formio-angular/SETUP.md` carries its own copy of the `project get` exit-code table; and each of them independently instructs the agent to interview, validate, derive, and call `project_set`. Every copy is a place the rules can drift, and none of them help the case that matters most: an agent using the MCP server with no skills installed at all.

The server is the only component that is always present, and it already knows more than any skill can — which directory is mapped, which half of the pair is missing, and whether a base URL can be derived. So it should own both the reading and the telling: one command to read the configuration, and errors verbose enough that any agent — skill-driven or not — can act on them without consulting a document.

## What Changes

- **The server's configuration errors become self-sufficient and staged.** Each one names the exact remedy command, so an agent can relay it, collect one value, and retry:
  - No project URL resolves → an error stating the project URL is not set and naming `npx @formio/mcp project set --project-url <project_url> --cwd <cwd>`, together with the shape guidance a user needs in order to answer (hosted cloud vs. the two customer-hosted routings) — because no skill carries that wording any more.
  - A project URL resolves but the base URL cannot be determined → an error stating that the base URL cannot be determined **for that project URL**, naming `npx @formio/mcp project set --base-url <base_url> --cwd <cwd>`, and saying why it cannot be derived (the deployment is a sibling host of the same parent domain).
  - The two are reported one at a time, in that order, so fixing the first surfaces the second rather than presenting a user with a compound failure.
- **`project set --project-url` becomes optional when the working directory already has one mapped.** It is required today, which makes the base-URL remedy above impossible to type: `project set --base-url <url>` would fail for a missing project URL the directory already has. With a mapping present, either flag alone is a valid update; with no mapping, `--project-url` is still required.
- **`project get` is the single read surface for skills.** Any skill that needs the configured URLs — to write `FormioAppConfig`, to show the user the target, to decide whether to interview — obtains them by running `npx @formio/mcp@<pinned> project get --cwd <cwd>` rather than by carrying its own resolution logic or asking the user directly.
- **Every skill that calls MCP tools leads with that check.** The preflight gains a second probe alongside the existing tool-availability one: run `project get`, and on a non-zero exit relay the error's own instruction, collect the value, run the `project set` command the error names, and retry. Proactive, so the common path never needs a failed tool call to discover a missing configuration — while the server's errors remain the backstop for every agent that skips the check, including agents with no skills at all.
- **Skills stop carrying URL wording.** Deleted from the skills library and left to the server: the three-valid-shapes enumeration, the plain-language URL descriptions and example values, the validation rules (scheme, trailing slash, shape agreement, project-equals-base sanity check), the Base-URL derivation table, and the per-skill exit-code tables. Each is replaced by "run `project get` and obey what it says".
- **`DEPLOYMENT.md` is deleted.** Once the wording moves to the server, what remains of a 160-line document is four lines — probe, relay, persist, stash — and those belong in the preflight every skill now carries. Keeping a thin file named for the topic is what let 160 lines accumulate there in the first place, so the file goes rather than shrinks. Its inbound references from `formio-mcp-setup` and `formio-angular/SETUP.md` are deleted with it, which is the coupling this change exists to remove.
- **Configuration resolution moves into the preflight, and `formio-application` drops to four steps: Intent → Plan → Import → Framework.** A preflight runs before every step by definition, so a separate Deployment step ordered ahead of Plan is redundant once the probe lives there — and the ordering concern that would otherwise need stating ("resolve before planning") is satisfied structurally instead of by prose. **BREAKING for the spec, not for users:** the `formio-application-skill` five-step requirement and the `exactly five steps` assertion in `packages/skill-tests/src/skill-descriptions/application-orchestration.test.ts` both change.
- **The preflight keeps the three things worth stating outside the server:** a one-sentence definition of each URL so the agent can talk to the user without first provoking an error, the two commands (`project get`, `project set`), and the prohibition on editing `~/.formio/projects.json` by any other means. The shapes, the example values, the validation rules and the derivation stay server-side only.
- **`formio-mcp-setup` runs `project get` up front** after writing the client configuration, and interviews only if that call errors — replacing the current "offer to capture the project" step, whose wording duplicated `DEPLOYMENT.md`.
- **`formio-application` resolves configuration in its preflight**, after confirming the tools are present; a missing-tools preflight still routes to `formio-mcp-setup` first, because there is no server to ask.
- **`formio-angular` reads the URLs via `project get`** in SETUP and CONFIG instead of interviewing for them or trusting a handoff to have captured them, and drops its own copy of the exit-code table.
- Absorbs the ordering concern previously proposed as a separate `reorder-deployment-before-plan` change, which is dropped: with resolution in the preflight there is no step left to reorder.
- Depends on `guard-unconfigured-project-calls`, which introduces the unresolved-base-URL state these errors describe. Landing this first would leave the base-URL error with nothing to report.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `server-config`: the stand-alone-guidance requirement extends from the declared MCP `instructions` to the **errors** — each names its remedy command and carries the guidance needed to answer it, and the project-URL and base-URL failures are reported one at a time; `project set --project-url` becomes optional when the directory is already mapped; `project get` is specified as the read surface skills consume.
- `formio-mcp-setup-skill`: the preflight contract every skill carries extends from "the tools are available" to "the tools are available AND `project get` resolves", with the error-driven interview replacing per-skill URL wording; the setup skill's own project step becomes a `project get` probe that interviews only on failure.
- `formio-application-skill`: the `IMPORT.md` requirement stops describing the import gate as following an MCP-configuration step that no longer exists; the orchestration drops from five steps to four, with configuration resolution moved into the preflight; the requirement making `DEPLOYMENT.md` the owner of the URL wording is removed along with the file; and the skill's required sibling-document list loses `DEPLOYMENT.md`.
- `formio-angular-skill`: SETUP and CONFIG obtain the URLs from `project get` rather than from an interview or an assumed handoff.

## Impact

- `packages/mcp-server/src/project-resolver.ts` — the two error messages gain their remedy commands and answering guidance.
- `packages/mcp-server/src/cli/project-command.ts` — `--project-url` becomes conditionally optional; `project set` gains base-URL-only update semantics; `project get`'s failure output carries the same staged messages.
- `packages/mcp-server/src/tools/project-set.ts` (and its description) — matching optionality for the MCP tool, so the tool and the CLI stay one behavior.
- `packages/mcp-server/src/__tests__/` — project-command, project-set, and resolver suites.
- `plugin/skills/formio-application/DEPLOYMENT.md` — **deleted**; its shapes, descriptions, validation, derivation table, and exit-code table are removed rather than moved.
- `plugin/skills/formio-application/SKILL.md` — the five-steps section becomes four, the preflight gains configuration resolution, and the Links list loses `DEPLOYMENT.md`.
- `plugin/skills/formio-application/INTENT.md` — both branches' downstream-consequence lists renumber to the four-step flow.
- `packages/skill-tests/src/skill-descriptions/application-orchestration.test.ts` — the `exactly five steps` assertion becomes four.
- `plugin/skills/formio-mcp-setup/SKILL.md` — the project step becomes a `project get` probe; the restated shape guidance is deleted.
- `plugin/skills/formio-angular/SETUP.md`, `CONFIG.md` — URLs come from `project get`; the exit-code table is deleted.
- Ten of the twelve `SKILL.md` files under `plugin/skills/` gain the probe, worded identically — excluding `formio-mcp-setup` (handoff target) and `formio-resource-planner` (calls no MCP tool by design), and including the nested `formio-angular/formio-angular-resources/SKILL.md`.
- NOT touched, and explicitly protected by a companion test: the runtime `Formio.setBaseUrl` / `setProjectUrl` documentation in `formio-sdk`, `formio-form/references/setup.md`, `formio-auth/references/token-swap.md`, and `formio-angular`'s config docs. Those configure the generated app, not this session's mapping, and a broad sweep would delete correct SDK documentation.
- `packages/skill-tests/src/skill-descriptions/mcp-setup-skill.test.ts` — the `preflight contract` block asserts the new probe, and a new sweep asserts no skill re-states the URL shapes, descriptions, or validation rules.
- Frontmatter `description` values are not touched, so `fixtures/descriptions-before-preflight.json` stays valid.
