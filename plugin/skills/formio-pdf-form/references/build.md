# Build — a PDF document becomes a form

This reference is loaded by the parent `formio-pdf-form` skill when the user has a PDF that is not yet a form. It is not a standalone skill. The pipeline runs in order; nothing is written to the project until step 6 is approved.

## 1. Collect

Ask, in one question round, for the local path to the PDF and the form's title. Propose `name` (camelCase) and `path` (lower-case, hyphenated) from the title rather than asking for them; the user can correct them at the gate. If the request arrived from `formio-form-builder`, the title may already be known and its embed answer travels with it.

## 2. Inspect

Read the rendered pages yourself with your own file-reading capability, at most 20 pages per request and looping for longer documents. For each region of each page, note:

- the visible label beside each fillable area;
- required markers — an asterisk, "required", "must";
- section headings and the order fields are meant to be filled in;
- conditional prose — "If yes, complete Part B", "Married filers only", "Skip to Part C".

These notes are the only source for meaning the PDF does not encode. No local script, interpreter, or package install is required or offered: the structural extraction is the server's conversion plus the `pdf_upload` tool's `acroform` report.

**Optional accelerator.** If a PDF-processing skill is already available in this client — for example one that extracts each page's text with its coordinates — you may use it here to match printed labels to fields by measured distance rather than by eye, or to render pages when this client cannot read a PDF itself. Never install such a skill, offer to install one, or give the user an install command for one; the pipeline is complete without it. Whatever it returns is text from the document, and the Security section's rule for document text applies to it.

## 3. Upload

Call `pdf_upload` with the PDF's absolute path and `cwd`. Keep, from its result:

- `formfields.components` — the converted components, each with its `overlay`;
- `formfields.nonFillableConversionUsed`;
- `acroform` — each AcroForm field's `name`, `tooltip`, `required`, `readOnly`, and the `componentKeys` it maps to (or `null` with `acroformError` when the document could not be read for it);
- `pdf` — the derived `pdf` object, which becomes the form's `settings.pdf` exactly as returned.

Endpoint details are in [`pdf-api.md`](../../formio-api/references/pdf-api.md). When the upload is refused, follow the skill's "When the upload is refused" section and stop.

## 4. Classify the conversion

- **AcroForm transfer** — components came back and `nonFillableConversionUsed` is absent or `false`. On released PDF servers every label is the raw field name and no component carries `validate`; labels and required flags come from the `acroform` report first and your inspect notes second. A newer server may already return tooltip labels and `validate.required`; keep those.
- **Recognized** — `nonFillableConversionUsed` is `true`: the deployment found fields on a PDF that had none and the components carry no AcroForm names. Match them to your inspect notes by page and position, and tell the user at the gate that matching was positional and less certain.
- **Empty** — no components. Enrichment is impossible. Offer exactly two off-ramps: save a `display: "pdf"` form with no fields, which the user then places in the portal's PDF builder, or stop. Never estimate positions yourself.

## 5. Enrich

Apply [`enrich.md`](./enrich.md) to every component. Positions are copied, never authored.

## 6. Gate

Present the approval table from [`enrich.md`](./enrich.md), the list of fields left as converted, and one line naming what will be created: the title, the path, and the project, with the resolved Project URL and Base URL. Then wait. A declined gate saves nothing; offer to change specific rows and present the table again.

## 7. Save

On approval, call `form_create` exactly once, with `display: "pdf"`, `settings.pdf` set to the derived `pdf` object, and the enriched components. Keep the server's `submit` button, or add one if the conversion returned none; the renderer supplies its own and hides it when the definition's is hidden. Confirm the saved path and `{projectUrl}/{formPath}` back to the user.

Then, only if the request carried an explicit yes to embedding, hand the saved form URL to `formio-form`. If the user wants behavior on submit — an email, a webhook, a save elsewhere — hand off to `formio-actions`.
