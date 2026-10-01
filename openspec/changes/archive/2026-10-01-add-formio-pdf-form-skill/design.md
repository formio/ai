# Design: `formio-pdf-form`

## Context

The library today has no MCP tool that uploads a file (`formioFetch` serializes every body as JSON), no PDF lane in `formio-form-builder` beyond a stated prerequisite, and a `pdf-api.md` whose upload endpoint does not route. The skill must also fit the library's current conventions: `project_get` resolution before the first deployment call, the Project URL / Base URL terminology rule, the `## Security` section for skills that document an execution surface, and no install commands outside `formio-mcp-setup`.

Two sources back every server and renderer behavior below: the Form.io source monorepo (`nirvana`) at `d7abb28e5e` (28 September 2026; `main` is the released line, `nextgen-pdf-first` is unreleased), and a live local Enterprise deployment (`formio/formio-enterprise:latest`, `/status` 9.9.2; portal with `@formio/js` 5.5.2), probed on 1 October 2026 with hand-built test PDFs and the portal's own flows under network capture. "Live" records what that deployment did; "source only" marks a fact not exercised live.

| Fact | Source | Live |
| --- | --- | --- |
| `POST {projectUrl}/upload` is rewritten to `/pdf-proxy/pdf/:projectId/file`; `{projectUrl}/pdf-proxy/upload` is not routed | `apps/formio-server/src/middleware/pdfProxy/rewrite/upload.js`; `apps/pdf-server/src/server.js:49-94` | `/upload` → 200; `/pdf-proxy/pdf/{projectId}/file` → 200; `/pdf-proxy/upload` → 400 `{}`, identical to a nonsense `/pdf-proxy/…` path. The portal's PDF-form dialog posts to `/upload`. |
| Upload response is `{ path: "/pdf/{projectId}/file/{fileId}", file, formfields }`; no `filesServer` | `apps/pdf-server/src/pdf.js:71-93` | Exactly those three keys. For an AcroForm PDF `formfields` holds only `components` — `nonFillableConversionUsed` is absent (re-probed during implementation). |
| A non-PDF upload fails | `apps/pdf-server/src/middleware/core/upload.js` | 500 with an HTML error page (not 400). |
| AcroForm transfer first; Textract recognition when transfer yields nothing and the deployment enables it; `formfields.nonFillableConversionUsed` | `apps/pdf-server/src/middleware/core/pdf/add-formfields.js` (on `main`) | Flat PDF → 200, `components: []`, `nonFillableConversionUsed: false` (Textract not configured). |
| Released converter: `{ type, key, label, overlay }`, `label` = field name, no validation; `select` gets `data.values` from `/Opt`; a radio group becomes `checkbox` components with `inputType: "radio"`, a shared `name`, and per-option `value`; overlay `{ width, height, top, left, page, style }` | `.../formfields/transfer/classes/component.js` on `main` | Matches: tooltip-bearing, required-flagged fields came back labelled `f1_01[0]` with no `validate`; options and radio grouping as described. |
| Unreleased converter adds tooltip labels, `validate.required`, `disabled`, `hidden`, `defaultValue` | same file on `nextgen-pdf-first` (commit `ae03e29f03`, 24 September 2026; not on `main`, no tag) | Not present (expected). |
| `settings.pdf.src` = `{filesServer}{path}` or `{new URL(projectUrl).origin}/pdf-proxy{path}` | `packages/formio.js/src/PDFBuilder.js:262-269` | Portal saved `{origin}/pdf-proxy/pdf/{projectId}/file/{fileId}` for a sub-directory project URL; existing forms show the same shape. |
| Portal create = `POST {projectUrl}/form` with `display: "pdf"`, `settings.pdf`, the conversion's components plus a `submit` button, `pdfComponents: []`; saved overlays omit the empty `style` | `apps/formio-app/src/scripts/controllers/form.js` | Observed in the captured request and the saved form. |
| PDF overlay allow-list; other types rewritten to `hidden` inside the PDF iframe | `PDFBuilder.js:32-54`; `docs/gotchas/formio-pdf.md` G-PDF01 | `Formio.Builders.builders.pdf` allow-list matches; the "PDF Fields" palette has no Radio. The in-iframe downgrade was not observable (source only). |
| Re-upload keeps non-pristine components and their overlays unchanged | `PDFBuilder.js:241-254` | Removed the PDF on a 7-component PDF form, uploaded a different PDF, saved: all 7 components kept their old overlays; only `settings.pdf` changed. |
| `pdfComponents` replaces `components` at download for a non-PDF form, each reference filled from the live component by key | `apps/pdf-server/src/middleware/core/pdf/submission/index.js:28-42` | Wrote `pdfComponents` by API: the rendered download carried only the template's components, and a pruned reference gained the live component's `input: true`. |
| Designer tab gating: `pdfBuilder` (`license.terms.options.pdfBasic === false`) or a trial/commercial plan, client-side only; the server applies `pdfComponents` regardless | `apps/formio-server/src/middleware/formioConfig.js:34-35`; legacy `form.js:1430` | `config.js` has `pdfBuilder = false`; no PDF tab on a `commercial`-plan project (the route redirects to edit); upload still worked; the API-written template was applied anyway. |
| A non-PDF form carrying `settings.pdf` downloads over the PDF ("hybrid"); its components need overlays | `apps/pdf-server/src/middleware/core/file/path.js:5-64`; G-PDF01 | A webform given `settings.pdf`: the HTML download rendered over the PDF page; the binary download returned 500 (with `pdfComponents`) or hung past 35 s (without). |
| Upload license refusal: 400 "License does not support creating pdf forms" | `apps/pdf-server/src/middleware/core/checkPlan.js` | Source only (this license permits upload). |
| PDF renderer: iframe at `{settings.pdf.src}.html?id=…`, `readonly=1`, `zoom=`, `builder=1`, `iconset=`; own submit button; origin-checked `postMessage` | `packages/formio.js/src/PDF.js` | `createForm(…, { readOnly: true, zoom: -2 })` produced `…/file/{uuid}.html?id=…&readonly=1&zoom=-2&iconset=fa`; the builder used `&builder=1`; a submit button rendered. |
| `getDownloadUrl` → `{baseUrl}/project/{projectId}/form/{formId}/submission/{subId}/download?token=…`, token from `GET {projectUrl}/token` | `packages/core/src/sdk/Formio.ts:1219-1255` | SDK called `GET {projectUrl}/token` (200, `{ token, key }`); the URL returned a PDF without a JWT; the same path without a token → 401. `GET {projectUrl}/pdf-proxy/token` → 400 `{}`. |
| Other `pdf-api.md` endpoints | — | Routed: `GET pdf-proxy/pdf/{projectId}/file` (list), `…/file/{id}.html`, `…/file/{id}.pdf`, `POST pdf-proxy/pdf/{projectId}/download` (ad hoc), `GET {projectUrl}/form/:id/submission/:sid/download`. Unrouted (400 `{}`): `POST pdf-proxy/form`, `POST pdf-proxy/form/:id/submission`, `GET pdf-proxy/form/:id/submission/:sid/download`. |
| Download query parameters (`margin`, `pageSize`, `orientation`, `language`, `format`, …) | `apps/pdf-server/src/middleware/core/pdf/generatePDFOptions.js` | `format=html` honored; the others source only. |

