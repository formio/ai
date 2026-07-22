# Wizards — Conditional Pages and Custom Navigation

## Overview

Set `display: "wizard"` on the form definition and every top-level `panel` component becomes a page:

```json
{
  "display": "wizard",
  "components": [
    { "type": "panel", "key": "basics", "title": "Basics", "components": [ ... ] },
    { "type": "panel", "key": "extras", "title": "Extras", "components": [ ... ] },
    { "type": "panel", "key": "confirmation", "title": "Confirmation", "components": [ ... ] }
  ]
}
```

`Formio.createForm` returns a Wizard instance — everything in [javascript-api.md](./javascript-api.md) applies, plus the page API below.

## Page API

| Member                  | Meaning                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `wizard.page`           | current page index (0-based)                               |
| `wizard.pages`          | the currently visible pages (conditional pages excluded)   |
| `wizard.nextPage()`     | validate the current page, then advance; returns a promise |
| `wizard.prevPage()`     | go back; returns a promise                                 |
| `wizard.setPage(index)` | jump straight to a visible page                            |

```js
const wizard = await Formio.createForm(el, wizardDefinition);
await wizard.nextPage(); // page 0 → 1 (validates page 0 first)
await wizard.prevPage(); // back to 0
```

`nextPage()` rejects when the current page fails validation — the wizard stays put and errors render on the offending components.

## Conditional wizard pages

A page is a `panel`, so it takes the same `conditional` shapes as any component (see [conditionals.md](./conditionals.md)). Skip the Extras page unless the user wants it:

```json
{
  "type": "panel",
  "key": "extras",
  "title": "Extras",
  "components": [
    { "type": "textfield", "key": "extraDetails", "label": "Extra Details", "input": true }
  ],
  "conditional": {
    "json": { "!==": [{ "var": "data.wantsExtras" }, "no"] }
  }
}
```

Hidden pages drop out of `wizard.pages` and the breadcrumb entirely — navigation flows straight from the page before to the page after, and the page's components stop validating. Flip the driving value back and the page rejoins in place.

## Custom navigation

Hide the built-in buttons and drive the wizard from your own UI:

```js
const wizard = await Formio.createForm(el, wizardDefinition, {
  buttonSettings: {
    showPrevious: false,
    showNext: false,
    showCancel: false,
    showSubmit: false,
  },
});

document.getElementById('myNext').addEventListener('click', () => wizard.nextPage());
document.getElementById('myBack').addEventListener('click', () => wizard.prevPage());
document.getElementById('myFinish').addEventListener('click', () => wizard.submit());
```

Track progress from wizard events: `wizard.on('nextPage')`, `wizard.on('prevPage')`, and `wizard.on('wizardPageSelected')` fire as the user moves; pair with `wizard.page`/`wizard.pages.length` to render a progress bar. `breadcrumbSettings: { clickable: false }` locks the breadcrumb when users must move strictly forward.

## See also

- [conditionals.md](./conditionals.md) — the conditional shapes pages accept.
- [options.md](./options.md) — `buttonSettings`, `breadcrumbSettings`.
- [javascript-api.md](./javascript-api.md) — events shared with plain forms.
