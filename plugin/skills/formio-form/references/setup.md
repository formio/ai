# Page Setup — HTML Requirements and Library Inclusion

## Overview

What a page needs before `Formio.createForm` can render anything: the renderer script, its CSS, a bootstrap-compatible stylesheet, and a target element.

## ESM inclusion (bundled applications) — preferred

```js
import { Formio } from '@formio/js';
import '@formio/js/dist/formio.full.min.css';

const form = await Formio.createForm(
  document.getElementById('formio'),
  'https://myproject.form.io/myform'
);
```

Prefer this everywhere you have a build step: the renderer is pinned by your lockfile, audited by your dependency scanner, and served from your own origin.

## CDN inclusion (plain HTML pages, no build step)

A `<script>` tag hands a third-party host the ability to run code on your page, so pin the version and require a Subresource Integrity hash — a floating `@latest`-style URL silently changes what executes.

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
  integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
  crossorigin="anonymous"
/>
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@formio/js@5.5.1/dist/formio.full.min.css"
  integrity="sha384-H/hNRomN6/YJW4CqK9ZczzSQ4hAro6JOzB2AkUaw9wIBj5D2YHSw19ecJf/7l0Sp"
  crossorigin="anonymous"
/>
<script
  src="https://cdn.jsdelivr.net/npm/@formio/js@5.5.1/dist/formio.full.min.js"
  integrity="sha384-DhAYWcHV0ZOsuafd5+Fix8hSD2Xpq4LoDhxaM9P+X6vE4CQN1vmqTBAgRh9VOH8m"
  crossorigin="anonymous"
></script>

<div id="formio"></div>

<script>
  Formio.createForm(document.getElementById('formio'), 'https://myproject.form.io/myform');
</script>
```

The CDN build exposes the global `Formio`. Recompute the hashes whenever you bump the version: `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`. `https://cdn.form.io/js/formio.full.min.js` serves the same bundle unversioned; it cannot be integrity-pinned, so use the version-pinned npm CDN path above instead.

These are the only two supported inclusion modes. Never import from `@formio/core`, never deep-import from `@formio/js/lib/`, and never use CommonJS `require`.

## Target element

`Formio.createForm` renders into any block element you hand it — conventionally an empty `<div>`. The renderer owns that element's contents; do not manage its children from your own code.

## Hosted vs SaaS URL configuration

- SaaS: `FORMIO_BASE_URL` is always `https://api.form.io`; `FORMIO_PROJECT_URL` is `https://<project>.form.io`.
- Self-hosted, sub-directory projects: `FORMIO_BASE_URL` is your server root (e.g. `https://forms.mysite.com`); `FORMIO_PROJECT_URL` appends the project path (e.g. `https://forms.mysite.com/myproject`).
- Self-hosted, sub-domain projects: `FORMIO_BASE_URL` is still your server root (e.g. `https://forms.mysite.com`), but `FORMIO_PROJECT_URL` is a sibling subdomain of your own domain (e.g. `https://myproject.mysite.com`) — not a path under the base URL.

Which of the two self-hosted shapes applies is a property of that deployment, so read both values rather than deriving one from the other.

```js
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com'); // FORMIO_BASE_URL
Formio.setProjectUrl('https://forms.mysite.com/myproject'); // FORMIO_PROJECT_URL
```

Form URLs passed to `Formio.createForm` are `{FORMIO_PROJECT_URL}/{formPath}`.

## See also

- [rendering.md](./rendering.md) — the three input shapes `createForm` accepts.
- [options.md](./options.md) — the options object.
