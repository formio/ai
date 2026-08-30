# formio-mcp-setup-skill Specification

## Purpose
Defines the `formio-mcp-setup` skill and the preflight every other skill carries: how a skill detects that the Form.io tools are missing, how setup connects the server without knowing which client it runs in, how it gates and reports the reload, and how it offers project configuration as a skippable step.
## Requirements
### Requirement: Every skill checks for the MCP server before its first tool call

Every `SKILL.md` in the library SHALL carry a preflight section in its **body** — not its frontmatter description, which is bound by the 1,024-character budget — instructing the agent to verify that the Form.io MCP tools are available before making its first Form.io tool call.

The preflight SHALL: name ONE representative tool to look for (`form_list`), asking whether it is callable under whatever name the client exposes it; and direct the agent to the `formio-mcp-setup` skill when it is not. It names one tool rather than four because the server registers its whole tool surface before it authenticates, so `form_list` is callable exactly when the server is connected. `project_get` is the one exception, being newer than the rest of the surface: the section that calls it SHALL route to `formio-mcp-setup` when it is absent, which is how a stale pinned version reaches the upgrade branch.

The preflight SHALL NOT carry a fallback message for the case where `formio-mcp-setup` is itself missing. `npx skills add formio/ai` installs the library as a unit, so a gated skill that is present never has the setup skill absent beside it.

The raw-HTTP prohibition lives in a `##` section of its own beside the preflight, not inside it: it is not a precondition check but a standing rule for the rest of the session. Every gated `SKILL.md` SHALL carry it, and it is the load-bearing part of the pair. `formio-api` documents the entire REST surface, so an agent with no tools and no prohibition will hand-roll requests against a live deployment — a worse outcome than stopping.

There are twelve `SKILL.md` files under `plugin/skills/`, because the nested `formio-angular/formio-angular-resources/SKILL.md` is one of them and the recursive walk in the conformance suite includes it. Eleven carry the preflight; `formio-mcp-setup/SKILL.md` is the handoff target and is exempt.

Every skill that calls Form.io tools SHALL carry a **second** probe, run after the tools are confirmed present and before the first call that reads from or writes to a deployment: call the `project_get` MCP tool with `cwd` set to the user's working directory.

The skill SHALL NOT shell out to `npx -y @formio/mcp project get` for this. The connected server answers over the open transport with the same resolver every other tool uses, so what it reports is what the next call targets; a subprocess resolves against its own environment rather than the server's, and a binary older than the `project` command ignores the arguments and exits **0 with no output**, reporting success while finding nothing. The CLI subcommands remain for `formio-mcp-setup`, which runs before any tool exists to call.

The skill SHALL branch on the `status` the report carries. On `ok` it SHALL treat the reported URLs as the configuration and SHALL NOT ask the user to confirm or re-supply them. On `not-configured` or `base-url-unresolved` it SHALL:

1. Relay the report's own instruction to the user, asking for the one value it names — the Project URL, or the Base URL for the Project URL it echoes.
2. Record that value the way the report names: the `project_set` tool where this directory's mapping is the record, carried structurally as `remedy`; an edit to the file where a committed `formio.json` holds the project, since the server reads a committed file and never writes one.
3. Call `project_get` again, and repeat if it names the second value.

A call that FAILS OUTRIGHT rather than returning a `status` is a broken record, not an absent one. The skill SHALL relay the error and stop, and SHALL NOT interview: a `project_set` would fail for the same unreported reason and the loop would repeat with the cause never named.

The section that resolves the project — a sibling of the preflight rather than part of it — SHALL carry exactly three things about the URLs themselves, and no more — this is the whole of what the skills library states about them, since no skill document owns the topic any longer:

1. A one-sentence definition of each: the Project URL is the full URL of the Form.io project the app reads and writes; the Base URL is the deployment hosting it. This exists so an agent can name what it is asking for without first provoking an error.
2. The two tools — `project_get` to read, `project_set` to write.
3. The prohibition on editing `~/.formio/projects.json` by any means other than those tools.

