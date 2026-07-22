# College application wizard

A multi-page conditional wizard. Exercises the `formio-form-builder` orchestrator's wizard path: page sequencing, conditional pages driven by an earlier answer, and saving the form to the target deployment.

## Prompt

```
/formio-form-builder I would like to create a new multi-page wizard form that is responsible for collecting college applications, which we will embed within our content management system. This wizard should have multiple sections where it first collects the applicant's personal information, followed by scholastic achievements, followed by extra curricular activities. It should follow up with them after they select their desired program, and based on what they select, the following wizard pages should contain the specific onboarding questions for that program.
```

## What to look for

- Form type should resolve to `display: wizard`, and NO manual submit button should be added (the wizard renders its own controls).
- Program selection should drive conditional wizard pages — each program's page carries a condition on the program select's value.
- The form should be saved to the deployment via the MCP server (`form_create`), not just emitted as JSON.
- The "embed within our CMS" line should surface the embed handoff after the form is saved.
