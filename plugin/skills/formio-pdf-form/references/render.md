# Rendering a PDF form

This reference is loaded by the parent `formio-pdf-form` skill when a PDF form is shown on a page. It is not a standalone skill, and it covers only what differs from any other form: mounting is [`formio-form`'s rendering reference](../../formio-form/references/rendering.md), and `formio-form` hands React and Angular workspaces to their framework embed skills.

- **The PDF is drawn in an iframe.** The renderer sees `display: "pdf"` and loads an iframe whose source is `settings.pdf.src` with `.html` appended. `settings.pdf` must therefore be present, and its host — the project's PDF proxy — reachable from the page; a form without it renders nothing.
- **Options it honors.** `zoom` sets the PDF's starting zoom; `readOnly` shows a submission's data laid over the PDF without inputs. Both reach the iframe as query parameters.
- **Submitting.** The renderer supplies its own submit button and hides it when the definition's submit button is hidden. Submitting asks the iframe for its errors first, then for its data.
- **The message channel.** The iframe and the page exchange values by `postMessage`. The renderer accepts messages only from its own iframe, from that iframe's origin; application code never relays, forges, or listens in on them.
- **Unsupported types.** Any input whose type is outside the PDF overlay allow-list in [`enrich.md`](./enrich.md) is rewritten to `hidden` inside the iframe: it keeps its value for logic but is never drawn.
- **Webforms carrying a PDF.** A `form` or `wizard` definition with `settings.pdf` renders as a normal form on the page, but prints over that PDF, so its components need overlays; without them its PDF download fails.

Field behavior — conditions, calculated values, validation — works as in any form and is documented by `formio-form`.
