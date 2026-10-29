# A claim wizard that fills itself in

Agentic Formflow end to end. Exercises the `formio-uag` skill: designing a task with an input, decision fields that choose the wizard's pages and value fields that prefill them, registering `@formio/uag-js` with the `next` trigger, and re-deciding the routing fields on the server with an "Agent: Run task" action before the save.

See it running at https://ai.form.io/examples/formflow (source: https://github.com/formio/uag/tree/main/demo).

## Prompt

```
/formio-uag Our "claim" wizard in Form.io starts with a "What happened?" box. When the policyholder describes the incident and presses Next, I want the claim type and whether anyone was injured decided from their description, so the right pages appear, and the date, location and other driver's name prefilled for them to check. The claim type must not be something the policyholder can change before submitting. Our app renders the wizard with @formio/js and our UAG runs at https://uag.example.com.
```

## What to look for

- The form changes (the `uag` tag, a `triage` task: the criteria, `uagField: "input"` on the description, the decision and value fields, `clearOnHide: false` on the decision fields, `uagAuthoritative` on the claim type) go through `formio-form-builder`'s edit lane, with the change shown before it is written.
- The application registers `Formio.use(UAG(...))` once, with the UAG URL taken from the app's configuration rather than hardcoded, and the wizard uses the `next` trigger.
- A Run task action with `answer: "decisions"` and `when: "before"` re-decides the triage fields on the server — added in a template, a connected portal stage, a module or by the user with Form.io's action API, never with `action_create`.
- The skill says up front that Agentic Formflow needs a license that includes the UAG, or a project on Form.io's hosted service.