## Goals / Non-Goals

**Goals:**

- One skill that owns everything PDF-specific, with `formio-form-builder` and `formio-form` keeping the generic steps.
- A reliability split: deterministic extraction on the **server**, semantics in the agent, overlay provenance fixed, a gate before every write.
- No agent-composed URLs: the tool derives `settings.pdf`.
- No local tooling and no install instructions.
- Every server-facing statement traceable to a nirvana file, and checked live where the local deployment can exercise it.

**Non-Goals:**

- Placing fields on a PDF the conversion returned nothing for. Visual coordinate estimation would violate the overlay invariant; the user places fields in the portal builder.
- New MCP tools beyond `pdf_upload`. Listing, fetching, and deleting PDF files stay HTTP-only in `pdf-api.md`; download is runtime.
- Authoring hybrid forms (a webform carrying `settings.pdf`). The mechanism is now known — the download renders over the PDF when `settings.pdf` is present — but it needs overlay-bearing components, so it is a PDF form displayed as a webform rather than a new lane. The skill only warns about it (template lane).
- Dynamic PDF translation, e-signature, and the staging PDF migration.
- An eval harness (follow-up).

## Decisions

### D1: A top-level peer skill, not a step doc or a nested sub-skill

PDF work has five lanes, two of which (render, download) sit under `formio-form` and three (build, existing form, template) under `formio-form-builder`. A nested sub-skill under either would force the other to link across into a sibling's subtree and would make "here is my PDF" depend on the parent activating first. A step doc inside `formio-form-builder` has no home for render, download, or template. A peer skill — the `formio-auth` precedent — owns the PDF-specific content, claims PDF-document phrasing, and is reached by name from both neighbors. Cost: one description-budget slot and two new collision-guard boundaries, both tested.

