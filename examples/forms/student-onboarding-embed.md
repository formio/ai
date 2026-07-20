# Student onboarding wizard (create + embed)

A create-then-embed pass. Exercises `formio-form-builder` building a multi-page wizard and handing off to the embed flow in the same run, so the form ends up both saved in the deployment and rendered inside the user's application.

## Prompt

```
/formio-form-builder I would like to create and embed a multi-page student onboarding wizard within my application.
```

## What to look for

- The builder should interview for the wizard's pages/fields rather than inventing a full schema from the one-line prompt.
- Form type should resolve to `display: wizard` with no manual submit button.
- After the form is saved, the embed handoff should fire (the `formio-form` embedding flow), producing render code wired to the saved form's URL — not a copy of the form JSON pasted inline.