That section SHALL NOT restate anything else. It SHALL NOT contain the three-valid-shapes enumeration, plain-language URL descriptions beyond the one-sentence definitions above, example URL values, URL validation rules, a Base-URL derivation table, or a `project get` exit-code table; those live in the server's instructions and error messages, which the agent relays verbatim. It SHALL forbid guessing a base URL and reusing one from another project or an earlier session.

The probe is proactive so the common path does not need a failed tool call to discover a missing configuration. It is not the enforcement, though: the server raises the same messages when something calls a tool without probing, which is what makes an agent with no skills installed behave correctly too.

A skill whose request touches no deployment — an API-reference lookup, a schema question, an SDK question — is NOT required to run the probe before answering. The probe binds deployment-touching calls, so reference use stays free of a configuration round-trip.

`formio-resource-planner` SHALL be exempt from the probe entirely while keeping the tool-availability and raw-HTTP preflight. It calls no MCP tool by design — it writes `template.md` and `template.json` with local filesystem writes and states that stance explicitly — so a probe there checks a precondition it never uses. It is also invoked mid-flow by `formio-application`, whose own preflight has already resolved the configuration, so a probe would be a duplicate prompt in the library's most common path.

The probe requirement binds the **build-time** project mapping only. It SHALL NOT be read as governing the runtime URL configuration of a generated application: `Formio.setBaseUrl` / `Formio.setProjectUrl` calls in `formio-sdk`, `formio-form`, `formio-auth`'s Token Swap reference, and `formio-angular`'s `FormioAppConfig` documentation configure the app the user is building, not this session's mapping, and they legitimately show example URL values. This is the same build-time-versus-runtime boundary the existing conformance suite already guards.

#### Scenario: Every skill carries the preflight

- **WHEN** every `SKILL.md` under `plugin/skills/` is inspected
- **THEN** each body contains a preflight section naming `project_set` and the `formio-mcp-setup` skill

#### Scenario: The HTTP workaround is forbidden, in a section of its own

- **WHEN** any gated `SKILL.md` is inspected
- **THEN** it instructs the agent not to fall back to direct HTTP requests against a Form.io deployment when the MCP tools are missing
- **AND** that instruction sits in its own section rather than inside the preflight

#### Scenario: Every tool-calling skill probes with the project_get tool

- **WHEN** every `SKILL.md` under `plugin/skills/` except `formio-mcp-setup/SKILL.md` and `formio-resource-planner/SKILL.md` is inspected
- **THEN** each preflight instructs calling the `project_get` MCP tool with the user's working directory before the first deployment-touching call
- **AND** none instructs shelling out to the `project get` CLI subcommand to do it
- **AND** each instructs branching on the reported `status` and applying the remedy that report names
- **AND** each forbids guessing a base URL, reusing another project's, or editing `~/.formio/projects.json`

#### Scenario: No skill restates the build-time URL guidance the server owns

- **WHEN** every `SKILL.md` and sibling document under `plugin/skills/` is searched for build-time project-configuration guidance
- **THEN** none enumerates the three valid URL shapes as guidance for configuring this session's project
- **AND** none contains a Base-URL derivation table or a `project get` exit-code table
- **AND** none contains URL validation rules such as scheme checks, trailing-slash stripping, or a project-equals-base sanity check

#### Scenario: Runtime SDK URL documentation survives the sweep

- **WHEN** the same search runs over `formio-sdk`, `formio-form/references/setup.md`, `formio-auth/references/token-swap.md`, and `formio-angular`'s `CONFIG.md` / `AUTH.md` / `formio-angular-resources/references/app-integration.md`
- **THEN** their `Formio.setBaseUrl` and `Formio.setProjectUrl` documentation is unchanged, example URL values included
- **AND** no assertion treats a runtime SDK configuration example as build-time project guidance

#### Scenario: The planner keeps the tools preflight without the probe

- **WHEN** `plugin/skills/formio-resource-planner/SKILL.md` is inspected
- **THEN** it carries the tool-availability check and the raw-HTTP prohibition
- **AND** it does not call `project_get`

#### Scenario: Reference-only work needs no project

- **WHEN** a skill's request is answered entirely from its reference documents, with no deployment call
- **THEN** the preflight does not require running the probe or configuring a project

#### Scenario: Descriptions are untouched

- **WHEN** the frontmatter descriptions are measured after the preflight sections are added
- **THEN** every description is unchanged and still within the 1,024-character budget

