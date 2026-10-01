# PDF template — a webform's download layout

This reference is loaded by the parent `formio-pdf-form` skill when the user wants to control what a webform's submissions look like as a PDF — a receipt, a contract, a one-page summary. It is not a standalone skill. In the portal this is the PDF Template Designer.

## Target

The form's `display` is not `pdf` and it carries no `settings.pdf`. A PDF form has no template — it prints over its own PDF — so route that request to the existing-form lane. A webform or wizard that carries `settings.pdf` already downloads over that PDF, and its components, having no overlays, fail to render there; say so and stop rather than write a template to it.

## Storage

The template is the form's top-level `pdfComponents` array. Write it and leave `components` untouched: the form people fill in does not change, only its download does.

## Composition

Lay the template out with layout components — panels, columns, tables, HTML content — and place references to the webform's input components inside them by `key`. A reference may name any input component except `button`, `hidden`, `recaptcha`, and `datasource`, and except a component inside a `tree`, `editgrid`, `datatable`, `datagrid`, or `container`; reference the data component itself instead, and its rows come with it. Each component's JSON comes from `formio-schema`.

## Pruning

Each reference carries only `key`, `type`, `label`, `labelPosition`, `hideLabel`, `labelWidth`, `labelMargin`, and `components`. At download time the server fills every other property from the live component of the same key, so a pruned template keeps rendering correctly as the form's fields change; a full copy would freeze them as they were on the day it was written.

## Gate and save

Show an outline of the template — its sections in order and the keys each holds — and state plainly that saving changes every PDF download of the form immediately, including downloads of submissions already made. The portal shows the designer only where the deployment enables PDF building; elsewhere the server still applies the template, but the portal will not show it for editing. On approval, `form_get` the form and `form_update` it with the new `pdfComponents`.

## Preview

The user previews by downloading any submission's PDF. For layout work, the same download accepts `format=html`, which returns the page the PDF is printed from.