### D2: The server is the structural pass

The released PDF server's converter supplies everything positional and structural — type, key, overlay, page, choice options, radio grouping — and nothing semantic: labels are raw field names and no field carries `validate`, even when the PDF has a tooltip and a required flag (observed live; the unreleased `nextgen-pdf-first` converter adds both). The agent's pass is therefore the visual read — the printed label beside each field, required markers, section headings, conditional prose — and on a released server it is the only source of labels and required flags. Where a newer server already returns a human label or `validate.required`, the enrichment rules keep it and replace only labels that look machine-generated.

Tooltips and the required and read-only flags are recovered by `pdf_upload` (D2a), not by the agent and not by a local script. A local extraction script over a PDF library was rejected: it needs an interpreter and an install line that `no-install-commands-in-skills.test.ts` and the skills.sh scanners reject.

### D2a: `pdf_upload` reads the AcroForm with `pdf-lib`

The tool already holds the file bytes, so it parses them once more and returns `acroform.fields`: name, tooltip, required, read-only, and the conversion component keys each field maps to. `pdf-lib` (MIT, pure JavaScript, no worker) is what the PDF server itself uses for field-level tooltips (`apps/pdf-server/src/services/pdf-formfields/extract.js`, `readFieldTooltips`), and the tool copies that function's two lessons: read fields from `doc.catalog.getAcroForm()`, not `doc.getForm()`, which strips XFA; and return nothing for an encrypted document, whose strings `pdf-lib` does not decrypt. Extraction is best-effort and never fails the upload.

Fields are tied to components by the converter's own key rule (`component.js` and `converter.js` on `main`: lodash-`camelCase` the best name — the partial field name the extractor reports, not the fully qualified one — prefix a leading digit with `_`, suffix a repeated key with `_N` in widget order). The tool uses lodash's own `camelCase` (one function import) rather than a re-implementation, so word splitting matches exactly, checked against the keys actually returned — `f1_01[0]` → `f1010` and `contactPref` → `contactPref`, `contactPref_1` match the live conversion. Re-deriving the rule couples the tool to the converter; the check against returned keys bounds the damage to an empty `componentKeys`, which the enrichment rules treat as "no tooltip", falling back to the visual pass.

Rectangles are deliberately left out of the report, so the overlay provenance invariant cannot be broken by building a position from them.

Alternative — `pdfjs-dist`, as the converter uses: rejected for the tool; it is far heavier, needs a worker setup in Node, and reads `/TU` only from widget dictionaries, which loses it on radio groups (the reason the server added the `pdf-lib` pass).

