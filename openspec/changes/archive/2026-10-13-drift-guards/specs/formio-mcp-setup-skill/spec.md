## ADDED Requirements

### Requirement: The preflight's writing tools follow the tool annotations

The writing-tools sentence in every copy of the shared preflight SHALL name exactly the registered tools annotated as writing to the deployment (not read-only and reaching beyond the local machine), and a test SHALL derive that set from the server's annotations rather than from a hand-kept list.

#### Scenario: A new writing tool joins the list

- **WHEN** a tool is registered with a writing annotation and no preflight copy names it
- **THEN** the test fails naming the tool

### Requirement: The too-old section carries only live branches

`formio-mcp-setup`'s section for a connected server that predates `project_get` SHALL keep the upgrade paths — a marketplace plugin update, or moving a pinned version in a configuration file forward — and SHALL NOT carry a branch for a pin that equals the blocks' version awaiting publication, a note about which version first shipped the `project` command, or a version range, since every documented invocation carries an exact pin. `llms-install.md` SHALL agree.

#### Scenario: No range and no 0.9.0 note

- **WHEN** `formio-mcp-setup/SKILL.md` and `llms-install.md` are searched for `>=0.9.0` and `0.9.0`
- **THEN** no match is found
