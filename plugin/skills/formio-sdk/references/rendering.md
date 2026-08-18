## Overview

Render a Form.io form inside a VanillaJS (or any non-Angular) consumer with `Formio.createForm(element, formSrc, options)`. Covers prefill, event subscription (`change`, `submit`, `error`, `nextPage`, `prevPage`, `render`, `attach`), wizards, PDF-backed forms, read-only mode, and offline / local-JSON form sources. Behavior coverage cross-referenced against `https://formio.github.io/formio.js/app/examples` — every example here uses ESM imports, never `<script>` tags. Sourced from `packages/formio.js/src/Formio.js` (renderer extensions), `packages/formio.js/src/Embed.js`, `packages/formio.js/src/Form.js`, and `packages/formio.js/src/Webform.js` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

> The CSS that styles the rendered form ships with `@formio/js`. In a bundler-driven app, import the stylesheet once at bootstrap (e.g. `import '@formio/js/dist/formio.form.min.css';`). Do not use `<script>` tags to load the renderer — this skill is ESM-only.

## URL Configuration

### Hosted

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

### SaaS

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

The `formSrc` argument to `Formio.createForm` is one of:

- A full form URL: `${projectUrl}/<formAlias>` or `${projectUrl}/form/<formId>` — the renderer loads the form definition over HTTP using the configured `baseUrl` / `projectUrl`.
- A form JSON object: `{ display: 'form', components: [...] }` — the renderer skips the network round-trip (use for offline / local JSON).

## API

Static methods on `Formio` (renderer extensions in `packages/formio.js/src/Formio.js`):

- `Formio.createForm(element: HTMLElement, form: string | object, options?: FormOptions): Promise<Form>` — render a form and resolve when it's attached to the DOM.
- `Formio.use(module)` — register a renderer module (custom component, template, addon).
- `Formio.icons` / `Formio.Templates.framework` — global icon-pack / template selection.
- `Formio.formioReady` — `Promise<void>` that resolves when the renderer's runtime is initialized.

Common `options` (`packages/formio.js/src/Webform.js`):

- `readOnly: boolean` — disable input; useful for review screens.
- `noAlerts: boolean` — suppress validation toasts.
- `language: string` — switch language at render time (see `i18n`).
- `template: string` — switch template framework (`bootstrap`, `bootstrap3`, etc.).
- `evalContext: object` — extra variables exposed to custom JavaScript / formula components.
- `submission: { data: {} }` — pre-fill values (can also be set after render via `form.submission = {...}`).
- `viewAsHtml: boolean` — render the submission as static HTML (read-only review).

The resolved `form` instance is an `EventEmitter`. Common events:

- `submit` — fired after a successful submit; payload is the `submission` object.
- `submitDone` — fired after the submission lifecycle completes (after `submit` actions).
- `submitError` — fired when validation or persistence fails.
- `change` — fired on every component value change; payload includes `{ changed, isValid }`.
- `error` — fired on validation errors; payload is the array of errors.
- `nextPage` / `prevPage` — fired when a wizard advances or retreats; payload includes `{ page, submission }`.
- `render` — fired after every re-render.
- `attach` — fired once after initial attach.
- `componentChange` — fired with `{ component, value, flags }` per component edit.

Programmatic access on the resolved instance:

- `form.submission = { data: {...} }` — prefill values; the renderer diffs and updates components.
- `form.setSubmission(submission, flags?)` — explicit setter that returns a Promise.
- `form.submit()` — programmatically submit.
- `form.validate(): Promise<boolean>` — run validation without submitting.
- `form.setForm(newDefinition)` — swap the form definition at runtime.
- `form.destroy()` — tear down the form and detach from the DOM.
- `form.checkValidity(): boolean` — synchronous validity check.

## Examples

### Render a hosted form by URL

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

const form = await Formio.createForm(
  document.getElementById('formio')!,
  `${Formio.getProjectUrl()}/intake`
);

form.on('submit', (submission) => {
  console.log('submitted:', submission._id);
});
```

### Render a SaaS form by URL

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

const form = await Formio.createForm(
  document.getElementById('formio')!,
  `${Formio.getProjectUrl()}/intake`
);
```

### Prefill submission values

```ts
import { Formio } from '@formio/js';

const form = await Formio.createForm(
  document.getElementById('formio')!,
  `${Formio.getProjectUrl()}/intake`
);

form.submission = {
  data: {
    firstName: 'Alice',
    email: 'alice@example.com',
  },
};
```

### Subscribe to every change

```ts
import { Formio } from '@formio/js';

const form = await Formio.createForm(
  document.getElementById('formio')!,
  `${Formio.getProjectUrl()}/intake`
);

form.on('change', ({ changed, isValid }) => {
  if (changed) {
    console.log('field changed:', changed.component.key, '→', changed.value, 'valid:', isValid);
  }
});

form.on('error', (errors) => {
  console.warn('validation errors:', errors);
});
```

### Wizard pagination

```ts
import { Formio } from '@formio/js';

const wizard = await Formio.createForm(
  document.getElementById('formio')!,
  `${Formio.getProjectUrl()}/onboarding`
);

wizard.on('nextPage', ({ page, submission }) => {
  console.log('moved to page', page, 'so far:', submission.data);
});
wizard.on('prevPage', ({ page }) => {
  console.log('back to page', page);
});
```

### Read-only review screen

```ts
import { Formio } from '@formio/js';

await Formio.createForm(
  document.getElementById('review')!,
  `${Formio.getProjectUrl()}/intake/submission/000000000000000000000010`,
  { readOnly: true, viewAsHtml: true }
);
```

### Render a PDF-backed form

```ts
import { Formio } from '@formio/js';

await Formio.createForm(document.getElementById('formio')!, `${Formio.getProjectUrl()}/w2-pdf`);
// PDF-backed forms detect display === 'pdf' on the loaded definition and
// switch the renderer to the PDF view automatically.
```

### Render from a local JSON form definition (offline / no HTTP)

```ts
import { Formio } from '@formio/js';

const formDefinition = {
  display: 'form',
  components: [
    { type: 'textfield', key: 'firstName', label: 'First Name', input: true },
    { type: 'email', key: 'email', label: 'Email', input: true },
    { type: 'button', key: 'submit', label: 'Submit', action: 'submit', input: true },
  ],
};

const form = await Formio.createForm(document.getElementById('formio')!, formDefinition);

form.on('submit', (submission) => {
  console.log('local submission (not persisted):', submission.data);
});
```

### Programmatic submit + validation

```ts
import { Formio } from '@formio/js';

const form = await Formio.createForm(
  document.getElementById('formio')!,
  `${Formio.getProjectUrl()}/intake`
);

document.getElementById('submitBtn')!.addEventListener('click', async () => {
  const valid = await form.validate();
  if (!valid) {
    console.warn('not valid yet');
    return;
  }
  await form.submit();
});
```

### Destroy a form when navigating away

```ts
import { Formio } from '@formio/js';

const form = await Formio.createForm(
  document.getElementById('formio')!,
  `${Formio.getProjectUrl()}/intake`
);

window.addEventListener('beforeunload', () => {
  form.destroy();
});
```

## MCP Tool Preference

Rendering is a runtime concern with no MCP-tool equivalent — use the SDK directly.
