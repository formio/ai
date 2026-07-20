# EMR patient onboarding (extend an existing app)

A modify-existing run — adds a form-based feature to an application that is already built and running. Exercises the orchestrator's extend branch: delta planning (only the new resources), additive import, and routing to the framework's extend sub-skill instead of a fresh scaffold. Run it from inside an existing workspace (e.g., a previously generated app).

## Prompt

```
/formio-application Within this EMR portal application, I would like to add the ability for each Clinic to create their own Patient Onboarding forms within the Form.io Platform portal, and then embed those patient onboarding forms within their own clinic websites. When a potential patient fills out the patient onboarding form, I would like to introduce a new section within this EMR application called "Patient Onboarding" that displays a table view of all the new patient applications (forms). The clinic administrator should be able to click on each patient onboarding submission, call that patient, and through their own phone call convert that into a scheduled patient appointment within the EMR portal.
```

## What to look for

- Intent detection should land on modify-existing (the prompt says "within this EMR portal application"), so Deployment and MCP Config are skipped — URLs come from the workspace's `FormioAppConfig`.
- The planner should run in delta mode: ONLY the new onboarding/appointment resources, not a restatement of the whole EMR data model.
- Import should be additive — existing resources untouched.
- Framework routing should detect the workspace's framework and load the extend sub-skill (Angular: `formio-angular/resources`), scaffolding modules for exactly the delta resources.
