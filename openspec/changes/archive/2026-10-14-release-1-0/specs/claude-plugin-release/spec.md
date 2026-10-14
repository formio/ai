## ADDED Requirements

### Requirement: A major release is verified before it is published

Before the Version Packages PR for a major version merges, the release candidate SHALL pass, and the change that releases it SHALL record: the live tool suite against a real deployment, every case passing and the project left as found; the routing eval, with no prompt that passed on the previous release failing; and the planner eval, at or above its last recorded pass rate. The PR's versions and server pins SHALL all name the new version.

#### Scenario: Verification is recorded

- **WHEN** the change releasing 1.0.0 is read
- **THEN** it records the live suite, routing eval, and planner eval results on the release candidate

#### Scenario: Pins agree

- **WHEN** the Version Packages PR is inspected
- **THEN** every package version and every `@formio/mcp@` pin names 1.0.0
