# Existing PDF forms

This reference is loaded by the parent `formio-pdf-form` skill when the user wants to improve a saved PDF form or swap the PDF behind it. It is not a standalone skill.

Fetch the form with `form_get`, using `form_list` first when the user names it loosely. Confirm its `display` is `pdf`; a webform's download layout is the PDF template lane instead.

On a saved form, keys are kept. A key is the path that form's submission data lives at, so renaming one orphans every existing submission's value for it. Propose a rename only when the user asks for one, show it as its own row at the gate, and apply it only when approved.

## Enrich a saved PDF form

1. Ask for the original PDF and inspect it as the build lane does. Without it, the only material is what the saved components already carry; say so, and offer to stop rather than guess labels.
2. `pdf_upload` the original to obtain the `acroform` report of tooltips and flags. Its conversion is used only to match fields to components, and the saved form keeps its own `settings.pdf`.
3. Apply [`enrich.md`](./enrich.md) with keys kept, and present its gate table.
4. On approval, persist with `form_update`. Overlays are untouched.

## Replace the PDF behind a form

Use this when a new edition of the document replaces the old one. The portal's own re-upload keeps every existing component at its old positions on the new PDF and remaps nothing, so fields drift off their boxes wherever the layout moved. This variant moves them with the document instead.

1. Upload the new PDF with `pdf_upload`.
2. Match the new conversion's components to the saved components: by key first, then by label, then by page and position against what you noted while inspecting the new PDF.
3. For each match, keep the saved component's key and settings and take the new conversion's `overlay` verbatim.
4. For each saved component with no match, its old position points at the wrong place on the new PDF. The user decides: remove it or keep it as `hidden`, which keeps its data but takes it off the page.
5. For each new component with no match, offer it as an addition, enriched per [`enrich.md`](./enrich.md).
6. Present the gate: matched fields with their old and new pages, unmatched saved fields with the user's choice, additions.
7. On approval, one `form_update` with `settings.pdf` set to the new upload's derived `pdf` object and the reconciled components.

Form revisions, where the project keeps them, record the previous definition, so the old layout can be recovered from the form's revision history.