### D2b: Third-party PDF skills are optional accelerators

Published PDF skills were surveyed on 1 October 2026: Anthropic's `pdf` (`anthropics/skills`), `aiskillstore/marketplace`'s `pdf-processing`, and `pspdfkit-labs/nutrient-skills`. Anthropic's was read in full: its field extractor returns id, page, rectangle, type, and options — no tooltip and no required flag — and it depends on local Python packages (`pypdf`, `pdfplumber`, poppler). The others were assessed from their listings only. The most useful capability on offer is page text with coordinates (Anthropic's `extract_form_structure.py`), which lets printed labels be matched to fields by distance rather than by eye. The skill therefore allows an already-available PDF skill in the inspect step and never installs or recommends installing one: the pipeline is complete without it, an install line would conflict with the library's no-install rule, and recommending a specific vendor's skill ties agent-neutral prose to one client's catalog.

### D3: `pdf_upload` uses `{projectUrl}/upload` and derives `settings.pdf`

`{projectUrl}/upload` is the route `@formio/js`'s `PDFBuilder` and both portals use, it needs no project id, and it works for sub-domain and sub-directory project URLs alike. The proxied `{projectUrl}/pdf-proxy/pdf/:projectId/file` is equivalent but needs the project's `_id`, which would cost an extra request. `{projectUrl}/pdf-proxy/upload`, which `pdf-api.md` documents today, does not route.

The tool returns the response verbatim and adds `pdf: { id, src }` computed by the `PDFBuilder` rule. The library forbids agents composing URLs from parts; putting the rule in a tested pure function keeps it in one place. The new Angular portal derives the origin from its API base rather than the project URL; on a sub-directory deployment the two origins coincide, and on hosted the project sub-domain proxies the same path, so the renderer's rule is the one adopted.

### D4: `formioFetch` accepts `FormData`

`body instanceof FormData` → assign directly, no `Content-Type`. A separate upload function was rejected: it would duplicate URL building, auth, and the 401 retry for one header difference. The in-memory `Blob` makes re-sending on retry safe.

### D5: Overlay provenance, generalized

