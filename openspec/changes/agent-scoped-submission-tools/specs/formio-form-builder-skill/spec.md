## ADDED Requirements

### Requirement: Form building can seed a select's Resource and write a test submission

`formio-form-builder` SHALL document two optional steps after SAVE, each following `agent-submissions.md`: seeding the Resource a `select` with `dataSrc: resource` reads when it has no rows, with `purpose: "reference-data"`; and writing a `purpose: "test"` submission to check the saved form's validation, conditionals, and calculated values, followed by an offer to delete it.

#### Scenario: An empty dropdown source

- **WHEN** the saved form has a `select` reading a Resource with no rows
- **THEN** the skill offers seed rows for approval and writes them only on approval

#### Scenario: Checking a calculated value

- **WHEN** the user asks to confirm a calculated total
- **THEN** the skill writes one test submission, reports the stored total from `submission_get`, and offers to delete the row
