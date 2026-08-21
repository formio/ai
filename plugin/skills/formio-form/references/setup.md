# Page Setup — HTML Requirements and Library Inclusion

## Overview

What a page needs before `Formio.createForm` can render anything: the renderer script, its CSS, a bootstrap-compatible stylesheet, and a target element.

## ESM inclusion (bundled applications) — preferred

```js
import { Formio } from '@formio/js';
import '@formio/js/dist/formio.form.min.css';

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
  href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css"
  integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB"
  crossorigin="anonymous"
/>
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@formio/js@5.5.1/dist/formio.form.min.css"
  integrity="sha384-/zfd6nkJxXzqXliV/Jlki/NOl+E/K7FujopWT3gKLYXMlIwiratcqMESMZG9ICY2"
  crossorigin="anonymous"
/>
<script
  src="https://cdn.jsdelivr.net/npm/@formio/js@5.5.1/dist/formio.form.min.js"
  integrity="sha384-WI14pf615veSnkFtQYllUINR9h5mP1ukKxI47QtGb9DVDYvZlUeaOnWpK/G23Z5x"
  crossorigin="anonymous"
></script>

<div id="formio"></div>

<script>
  Formio.createForm(document.getElementById('formio'), 'https://myproject.form.io/myform');
</script>
```

The CDN build exposes the global `Formio`. `formio.form.min.js` and `formio.form.min.css` are the renderer pair — everything `Formio.createForm` needs and nothing else. Recompute the hashes whenever you bump the version: `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`. Load it from the version-pinned npm CDN path above and nowhere else: an unversioned URL — including a jsDelivr path with the `@5.5.1` omitted, or a vendor-hosted bundle served from a fixed path — cannot be integrity-pinned, so whoever controls that host controls what executes on your page.

These are the only two supported inclusion modes. Never import from `@formio/core`, never deep-import from `@formio/js/lib/`, and never use CommonJS `require`.

## Target element

`Formio.createForm` renders into any block element you hand it — conventionally an empty `<div>`. The renderer owns that element's contents; do not manage its children from your own code.

## URL configuration

**Where these two values come from.** The hosts below are illustrations. When you write these calls into a real application, take both URLs from the MCP server rather than typing them — run `npx -y @formio/mcp@0.11.0 project get --cwd "$(pwd)"` and use exactly what it prints: its `Project URL` for `setProjectUrl`, its `Base URL` for `setBaseUrl`. Do not hardcode an example host, do not derive either URL from the other, and do not carry a value over from another project or an earlier session — the mapping the server reports is what every build-time Form.io tool call resolves, so a different value here ships an application pointed at a deployment the tooling is not managing. If the command reports a value missing, relay its instruction, persist the answer with the `project set` command it names, and re-run it.

Every deployment shape is handled by that one command, so there is nothing to work out here: whichever routing the deployment uses, `project get` reports the pair that matches it.

```js
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com'); // the Base URL from `project get`
Formio.setProjectUrl('https://forms.mysite.com/myproject'); // the Project URL from `project get`
```

Form URLs passed to `Formio.createForm` are `{projectUrl}/{formPath}`.

## See also

- [rendering.md](./rendering.md) — the three input shapes `createForm` accepts.
- [options.md](./options.md) — the options object.
