# agent-neutral-skill-prose Specification

## Purpose
Defines how live skill instructions stay agent-agnostic: no client-specific mechanism named in prose, tool availability established by a capability probe rather than assumed, structured questions described portably and kept batched, and skill-installer invocations taken from whichever client the agent detects.
## Requirements
### Requirement: Live skill instructions name no client-specific mechanism

Every instruction a skill gives the running agent SHALL be executable by any Agent-Skills client. Live instructions SHALL NOT name a client-specific tool, a client-specific slash command, a client-namespaced identifier, or a client-specific configuration path as the thing to do. Where a client-specific mechanism is the clearest illustration of a portable idea, it MAY appear as a parenthetical example attached to a portable instruction, never as the instruction itself.

"Live instruction" means prose the agent follows while serving a user. It excludes: the per-client configuration table that `formio-mcp-setup` owns (whose entire subject is client-specific paths), the per-client reload list in that same skill, eval runbooks under any `evals/` directory (which document how a benchmark was reproduced), and this repository's own OpenSpec artifacts.

The repository SHALL contain a test suite that enforces this over every `SKILL.md` and reference document under `plugin/skills/`, excluding the paths named above. It SHALL fail naming the offending file, the matched string, and the rule. It SHALL run as part of `pnpm test`.

The enforced denylist SHALL include, at minimum: the `mcp__plugin_` prefix, the `frontend-design:frontend-design` namespaced skill name, `/reload-plugins`, `/mcp`, and the phrases "restart Claude Code" and "Claude Code plugin".

#### Scenario: Suite runs under pnpm test

- **WHEN** `pnpm test` runs
- **THEN** the agent-neutral prose suite executes over every `SKILL.md` and reference document under `plugin/skills/`
- **AND** all assertions pass against the current library

#### Scenario: A reintroduced plugin namespace fails

- **WHEN** any live skill document contains the substring `mcp__plugin_`
- **THEN** the suite fails, naming the file and the matched string

#### Scenario: A reintroduced Claude-only reload instruction fails

- **WHEN** any live skill document instructs the user to "restart Claude Code" or to run `/reload-plugins`
- **THEN** the suite fails, naming the file and the matched string

#### Scenario: The setup skill's client table is exempt

- **WHEN** the suite enumerates documents to check
- **THEN** `plugin/skills/formio-mcp-setup/SKILL.md` is exempt, because its subject is per-client configuration paths and reload steps
- **AND** the exemption is declared in the suite by path, not inferred

#### Scenario: Eval runbooks are exempt

- **WHEN** the suite enumerates documents to check
- **THEN** files under any `evals/` directory are exempt
- **AND** `plugin/skills/formio-resource-planner/evals/README.md` and `plugin/skills/formio-angular/formio-angular-resources/evals/README.md` are among the exempt paths

#### Scenario: A parenthetical example passes

- **WHEN** a document reads "ask both questions in one round using the client's structured question mechanism (in Claude Code, `AskUserQuestion`)"
- **THEN** the suite passes, because the instruction is portable and the client tool is an example

### Requirement: Tool availability is determined by a capability probe

A skill that needs to know whether the Form.io MCP server is reachable SHALL decide by asking whether Form.io tools — `form_list`, `form_create`, `project_import`, `project_set` — are available to it under **any** name. It SHALL NOT decide by matching a tool-name prefix, a plugin namespace, a hook side effect, or the presence of a file that only one client writes.

A skill SHALL NOT branch its behaviour on _how_ the server was installed. The observable states are exactly two: Form.io tools are available, or they are not. When they are not, the skill SHALL route to `formio-mcp-setup` and SHALL NOT write MCP configuration itself.

#### Scenario: Server reachable under a namespaced name

- **WHEN** the client exposes the Form.io tools under a client-namespaced name such as a plugin-prefixed identifier
- **THEN** the probe reports the tools as available
- **AND** the skill proceeds without any plugin-mode branch

#### Scenario: Server unreachable