#### Scenario: The setup skill exempts itself

- **WHEN** `plugin/skills/formio-mcp-setup/SKILL.md` is inspected
- **THEN** it does not direct the agent to load `formio-mcp-setup`, because it is that skill

### Requirement: A setup skill connects the server, configuring the client it runs in

The library SHALL provide `plugin/skills/formio-mcp-setup/`, a spec-conformant skill whose description triggers on a missing Form.io MCP server, on requests to install or connect the Form.io MCP server, and on handoff from another skill's preflight.

The skill SHALL document the configuration for every supported client, and SHALL write the one a given session needs:

| File | Shape |
| --- | --- |
| `.mcp.json` | JSON, top-level `mcpServers` |
| `.cursor/mcp.json` | JSON, top-level `mcpServers` |
| `.vscode/mcp.json` | JSON, top-level **`servers`** |
| `.codex/config.toml` | TOML, `[mcp_servers.formio-mcp]` |

Every entry SHALL launch the server as `npx -y @formio/mcp@<MAJOR.MINOR.PATCH>`, pinned to the exact `version` in `packages/mcp-server/package.json` and restamped by `pnpm sync:pins`, and SHALL contain no URL, key, or other configuration value: Phase 0's server starts with no configuration and raises an actionable error naming `project_set` when a tool needs a project. The skill SHALL NOT write `FORMIO_PROJECT_URL` into an entry and SHALL NOT describe adding one as a way to pin a project — the environment is the weakest resolution source, so a value there pins nothing.

The skill SHALL select which of those files to write by establishing the running client, in this order: the agent's own identity, then a single question to the user naming the four clients and a "not sure" choice. Where neither answers — the agent cannot tell, the user does not answer or answers "not sure", or the host is not one of the four — the skill SHALL fall back to writing all four files, stating that it is doing so, because a configuration file for a client that is not present is inert. The skill SHALL NOT treat the presence of a `.vscode/`, `.cursor/`, or `.claude/` directory as evidence of the running client. The skill SHALL write more than one file only where the user says they work in more than one client in that workspace.

All four paths are project-scoped. The skill SHALL NOT write to the user's home directory.

#### Scenario: Setup skill exists and conforms

- **WHEN** the Agent Skills conformance suite runs
- **THEN** `formio-mcp-setup` passes it — directory name matching `name`, description within budget, frontmatter keys within the specification set

#### Scenario: The running client selects the file

- **WHEN** the skill's write instructions are inspected
- **THEN** they direct the agent to write the file the client it is running in reads, identified from its own identity and then from one question to the user
- **AND** writing all four is stated as the fallback for an unestablished host, not the default
- **AND** the presence of a client's directory in the workspace is ruled out as a detection signal

#### Scenario: All four client configurations are documented

