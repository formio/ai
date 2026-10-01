## ADDED Requirements

### Requirement: PDF form shapes are documented as the server emits them

`formio-schema`'s form references SHALL document:

- **`overlay`** (`references/form/base-component.md`) — `{ page, top, left, width, height, style }`, with `page` 1-based and the geometry values numbers as the PDF server's conversion emits them (the `@formio/core` type declares strings; both appear in saved forms), and `style` an often-empty string the portal drops on save. The entry SHALL state that overlay geometry is produced by the PDF server's conversion and is not hand-authored, naming `formio-pdf-form`.
- **`settings.pdf`** (`references/form/form-definition.md`) — `{ id, src }`, `id` the uploaded file's identifier and `src` the proxied file URL; the entry SHALL state that the value comes from the `pdf_upload` tool's derived `pdf` object rather than being composed, and that a `form` or `wizard` carrying it downloads over that PDF.
- **`pdfComponents`** (`references/form/form-definition.md`) — a top-level array on a non-PDF form holding its PDF download template: layout components and references to the form's input components by `key`, each reference carrying only `key`, `type`, `label`, `labelPosition`, `hideLabel`, `labelWidth`, `labelMargin`, and `components`, with every other property supplied at download time from the live component of the same key.

#### Scenario: Shapes present

- **WHEN** `base-component.md` and `form-definition.md` are inspected
- **THEN** `overlay` documents `page`, and `form-definition.md` documents `settings.pdf` and `pdfComponents` with the eight-property reference contract
