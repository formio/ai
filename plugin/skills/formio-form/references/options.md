# Form Renderer Options

## Overview

The third argument to `Formio.createForm` is an options object that changes how the form renders and behaves:

```js
const form = await Formio.createForm(el, srcOrJson, {
  readOnly: true,
  noAlerts: true,
});
```

## Core options

| Option | Effect |
| --- | --- |
| `readOnly` | Renders the whole form non-editable — every component is disabled. The standard "view a submission" mode; pair with a submission URL from [rendering.md](./rendering.md). |
| `noAlerts` | Suppresses the alert box the renderer normally injects above the form on validation failure; errors still attach to the individual components. Use when your app renders its own error UI from the `error` event. |
| `hooks` | Lifecycle interception points. `beforeSubmit(submission, next)` is the common one — mutate or validate the submission, then call `next()` to continue or `next(error)` to abort. |
| `i18n` | Translation dictionary keyed by language code; combine with `language` to pick the active one. |
| `sanitizeConfig` | Passed through to DOMPurify when the renderer sanitizes HTML content (labels, HTML components). Use `addTags`/`addAttr` to allow markup the default policy strips. |

## Combined example

```js
const form = await Formio.createForm(el, 'https://examples.form.io/example', {
  readOnly: false,
  noAlerts: true,
  hooks: {
    beforeSubmit: (submission, next) => {
      submission.data.submittedAt = new Date().toISOString();
      next();
    },
  },
  i18n: {
    es: { 'First Name': 'Nombre' },
  },
  language: 'es',
  sanitizeConfig: {
    addTags: ['iframe'],
    addAttr: ['allow'],
  },
});
```

## Other options worth knowing

- `language` — active translation key into `i18n`.
- `template` / `templates` — override individual render templates.
- `buttonSettings` — wizard button visibility (`showPrevious`, `showNext`, `showCancel`, `showSubmit`); see [wizards.md](./wizards.md).
- `breadcrumbSettings` — wizard breadcrumb behavior; see [wizards.md](./wizards.md).

Options apply per-instance. There is no global options registry — pass them on every `createForm` call that needs them.

## See also

- [rendering.md](./rendering.md) — the `createForm` signature.
- [javascript-api.md](./javascript-api.md) — the `error` event `noAlerts` defers to.
