## ADDED Requirements

### Requirement: The planner does not invoke formio-auth

`formio-resource-planner` SHALL NOT invoke `formio-auth`: auth configuration needs the imported project, which the planner never creates. When the approved map names an auth concern beyond resource-backed login with Role and Group Assignment, the planner's Next-steps menu SHALL list configuring auth with `formio-auth` after the template is imported.

#### Scenario: Standalone planning lists auth as a next step

- **WHEN** a standalone planner run's approved map names Custom JWT
- **THEN** the Next-steps menu lists configuring auth with `formio-auth` after import
- **AND** the planner does not hand off to `formio-auth` itself

