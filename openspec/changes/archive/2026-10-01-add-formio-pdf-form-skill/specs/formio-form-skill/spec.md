## ADDED Requirements

### Requirement: formio-form links PDF-specific rendering to formio-pdf-form

`formio-form` SHALL remain the owner of mounting a form — including a `display: "pdf"` form — and of definition-level behavior in every display. When the definition being embedded has `display: "pdf"`, `formio-form` SHALL add one line linking `formio-pdf-form`'s render reference for what differs (the PDF iframe, `zoom`, the renderer's own submit button, the message-origin rule, unsupported types rendering as `hidden`) and SHALL NOT restate that content. Its `Not for:` clause SHALL name `formio-pdf-form` for building, re-templating, or designing the download of a PDF form.

#### Scenario: PDF form embed keeps formio-form's mounting

- **WHEN** the user asks to embed a saved PDF form on a plain page
- **THEN** `formio-form` supplies the mounting guidance
- **AND** links `formio-pdf-form`'s render reference for PDF-specific behavior

#### Scenario: Not for clause names the PDF skill

- **WHEN** the `formio-form` frontmatter is inspected
- **THEN** its `Not for:` clause contains `` `formio-pdf-form` ``

### Requirement: formio-form routes a PDF that is not yet a form to formio-pdf-form

When an embed request names a PDF document that is not yet a form in the project ("put this PDF on our site so people can fill it in"), `formio-form` SHALL route to `formio-pdf-form`'s build lane rather than to `formio-form-builder`, and resume embedding with the saved form URL afterward.

#### Scenario: Embed request for an unconverted PDF

- **WHEN** the user asks to embed a fillable version of a local PDF and no matching form exists
- **THEN** `formio-form` routes to `formio-pdf-form`
- **AND** embedding resumes with the saved form URL
