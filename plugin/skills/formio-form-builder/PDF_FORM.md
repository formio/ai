# PDF_FORM — the agent-enriched PDF pipeline

This document is loaded by the parent `formio-form-builder` skill when INTENT confirms the `pdf` form type. It is **not** a standalone skill — no frontmatter, no independent trigger. It subsumes the SCHEMA and SAVE steps for the PDF lane; EMBED still applies afterward per [`EMBED.md`](./EMBED.md).

The server converts a PDF's AcroForm fields into Form.io components automatically, but that conversion is a raw skeleton: machine labels like `f1_01[0]`, no validations, no conditionals. This pipeline has the agent read the PDF itself and enrich the skeleton before anything is saved. The split that makes it reliable: **deterministic extraction in scripts, semantics in the agent, overlay geometry untouched, a gate before every write.**

All PDF endpoint details (paths, request/response fields, errors) live in the formio-api skill's reference at `formio-api/references/pdf-api.md` — read it there; do not restate it here or anywhere else.

## 1. Collect

Ask for the local path to the PDF document (one question). Everything downstream needs the file on disk.

## 2. Preflight — is this a fillable PDF?

Check for AcroForm fields before any other work. Preferred: Python with `pypdf` (offer a one-time `pip install --user pypdf` if missing). Fallback detection only: scan the raw file for an `/AcroForm` marker.

```bash
python3 - "$PDF_PATH" <<'EOF'
import sys
from pypdf import PdfReader
fields = PdfReader(sys.argv[1]).get_fields() or {}
print(f"{len(fields)} AcroForm fields")
EOF
```

- **Fields present** → continue to Analyze.
- **No fields (a flat or scanned PDF)** → field enrichment is unsupported. Offer exactly two off-ramps: create a plain `display: "pdf"` form **without enrichment** (the PDF renders as a background with no auto-placed fields), or stop. Never attempt to guess overlay coordinates visually.

## 3. Analyze — two passes

**Structural pass (script, deterministic).** Dump every AcroForm field: fully-qualified name, field type, required flag, choice options, tooltip, page, and rect. Tooltips (`/TU`) are the highest-quality label source — PDF authors put the human label there.

```bash
python3 - "$PDF_PATH" <<'EOF'
import json, sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
dump = []
for page_number, page in enumerate(reader.pages, start=1):
    for annotation in page.get('/Annots') or []:
        field = annotation.get_object()
        if field.get('/Subtype') == '/Widget':
            dump.append({
                'name': field.get('/T'),
                'fieldType': field.get('/FT'),
                'required': bool(int(field.get('/Ff') or 0) & 2),
                'options': field.get('/Opt'),
                'tooltip': field.get('/TU'),
                'page': page_number,
                'rect': [float(v) for v in field.get('/Rect')],
            })
print(json.dumps(dump, indent=2, default=str))
EOF
```

**Visual pass (Read tool).** Read the rendered PDF pages (at most 20 pages per request — loop for longer documents) and note, per field: the visible label text beside it, required markers (`*`, "required"), and any conditional prose — "If yes, complete Section B", "Section 2 applies to married filers only". This prose is the raw material for `conditional`s and cross-field validations.

If the structural pass is impossible (no Python at all), continue with the visual pass plus the tooltips embedded in the server conversion's output, and disclose at the gate which fields had lower-confidence sources.

## 4. Upload

Call the `pdf_upload` MCP tool with the file path. Stash from its result: `path`, `file` (the PDF UUID), and `formfields` — the server's auto-converted component skeleton, each component carrying its `overlay` geometry. Endpoint semantics: see `formio-api/references/pdf-api.md`.

If the call fails because the project has no PDF server enabled (or the plan does not include one), report the server's error plainly, explain that PDF forms require the PDF server, and stop — no fallback that would produce a broken form.

## 5. Enrich

Match each converted component to the structural dump: primary key is the AcroForm field name (the conversion writes it into the component's label/key), tiebreaker is page + rect against the component's `overlay`. Then, per component:

- **Label** — replace the machine label with the human label (tooltip first, visual text second).
- **Key** — assign a clean, unique camelCase key derived from the new label.
- **Required** — set `validate.required` from the AcroForm required flag or a visual required marker.
- **Options** — map choice options onto select/radio values with readable labels.
- **Conditionals** — translate the conditional prose into `conditional` settings on the affected components.
- **Overlay** — copy every `overlay` value through unmodified. Never edit, round, or "fix" overlay geometry — it is the field's position binding on the PDF.

Component JSON shapes (validation keys, conditional forms, select options) come from the `formio-schema` skill — defer to it by name; nothing here documents component schemas.

A component that cannot be confidently matched stays exactly as the server produced it and is flagged for the gate.

## 6. Gate

Mandatory **approval gate** before any save. Show one table:

| AcroForm field | Proposed label | Key | Validation | Condition |
| --- | --- | --- | --- | --- |

plus a separate list of unmatched/low-confidence fields left unenriched. Inference is heuristic — the user confirms it. A declined gate saves nothing; offer to adjust specific rows and re-present.

## 7. Save

On approval, create the form once — already enriched — via `form_create`: `display: "pdf"`, `settings.pdf` built from the upload response (`file` → id, `path` → src, per `pdf-api.md`), and the enriched components. Then the standard SAVE confirmation from [`SAVE.md`](./SAVE.md) — the form URL is `{FORMIO_PROJECT_URL}/{formPath}` — and the EMBED conditional from INTENT applies as usual.

No unenriched intermediate form is ever saved.

## Variant — enriching an already-uploaded PDF form

When the user already has a PDF form in the project (uploaded via the portal) and wants better labels/validations: fetch it with `form_get`, run Analyze against the original PDF if available (or work from tooltips and the visual pass on the rendered form), Enrich, Gate, then persist with `form_update`. Same rules — overlay untouched, gate mandatory.
