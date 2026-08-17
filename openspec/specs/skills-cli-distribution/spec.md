# skills-cli-distribution Specification

## Purpose
Defines the skills-CLI install route: the repository installable with one command, skills landing in the universal directory rather than a per-client one, documentation that leads with the command that works everywhere, and an install that offers the Form.io library and nothing else.
## Requirements
### Requirement: The repository is installable with the skills CLI

`npx skills add formio/ai` SHALL discover the Form.io skill library without any additional flag — no `--full-depth`, no explicit skill path. Discovery SHALL come from the plugin marketplace manifest at `.claude-plugin/marketplace.json`, whose entry SHALL declare a repository-relative `source` of `./plugin`; the `skills` CLI reads skill paths declared in a plugin marketplace manifest, and `plugin/skills/` is not one of the locations it searches by default.

Before this change the same command discovered only the repository's internal `openspec-*` and `tdd-*` tooling, which is a defect visible to any developer who tries it.

#### Scenario: Marketplace entry declares the plugin directory

- **WHEN** `.claude-plugin/marketplace.json` is parsed
- **THEN** its `formio-ai` entry has `source` equal to `./plugin`

#### Scenario: Only the Form.io library is offered for install

- **WHEN** the `skills` CLI lists this repository's skills
- **THEN** every skill offered belongs to the Form.io library
- **AND** no `openspec-*` or `tdd-*` skill is offered, because discovery is additive with `.claude/skills/` and the CLI's `-s` flag takes exact names rather than globs — so excluding them cannot be done at install time

#### Scenario: Every shipped skill is discoverable from the declared path

- **WHEN** the `skills` path declared by `plugin/.cursor-plugin/plugin.json` is resolved from the plugin root
- **THEN** every top-level skill in the library is an immediate child containing a `SKILL.md`
- **AND** the nested `formio-angular-resources` sub-skill is reachable at `formio-angular/formio-angular-resources/SKILL.md`

#### Scenario: No skill is exposed through a symlink

- **WHEN** every `SKILL.md` under `plugin/skills/` is examined
- **THEN** no path component leading to it is a symbolic link

### Requirement: Skills install to the universal directory, not per client

Installation via the `skills` CLI SHALL land the library in the consumer project's `.agents/skills/`, which serves Cursor, Codex, and GitHub Copilot from one copy, with Claude Code symlinked to the same files. The library SHALL NOT require a per-client copy, and no skill SHALL depend on being read from a client-specific path.

#### Scenario: No skill references a client-specific skills directory

- **WHEN** every `SKILL.md` and reference document under `plugin/skills/` is searched for the literal strings `.claude/skills/`, `.cursor/skills/`, and `.github/skills/`
- **THEN** no live instruction depends on one — any occurrence is in an eval runbook describing how to reproduce a benchmark

### Requirement: Documentation leads with one command that works everywhere

`README.md` SHALL open its quickstart with `npx skills add formio/ai` followed by describing what you want in plain language — the route that works in every skills-capable agent with nothing hosted beyond the GitHub repository. It SHALL state that the MCP server is connected on first use by the `formio-mcp-setup` skill, and SHALL NOT ask the reader to hand-write an MCP configuration file.

Below the quickstart, `README.md` SHALL carry an install matrix with a row per client that has a marketplace (Claude Code, Cursor, GitHub Copilot CLI, VS Code, Codex), stating that a plugin install wires skills and the MCP server together, including its install-time prompt for the project URL. The matrix SHALL make clear that the two routes are alternatives, not steps: a plugin install needs no `skills add`, and `skills add` needs no plugin.

A row SHALL name its one-step install command only once that install has been verified end to end against the client; until then the row SHALL mark the route as not yet live. An unverified recipe in the README costs a reader more than an honest gap does, and the marketplace submissions are review-gated outside this repository's control.

The `skills` CLI installs skills only — the string `mcp` does not appear anywhere in it. Documentation SHALL NOT imply otherwise.

#### Scenario: Quickstart is two lines and no config file

- **WHEN** the README quickstart is read
- **THEN** it shows `npx skills add formio/ai` and then a plain-language prompt
- **AND** it does not instruct the reader to create `.mcp.json` or any other MCP configuration file by hand

#### Scenario: Matrix covers every client with a marketplace

- **WHEN** the README install matrix is read
- **THEN** it has a row for each of Claude Code, Cursor, GitHub Copilot CLI, VS Code, and Codex
- **AND** each of those rows either names the one-step plugin install or marks the route as not yet live
- **AND** a row for any other skills-capable agent naming the `skills add` route

#### Scenario: The two routes are presented as alternatives

- **WHEN** the README describes both routes
- **THEN** it states that a plugin install already includes the skills and the MCP server
- **AND** that the `skills add` route relies on `formio-mcp-setup` to connect the server on first use

#### Scenario: Skills-only scope of the CLI is explicit

- **WHEN** the README describes `npx skills add formio/ai`
- **THEN** it states that the command installs skills and does not itself configure any MCP server

### Requirement: The install offers the Form.io library and nothing else

The repository SHALL NOT track the OpenSpec-generated skill mirrors — `.claude/skills/openspec-*`, `.claude/skills/tdd-*`, and the `.cursor/skills/` and `.github/skills/` copies — because `skills` CLI discovery is additive across a repository's agent directories and cannot be filtered at install time. `.gitignore` SHALL cover those paths, and `CONTRIBUTING.md` SHALL tell contributors to regenerate them with the OpenSpec CLI, which is already a documented prerequisite.

The `.claude/skills/formio-*` symlinks into `plugin/skills/` SHALL remain tracked: they are how this repository's own Claude Code sessions load the library, and the `skills` CLI ignores them because it does not follow symlinks during discovery.

#### Scenario: No generated mirror is tracked

- **WHEN** the repository's tracked files are listed
- **THEN** no path under `.claude/skills/openspec-*`, `.claude/skills/tdd-*`, `.cursor/skills/`, or `.github/skills/` appears

#### Scenario: Ignore rules cover the generated mirrors

- **WHEN** `.gitignore` is inspected
- **THEN** it covers each of those paths

#### Scenario: The dev symlinks survive

- **WHEN** the repository's tracked files are listed
- **THEN** `.claude/skills/formio-application` and its siblings are still tracked as symlinks into `plugin/skills/`

#### Scenario: Contributors are told how to regenerate

- **WHEN** `CONTRIBUTING.md` is read
- **THEN** it explains that the OpenSpec skill mirrors are generated, not committed, and names the command that recreates them

