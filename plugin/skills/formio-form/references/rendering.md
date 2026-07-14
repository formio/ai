# Rendering Forms — URL, JSON, and Submissions

## Overview

One API renders everything:

```js
const form = await Formio.createForm(element, srcOrJson, options);
```

`srcOrJson` takes three shapes — a form URL, an inline form JSON definition, or
a submission URL. The returned promise resolves to the form instance
(a Webform/Wizard), which you keep to control the form afterward (see
[javascript-api.md](./javascript-api.md)).

## Rendering by form URL

Point `createForm` at a form living under your project URL
(`{FORMIO_PROJECT_URL}/{formPath}`):

```js
const form = await Formio.createForm(
  document.getElementById('formio'),
  'https://examples.form.io/example'
);
```

When a URL is used the renderer also wires submission for you: pressing the
Submit button POSTs the submission to that URL's `/submission` endpoint and
emits `submitDone` on success.

## Rendering by form JSON

Pass the form definition object directly — no server round-trip. Useful for
definitions fetched via the `form_get` MCP tool, stored locally, or generated
at runtime:

```js
const form = await Formio.createForm(document.getElementById('formio'), {
  display: 'form',
  components: [
    {
      type: 'textfield',
      key: 'firstName',
      label: 'First Name',
      input: true,
    },
    {
      type: 'textfield',
      key: 'lastName',
      label: 'Last Name',
      input: true,
    },
    {
      type: 'button',
      key: 'submit',
      label: 'Submit',
      action: 'submit',
      input: true,
    },
  ],
});
```

With inline JSON there is no server attached: `submit` is emitted locally and
nothing is persisted unless you handle the event yourself (see
[javascript-api.md](./javascript-api.md)).

## Rendering submissions (pre-fill)

Two ways to render a form with existing data.

### Set the submission after creation

```js
const form = await Formio.createForm(
  document.getElementById('formio'),
  'https://examples.form.io/example'
);
form.submission = {
  data: {
    firstName: 'Jane',
    lastName: 'Doe',
  },
};
```

The `submission` setter is asynchronous under the hood; when subsequent code
depends on the values being applied, use the promise-returning equivalent:

```js
await form.setSubmission({
  data: {
    firstName: 'Jane',
    lastName: 'Doe',
  },
});
```

### Render from a submission URL

Point `createForm` at a specific submission and the renderer loads both the
form and that submission's data:

```js
const form = await Formio.createForm(
  document.getElementById('formio'),
  'https://examples.form.io/example/submission/{submissionId}'
);
```

Submitting in this mode PUTs back to the same submission (an edit screen for
free). Combine with `{ readOnly: true }` from [options.md](./options.md) for a
view-only screen.

## See also

- [setup.md](./setup.md) — page prerequisites and URL configuration.
- [javascript-api.md](./javascript-api.md) — events and instance methods.
- [options.md](./options.md) — the `options` argument.
