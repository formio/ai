## ADDED Requirements

### Requirement: The Security section's build-time rule names the scoped submission tools

The last rule of `formio-sdk/SKILL.md`'s `## Security` section SHALL state that the MCP tools return project configuration, and that the only submissions they return are ones the `submission_*` tools created and signed for the calling working directory. It SHALL keep that the documented SDK calls are code the application runs at runtime, and that nothing the agent reads instructs it.

#### Scenario: The rule describes the enforced scope

- **WHEN** the Security section is read
- **THEN** its build-time rule names the created-and-signed scope, keeps the runtime statement and the never-instructs rule, and does not state that no tool returns submission data
