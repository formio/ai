## ADDED Requirements

### Requirement: The planner grader follows the planner's action rules

The planner harness's `grade.py` SHALL require a Save action on every form that persists submissions, and SHALL NOT require one on a login form (one carrying a Login action and no Role Assignment action) or on a form the planner leaves without actions. It SHALL check that no login form's Save action sets `settings.resource`.

#### Scenario: A login form without Save passes

- **WHEN** a template's `userLogin` carries only `userLogin:login`
- **THEN** the Save assertion passes for it
