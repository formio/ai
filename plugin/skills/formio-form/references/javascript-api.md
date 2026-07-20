# Controlling the Form with JavaScript

## Overview

`Formio.createForm` resolves to the form instance. Everything below hangs off that instance — keep the reference:

```js
const form = await Formio.createForm(el, srcOrJson, options);
```

## Events

Register handlers with `form.on(event, handler)`; remove with `form.off(event)`. The renderer's core events:

| Event | Fires when | Handler receives |
| --- | --- | --- |
| `change` | any component value changes (and once on initial load) | the changed submission (`{ data, ... }`) plus a change detail |
| `submit` | the user submits and validation passes | the submission object |
| `submitDone` | the server acknowledged the submission (URL-backed forms) | the saved submission |
| `error` | submission failed validation or the server rejected it | the error(s) |

```js
form.on('change', (submission) => {
  console.log('data is now', submission.data);
});

form.on('submit', (submission) => {
  console.log('submitted', submission.data);
});

form.on('submitDone', (submission) => {
  console.log('saved with id', submission._id);
});

form.on('error', (errors) => {
  console.log('validation or server errors', errors);
});
```

Forms rendered from inline JSON have no server: `submit` still fires, but persisting the data is your handler's job. `submitDone` only fires for URL-backed forms.

## Reading and writing submission data

```js
// Read the current data.
const data = form.submission.data;

// Replace the submission (pre-fill). The property setter is asynchronous
// under the hood; await setSubmission when later code depends on the values.
form.submission = { data: { firstName: 'Jane' } };
await form.setSubmission({ data: { firstName: 'Jane' } });
```

## Working with components

`form.getComponent(key)` returns the live component instance for a key:

```js
const firstName = form.getComponent('firstName');
firstName.setValue('Jane'); // triggers change + validation
const value = firstName.getValue();
```

Component instances expose `setValue`, `getValue`, `disabled`, `visible`, `component` (the JSON schema), and `redraw()`. For bulk traversal use the Utilities documented in the `formio-sdk` skill (`references/utils-form-traversal.md`).

## Submitting programmatically

```js
form.submit();
```

Runs validation, emits `submit`, and — for URL-backed forms — saves to the server then emits `submitDone`. It returns a promise resolving to the submission, so `await form.submit()` when you need the result inline.

## Other instance controls

```js
form.emit('customEvent', payload); // fire an event through the form
form.redraw(); // re-render after external mutation
form.destroy(); // tear down listeners before removing the element
```

## See also

- [rendering.md](./rendering.md) — obtaining the form instance.
- [options.md](./options.md) — options that change instance behavior.
- [wizards.md](./wizards.md) — wizard-specific navigation methods.
