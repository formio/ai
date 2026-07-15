# Form Types — webform, wizard, PDF form

Reference for Step 1 (INTENT): what each Form.io form type is, what it can do,
when to choose it, and the phrasing signals that distinguish them. A form's
type is set at creation but can be changed later via the form's display
setting, so a wrong guess is recoverable — still, get it right up front.

## Webform (single-page form)

The standard form type: every field is presented on one page, completed and
submitted in a single view.

**Capabilities.** The full component library, conditional fields, calculated
values, validation — everything the renderer supports, on one page.

**When to choose.** Shorter forms the user can finish in one sitting — contact
forms, feedback forms, quick surveys, sign-up forms. When in doubt between
webform and wizard, a webform is the simpler default for anything under
roughly a dozen fields.

## Wizard (multi-page form)

A multi-step form that breaks many fields into bite-size pages. Each page is a
Panel layout component at the form's root; users navigate with header tabs and
Cancel / Previous / Next buttons.

**Capabilities.** Everything a webform does, plus per-page navigation,
conditional pages (a page whose visibility depends on earlier answers), and
per-page validation before advancing.

**When to choose.** Long or complex forms where one page would overwhelm —
multi-section intake forms, registrations with distinct stages, applications
with branching sections. If the user describes stages, steps, or sections,
they want a wizard.

**Nested wizard workflows (child wizards).** A wizard can embed another wizard
— a **child wizard** — for hierarchical flows: build the child wizard as its
own standard wizard form, then in the parent wizard add a Panel to the target
page, place a Nested Form component inside it, and link it to the child wizard.
Like any Nested Form, the component should set `reference: false` so the child
wizard acts as a nested interface saved inline with the parent — not a separate
child submission; the canonical guidance lives in `formio-schema`'s
`references/form/data-components.md` (Form component section), which the SCHEMA
step loads.
The Panel keeps the child wizard's pages rendered as sub-navigation beneath the 
parent's navigation instead of colliding with it. Use nested wizards when a complex 
workflow has sub-sections that deserve their own step-by-step navigation; use Tab 
components instead when step-by-step navigation is not needed. Creating the child 
wizard is its own SCHEMA → SAVE pass through this skill's pipeline (each wizard is 
a separate form in the project); the parent links to the saved child.

## PDF form

A form rendered over an existing PDF document: the PDF is uploaded and hosted
by the Form.io PDF server, and interactive components are overlaid onto it in
the builder.

**Capabilities.** Overlay components (text fields, email, textarea, number,
phone, password, date, checkbox, radio, currency, select, file, signature)
positioned on the PDF; submissions viewable with data overlaid on the original
document; printable pixel-perfect PDF export of completed submissions. A
hybrid mode can collect data as a normal webform while still printing through
the PDF template.

**Prerequisite — the PDF document.** A PDF form renders over an uploaded,
hosted PDF document: the user must upload their PDF (standard page sizes —
A4, Letter — non-standard sizes fail) through the Form.io portal, which
processes and hosts it. This skill does not convert documents or provide a
PDF server — creating a PDF form's definition saves the form; the PDF
document itself must exist in (or be uploaded to) the user's project.

**When to choose.** Digitizing an existing paper or official document,
pixel-perfect output matching a mandated layout (government / compliance
forms), or document-centric workflows where the submission must look like the
original PDF.

## Phrasing signals — how INTENT distinguishes the types

| The user says … | Signal for | Confidence |
| --- | --- | --- |
| "multi-page form", "multi-step", "wizard", "steps", "stages", "sections", "one page per topic" | wizard | Unambiguous — infer and confirm |
| "pdf form", "fill out this PDF", "overlay fields on my PDF", "looks like the paper form" | pdf | Unambiguous — infer and confirm |
| "form", "survey", "contact form", "questionnaire" with no size or layout cues | webform | Default — confirm, offer wizard if the field list turns out long |
| A long field list (roughly a dozen or more fields, or distinct topical groups) with no type named | wizard candidate | Ambiguous — ask |
| Mentions an existing document to reproduce, but not the word PDF | pdf candidate | Ambiguous — ask |
