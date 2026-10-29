## ADDED Requirements

### Requirement: formio-uag skill exists with a router and ten references

The library SHALL contain `plugin/skills/formio-uag/SKILL.md` with frontmatter `name: formio-uag`, and a `references/` directory holding exactly `patterns-and-licensing.md`, `tasks.md`, `form-properties.md`, `workflows.md`, `agent-api.md`, `uag-js.md`, `chat-widget.md`, `mcp-clients.md`, `deployment.md` and `troubleshooting.md`, none with frontmatter, each linked from `SKILL.md`. The description SHALL follow the three-clause template, and its `Not for:` clause SHALL name `formio-form-builder`, `formio-form`, `formio-application`, `formio-actions`, `formio-auth` and `formio-mcp-setup`.

#### Scenario: Layout

- **WHEN** the skill directory is inspected
- **THEN** `SKILL.md` and the ten references exist, are non-empty, carry no frontmatter, and every reference is linked from `SKILL.md`

### Requirement: formio-uag documents every property the UAG reads

`references/form-properties.md` SHALL document the `uag` tag and every custom property UAG 2.0 reads: `uagAnonymous`, `uagChat`, `uagChatInstructions`, `uag`, `uagField`, `uagContext`, `uagTools`, `uagEngine`, `uagThreshold`, `uagUncertainBand`, `uagOptionDescriptions`, `uagScale`, `uagOrderCheck`, `uagConfidenceField`, `uagAuthoritative` and `uagAgentDecides`.

#### Scenario: A property is documented

- **WHEN** `form-properties.md` is read
- **THEN** it contains each property name in backticks and `"tags": ["uag"]`

### Requirement: formio-uag stays within the library's build-time guardrails

`SKILL.md` SHALL carry the shared preflight, a `## Security` section, and SHALL route form writes through `formio-form-builder`'s edit lane. It SHALL state that `action_create` refuses `agentRunTask` and name the routes that add it. It SHALL define the UAG URL as a value the user supplies, never recorded with `project_set`. No HTML sample in the skill SHALL carry a project or admin key.

#### Scenario: Run task is not sent to action_create

- **WHEN** an agent reaches the step that adds "Agent: Run task"
- **THEN** the skill tells it not to call `action_create` and offers a template, a connected portal stage, a module template, or Form.io's action API run by the user

#### Scenario: A first build carries agents

- **WHEN** the user wants a new application whose forms carry agents and the target project has no content
- **THEN** the skill runs `formio-resource-planner`, adds the UAG's tags, tasks and `agentRunTask` actions to the unimported `template.json` and `template.md` behind its own approval gate, and hands the pair to `formio-application`, whose skill text names neither the UAG nor `agentRunTask`
