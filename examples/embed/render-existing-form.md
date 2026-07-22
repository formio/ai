# Embed an existing form

A pure embed pass — no new form is created. Exercises the `formio-form` skill: rendering an already-saved form inside a page with the `@formio/js` renderer, wiring the submission handler, and respecting the Hosted-vs-self-hosted URL split.

## Prompt

```
/formio-form I have a contact form already built in my Form.io project at https://myproject.form.io/contact. Embed it in my website's contact page, show a thank-you message after a successful submission, and pre-fill the email field when my page already knows the visitor's email address.
```

## What to look for

- The embed should use `Formio.createForm` (or the framework-appropriate wrapper) pointed at the form URL — not a copied JSON schema.
- The thank-you behavior should hang off the renderer's `submitDone` event.
- Pre-fill should land via the submission object (`form.submission = { data: { email } }`), not DOM manipulation of the rendered field.
- No new form should be created — this is `formio-form`, not `formio-form-builder`.
