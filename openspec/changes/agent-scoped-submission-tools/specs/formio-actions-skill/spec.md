## ADDED Requirements

### Requirement: The build-time boundary names the scoped submission tools

`formio-actions/SKILL.md`'s "Build time vs runtime" section SHALL state that the only submissions the agent can reach are the ones the `submission_*` tools created and signed for the calling working directory, and SHALL keep the ban on obtaining any other submission by HTTP, script, or pasted content. It SHALL NOT state that no submission tool exists.

#### Scenario: The section describes the tools that exist

- **WHEN** the section is read
- **THEN** it names the `submission_*` tools and their created-and-signed scope, links to `agent-submissions.md`, and contains no "no submission-read tool" statement

### Requirement: An action can be exercised with a test submission

`formio-actions` SHALL document verifying a configured action by writing a `purpose: "test"` submission, after naming the action's real-world effect (recipients for email, the target URL for a webhook, accounts or roles for login and role actions) and getting approval, and SHALL link to `agent-submissions.md` for the rules.

#### Scenario: Testing an email action

- **WHEN** a user asks to check that a new email action works
- **THEN** the documented flow names the recipients, gets approval, writes one test submission, and offers to delete it afterwards