"Copy overlays through unmodified" is not enough: the replace-PDF lane needs overlays to *change* — from the old conversion to the new one — so the rule is stated as provenance: every saved overlay is a verbatim value from some conversion response. That one rule covers build (copy), enrich (copy), and replace (take the new conversion's value), forbids every form of authoring, and is gradeable by deep-equality against the conversion the component was matched to.

### D6: Keys are stable by default on saved forms

On a new form, keys are cleaned freely. On a saved form, a key is the submission data path, so renaming orphans existing data; the existing-form and replace lanes keep keys unless the user approves each rename at the gate. The skill does not count submissions (no tool does), so it assumes a saved form may have them.

### D7: The template lane writes `pdfComponents` and nothing else

Mirrors the designer exactly: the eight-property prune, the skip-list, data-component children excluded, `components` left untouched. Because the server fills each reference from the live component at download time, a template written this way stays correct as the form evolves — which is also why the prune exists.

The designer's gate is client-side only, and the server applies a saved `pdfComponents` regardless (observed live on a deployment where the PDF tab is hidden). Saving a template is therefore not inert: it changes every PDF download of that form immediately, whether or not the portal shows the designer. The gate says so, and says that the portal will not show the template for editing where the designer is not enabled. The lane refuses a target that carries `settings.pdf`: such a form downloads over its PDF, where components without overlays fail to render (observed: 500 or a hung request).

### D8: Neighbors keep ownership of the generic steps

- Component JSON: `formio-schema` (named), which gains accurate `overlay`, `settings.pdf`, and `pdfComponents` entries.
- Conditional, validation, and calculated-value semantics: `formio-form` references (linked by path).
- Mounting: `formio-form` and, through its host check, the framework embed skills.
- Endpoint shapes: `formio-api/references/pdf-api.md` (by path), which is corrected.
- SDK download API: `formio-sdk`'s submissions reference.

### D9: Test strategy

- `formio-client`: mocked `fetch` — `FormData` unserialized, no `Content-Type`, JSON regression, 401 retry re-sends the instance.
- `pdf_upload`: registration and description; `readAcroformFields` over hand-built fixture PDFs (tooltip, flags, radio-group keys, encrypted document); happy path against a temp file with `%PDF-` bytes; non-PDF and missing-file refusals with no request; error passthrough; the `src` derivation as a pure function over hosted, sub-directory, and `filesServer` inputs.
- Skill structure (`packages/skill-tests/src/formio-pdf-form/`): layout, description clauses and budget, lane table, pipeline order, the three conversion classes, overlay rule in both places, allow-list, no install commands, no duplicated behavior content, existing-form and template lane contracts, Security section, Tool Preference.
- Library suites: skill counts step; `security-section-convention`, `collision-guards`, `shared-prose-stays-identical`, `url-terminology`, `description-budget`, `cross-reference-integrity` pick up the new skill.
- Neighbor edits: `formio-form-builder` step-doc and collision tests; `formio-form` structure test; `pdf-api.md` assertions in `packages/skill-tests/src/formio-api/`.

## Risks / Trade-offs

- [Released PDF servers give machine labels and no required flags] → `pdf_upload`'s `acroform` report supplies tooltips and flags; the visual pass covers PDFs without tooltips; the gate shows the source of each label.
- [The converter's key rule changes] → `componentKeys` comes back empty for unmatched fields and labels fall back to the visual pass; a fixture test pins the rule against a recorded conversion.
- [A new runtime dependency in the MCP server] → `pdf-lib` only, pinned in `packages/mcp-server/package.json`, used by one pure module.
- [Textract-recognized components carry no AcroForm names] → positional matching, confidence disclosed at the gate, unmatched fields left as converted.
- [Type changes outside the allow-list silently become `hidden`] → allow-list enforced in the enrich rules and stated with the reason.
- [Key renames on a form with submissions] → keys stable by default; renames approved one by one.
- [Template saved where the designer is not enabled] → the server still applies it to every download; the gate states that, and the portal will not show it for editing.
- [A webform carrying `settings.pdf`] → its downloads render over the PDF and fail without overlays; the template lane refuses such a target and the render lane names the hazard.
- [Prompt injection through PDF text] → Security section: document text is data; label text is escaped; conditionals are data, never evaluated strings.
- [Upload size] → the proxy accepts 50 MB; the portal caps at 20 MB. The tool does not enforce a cap and relays the server's refusal.
- [`{projectUrl}/upload` alias removed in a future server] → one constant in one tool, covered by a test that names the route.
- [A non-PDF file reaches the server] → the server answers 500 with an HTML page; the tool checks the `%PDF-` signature locally first.

## Migration Plan

Nothing to migrate: `pdf_upload` and the skill are new. `formio-form-builder` loses one trigger phrase ("pdf form") to the new skill in the same release that adds it. Apply after `mitigate-skills-sh-security-findings` (it edits `formio-form/SKILL.md`).

## Open Questions

- **Hosted availability of Textract.** The help docs say non-fillable conversion is self-hosted only; the source gates it on deployment configuration alone. The skill treats the flag as the authority either way; the docs wording should be confirmed for the user-facing text.
- **`filesServer`.** Neither the nirvana source nor the live deployment returns it, but the renderer still honors it. Keeping that case in the derivation costs nothing; confirm whether any supported server version still returns it.
- **Untested live:** the license refusal message, Textract recognition, the 50 MB proxy limit, and the effect of `margin` / `pageSize` / `orientation` / `language` on a binary download. Each is cited from source; exercise them on a deployment configured for them before the skill's text promises specifics.