- **WHEN** no Form.io tool is available under any name
- **THEN** the skill routes to `formio-mcp-setup`
- **AND** the skill does not write `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, or `.codex/config.toml` itself

#### Scenario: No skill infers the installation method

- **WHEN** every live skill document is searched for plugin-mode or install-method detection prose
- **THEN** none branches on how the server was installed

### Requirement: Structured questions are described portably and stay batched

Where a skill collects user input at a decision point, it SHALL instruct the agent to use the client's structured question mechanism, naming a specific tool only as a parenthetical example. The batching rule SHALL survive verbatim in meaning: one question round per step, presenting every question that step needs together, never a sequence of one-at-a-time prompts.

Where a skill specifies the options a question offers, those options SHALL remain specified. Where a skill relies on a free-text escape alongside fixed options, it SHALL say so in portable terms rather than by naming a client's built-in "Other" affordance.

#### Scenario: A step's questions arrive in one round

- **WHEN** a step needs both a Base URL and a Project URL
- **THEN** the skill instructs asking for both in a single round
- **AND** the instruction names no client tool as the mechanism

#### Scenario: Fixed options survive de-Clauding

- **WHEN** a rewritten question instruction is compared with the original
- **THEN** every explicitly specified option is still specified
- **AND** any free-text fallback is described without naming a client's built-in affordance

### Requirement: A portable third-party skill is named, and only its distribution wording is neutralized

`frontend-design` is a portable Agent Skill — spec-conformant frontmatter, client-agnostic body, distributed in a `skills/` directory any Agent Skills client reads. Skills that generate UI SHALL therefore refer to it **by name** rather than by a paraphrase, because the name is what an agent can match on and what a user can install.

Detection SHALL match the skill rather than one client's naming: a live document SHALL accept the bare name `frontend-design` and MAY accept client-namespaced forms such as `frontend-design:frontend-design`, and SHALL NOT instruct the agent to look for one form only.

The install path SHALL be portable. A live document MAY name where the skill ships and SHALL leave the mechanism to whatever route the running client uses to add skills. It SHALL NOT instruct a client-specific plugin-install command, a client-specific plugin browser, or a client-specific reload command.

The guarantee that survives unchanged: a skill SHALL NEVER silently emit plain or unstyled UI. When `frontend-design` is unavailable and the user proceeds anyway, the skill SHALL apply the Bootstrap 5 brief that ships in `plugin/skills/formio-angular/BOOTSTRAP.md` Step 7d inline, SHALL disclose that on each UI approval gate, and SHALL hand the decision downstream so a framework skill makes the same disclosure.

This requirement generalizes: neutralizing a dependency means removing the parts only one client can execute, never the identity of a portable thing.

#### Scenario: The skill is named, not paraphrased

- **WHEN** a UI-generating skill's design dependency is read
- **THEN** it names `frontend-design`
- **AND** it does not substitute a generic paraphrase for the name

#### Scenario: Detection accepts more than one registered form

- **WHEN** the detection instruction is read
- **THEN** it accepts the bare name `frontend-design`
- **AND** it does not tell the agent to match a single form only

#### Scenario: The install offer is portable

- **WHEN** `frontend-design` is unavailable and the user is offered the install
- **THEN** the instruction names where the skill ships
- **AND** it defers the mechanism to the running client's own skill-install route
- **AND** no live document contains `claude plugin install`, `claude-plugins-official`, or `/reload-plugins`

#### Scenario: Declining still produces designed UI

- **WHEN** the user declines the install
- **THEN** the skill applies the Bootstrap 5 brief inline rather than degrading to unstyled output
- **AND** each UI approval gate discloses that `frontend-design` was not consulted
- **AND** the downstream handoff records `frontendDesignStatus: 'declined'`

### Requirement: Skill-installer invocations take the agent from the detected client

Where a skill runs the `skills` CLI to install a third-party skill, the `-a` / agent argument SHALL be derived from the client actually running, and SHALL default to the universal `.agents/skills/` target when the client cannot be determined. No live instruction SHALL hardcode a single client as the install target.

#### Scenario: Angular skills install for the running client

- **WHEN** `plugin/skills/formio-angular/BOOTSTRAP.md` instructs installing the Angular skills with the `skills` CLI
- **THEN** the agent argument comes from the detected client
- **AND** the documented default targets `.agents/skills/`

#### Scenario: No hardcoded agent target remains

- **WHEN** every live skill document is searched for `skills add` invocations
- **THEN** none passes a literal `-a claude-code`

