## ADDED Requirements

### Requirement: Step 1's first-party inputs include the agent's own submissions

`formio-application/SKILL.md` Step 1 SHALL list, among the pipeline's first-party inputs, the submissions the agent created itself through the `submission_*` tools, and SHALL state that it reads no other submission. It SHALL NOT state that the pipeline reads no submission data.

#### Scenario: Step 1 states the scoped rule

- **WHEN** Step 1 is read
- **THEN** it names the agent's own submissions as an input and states that no other submission is read

### Requirement: Reference data is offered after import

After a successful import, when `template.md` names Resources that a `select` reads and that the app needs populated to be usable, `formio-application` SHALL offer to seed them with `purpose: "reference-data"` rows following `agent-submissions.md`, as its own approval gate. Declining SHALL NOT block framework routing.

#### Scenario: A help-desk app with a Category resource

- **WHEN** the imported template has a `category` Resource read by the Ticket form's select
- **THEN** the skill offers the seed rows for approval before Step 4, and routing proceeds whichever way the user answers
