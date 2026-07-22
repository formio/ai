# Page Setup — HTML Requirements and Library Inclusion

## Overview

What a page needs before `Formio.createForm` can render anything: the renderer script, its CSS, a bootstrap-compatible stylesheet, and a target element.

## CDN inclusion (plain HTML pages)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css" />
<link rel="stylesheet" href="https://cdn.form.io/js/formio.full.min.css" />
<script src="https://cdn.form.io/js/formio.full.min.js"></script>

<div id="formio"></div>

<script>
  Formio.createForm(document.getElementById('formio'), 'https://examples.form.io/example');
</script>
```

The CDN build exposes the global `Formio`.

## ESM inclusion (bundled applications)

```js
import { Formio } from '@formio/js';
import '@formio/js/dist/formio.full.min.css';

const form = await Formio.createForm(
  document.getElementById('formio'),
  'https://examples.form.io/example'
);
```

These are the only two supported inclusion modes. Never import from `@formio/core`, never deep-import from `@formio/js/lib/`, and never use CommonJS `require`.

## Target element

`Formio.createForm` renders into any block element you hand it — conventionally an empty `<div>`. The renderer owns that element's contents; do not manage its children from your own code.

## Hosted vs SaaS URL configuration

- SaaS: `FORMIO_BASE_URL` is `https://api.form.io`; `FORMIO_PROJECT_URL` is `https://<project>.form.io`.
- Self-hosted: `FORMIO_BASE_URL` is your server root (e.g. `https://forms.mysite.com`); `FORMIO_PROJECT_URL` appends the project path (e.g. `https://forms.mysite.com/myproject`).

```js
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com'); // FORMIO_BASE_URL
Formio.setProjectUrl('https://forms.mysite.com/myproject'); // FORMIO_PROJECT_URL
```

Form URLs passed to `Formio.createForm` are `{FORMIO_PROJECT_URL}/{formPath}`.

## See also

- [rendering.md](./rendering.md) — the three input shapes `createForm` accepts.
- [options.md](./options.md) — the options object.