- **WHEN** `formio-mcp-setup/SKILL.md` is inspected
- **THEN** it specifies each of `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, and `.codex/config.toml`
- **AND** the VS Code entry uses the `servers` key while the Claude Code and Cursor entries use `mcpServers`
- **AND** the Codex entry is TOML declaring `[mcp_servers.formio-mcp]`

#### Scenario: No configuration values are emitted

- **WHEN** the configuration snippets in `formio-mcp-setup/SKILL.md` are inspected
- **THEN** none contains a Form.io project URL, base URL, or API key
- **AND** the skill explains that the agent will ask which project to use and call `project_set`

#### Scenario: Nothing is written outside the workspace

- **WHEN** the skill's write instructions are inspected
- **THEN** every path is workspace-relative, and none targets `~` or an absolute home-directory path

### Requirement: Setup is gated, then tells the user how to reload

The skill SHALL print the full contents of every file it intends to write and obtain explicit user approval before writing, and SHALL write exactly the set it previewed. After writing it SHALL state the reload step for the client it identified, and every client's reload step where it fell back to writing all four, because every client reads MCP configuration at session start rather than at tool-call time: Claude Code restarts or runs `/mcp`, Cursor toggles the server in Customize or restarts, VS Code reloads the window, Codex restarts and may prompt to trust the directory.

The skill SHALL then stop and ask the user to re-issue their original request, rather than continuing as though the tools were available.

The skill SHALL also cover: whether to commit or ignore the written files, and what to do where `npx` cannot reach the public registry (a global install of `@formio/mcp@<MAJOR.MINOR.PATCH>` at the same pinned version, or the `.mcpb` desktop bundle).

#### Scenario: Approval precedes any write

- **WHEN** the skill's instructions are inspected
- **THEN** the file contents are previewed and approval obtained before any file is written

#### Scenario: Reload guidance covers every client

- **WHEN** the post-write instructions are inspected
- **THEN** they name the reload step for Claude Code, Cursor, VS Code, and Codex

#### Scenario: The flow ends by handing control back

- **WHEN** setup completes
- **THEN** the skill asks the user to reload and re-issue the original request
- **AND** it does not claim the original task is done

#### Scenario: Offline and locked-down environments have a path

- **WHEN** the skill's instructions are inspected
- **THEN** they describe an alternative for an environment where `npx` cannot fetch from the public registry

### Requirement: Setup offers to configure the project before the reload

After writing the client configuration and before telling the user to reload, `formio-mcp-setup` SHALL offer to capture the Form.io project configuration, so the server resolves a project on its very first tool call instead of raising a "no project configured" error the user then has to resolve.

The step SHALL ask for the **one value the server's message names** — normally the Project URL alone, because the Base URL is derived from it wherever it can be — rather than opening a two-value round. It SHALL relay the server's own wording rather than reusing another skill's document: there is no `formio-application/DEPLOYMENT.md` to reference, and the guidance the server carries in its messages is the single copy.

It SHALL apply the answer by running the server's own command — `npx -y @formio/mcp@<MAJOR.MINOR.PATCH> project set --project-url <url> --cwd <absolute path>`, adding `--base-url <url>` only in the round where the server asks for one — and SHALL NOT edit `~/.formio/projects.json` directly.

It SHALL NOT write `FORMIO_PROJECT_URL` into any client configuration file's `env` block. The reason is NOT that such a value pins the server — the environment is the weakest source, so a committed `formio.json` or a `project_set` mapping overrides it — but that it is the wrong scope for the value: one global answer for every directory the client opens, when a Form.io project is one-to-one with the application built against it. The skill SHALL NOT claim that an environment value takes precedence over the mapping, or that it defeats a later `project_set`.

The step SHALL confirm the result by running `npx -y @formio/mcp@<MAJOR.MINOR.PATCH> project get --cwd <absolute path>` and reporting the resolved URLs, rather than asserting success.

The `project` invocations the skill documents SHALL carry the same exact pin as the configuration blocks, and SHALL NOT carry a range: `@formio/mcp` is a 0.x line, so a hard-coded floor in shipped prose goes stale at the next release while a ceiling freezes the reader on an old server, and an unpinned invocation runs whatever the registry serves at that moment. `pnpm sync:pins` restamps these invocations along with the blocks, so the prose and the configuration never name different servers. The command shipped in `@formio/mcp` 0.9.0, and an older binary ignores the arguments, starts its stdio server, reads end-of-input and exits **0 with no output** — so `project get` reports success while finding nothing and `project set` reports success while writing nothing. The skill SHALL therefore treat a zero-exit run that prints nothing as "no project is configured", and SHALL NOT report a mapping it did not read in the output or claim a project was persisted when `project set` printed nothing.

#### Scenario: The named value is captured, the mapping written, the first tool call resolves

- **WHEN** the user supplies the Project URL the server's message asked for
- **THEN** the skill runs `project set` with it and the absolute working directory
- **AND** it confirms with `project get` and reports the resolved project and base URL
- **AND** the reload instruction that follows notes that no further project setup is needed

#### Scenario: The env-block prohibition is not justified by a pin

- **WHEN** the skill explains why `FORMIO_PROJECT_URL` does not belong in a client `env` block
- **THEN** it gives the scope of the value as the reason
- **AND** it does not say that an environment value takes precedence over the working-directory mapping
- **AND** it does not say that a later `project_set` would be defeated by one

#### Scenario: Configuration is applied through the server's command

- **WHEN** the skill applies the captured URLs
- **THEN** it invokes the `formio-mcp` bin's `project set` command
- **AND** it does not edit `~/.formio/projects.json` itself
- **AND** it does not add `FORMIO_PROJECT_URL` or `FORMIO_BASE_URL` to any client configuration file

### Requirement: The project-configuration step is skippable and never blocks setup

After writing the client configuration, `formio-mcp-setup` SHALL run `project get` for the user's working directory and SHALL interview only when that command fails. On success it SHALL report the resolved URLs in one line, including which source supplied them, and proceed. On failure it SHALL ask for the one value the message names and persist it the way the message names — the `project set` command where the record is the mapping or the environment, and an edit to the file where a committed `formio.json` holds the project, since the server never writes one and a `project set` carrying a base URL alone is refused there — and re-run the command until it resolves or the user declines.

When the working directory is inside a git repository, the step SHALL offer the choice of record in the same round it asks for a URL: writing a committed `formio.json` in the application's own folder — a JSON object holding `{"projectUrl": "..."}`, authored directly, since the server reads that file and never writes it — records a target that travels with the code and is reviewable, while `project set` records it in the machine-local mapping. It SHALL state the consequence in one line rather than explaining the whole precedence order — a committed file is shared with everyone who clones the repository, and it overrides a personal mapping. Outside a git repository the step SHALL NOT offer the committed file, because it would not be tracked by anything.

The step SHALL NOT restate the URL guidance the server owns — the shapes, the plain-language descriptions, the example values — and SHALL NOT reference another skill's document for that wording. It relays what the command says.

The configuration step SHALL remain optional. `formio-mcp-setup` fires from every Form.io skill's preflight, including requests that need no project at all — an API-reference question, a schema question — and from users who have not created a project yet. The step SHALL therefore state plainly that it can be skipped, and skipping SHALL NOT block the client configuration, the reload instruction, or the handoff back to the calling skill.

When the step is skipped, the skill SHALL say that the first Form.io tool call will raise the same actionable message, and SHALL name `project_set` as what will handle it. It SHALL NOT imply the setup failed.

#### Scenario: Setup probes before interviewing

- **WHEN** `formio-mcp-setup` reaches its project step
- **THEN** it runs `project get` with the user's working directory first
- **AND** it interviews only if that command exits non-zero

#### Scenario: Setup offers the committed file inside a repository

- **WHEN** the working directory is inside a git repository and no project resolves
- **THEN** the step offers writing a committed `formio.json` alongside the machine-local mapping
- **AND** it states in one line that a committed file is shared with everyone who clones the repository

#### Scenario: Setup does not offer the committed file outside a repository

- **WHEN** the working directory is not inside a git repository
- **THEN** the step does not offer writing a `formio.json`

#### Scenario: User has no project yet

- **WHEN** the user cannot supply a Project URL
- **THEN** the step is skipped without an error
- **AND** the client configuration and the reload instruction are still delivered
- **AND** the skill names `project_set` as what will capture the project on the first tool call

#### Scenario: Request needs no project

- **WHEN** setup was reached from a preflight for a request that needs no project, such as an API-reference lookup
- **THEN** the skill presents the configuration step as optional rather than required

#### Scenario: A mapping already exists

- **WHEN** `project get --cwd <path>` already resolves a project for the working directory
- **THEN** the skill reports the resolved project and base URL in one line
- **AND** it does not interview

#### Scenario: A half-configured mapping is completed rather than re-interviewed

- **WHEN** `project get` reports a resolved project URL and an unresolved base URL
- **THEN** the skill asks only for the base URL
- **AND** it persists it with the `project set --base-url` command the message names
- **AND** it does not ask for the project URL again

#### Scenario: The step does not restate the server's URL guidance

- **WHEN** `plugin/skills/formio-mcp-setup/SKILL.md` is inspected
- **THEN** it does not enumerate the three valid URL shapes
- **AND** it does not point at another skill's document as the owner of that wording
- **AND** it contains no link to a `DEPLOYMENT.md`

#### Scenario: The preflight defines the URLs without cataloguing them

- **WHEN** any tool-calling skill's preflight is inspected
- **THEN** it defines the Project URL and the Base URL in one sentence each
- **AND** it names `project get` and `project set`
- **AND** it contains no shape enumeration, example URL values, or validation rules
