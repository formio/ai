# Enrichment rules

This reference is loaded by the parent `formio-pdf-form` skill whenever a lane changes the components of a PDF form — building one, improving one, or replacing its PDF. It is not a standalone skill.

## Positions

Every `overlay` position (`page`, `top`, `left`, `width`, `height`) you save comes verbatim from a PDF-server conversion response. Copy it; never write, edit, round, scale, or "correct" it, and never invent one. The PDF server places each field from its declared geometry and never measures the page, so a guessed position misplaces the field on every rendered form and every downloaded PDF without any error. An empty `style` may be dropped. A component you add that has no conversion overlay must be one that does not render on the page, such as `hidden`.

## Per component

Join each converted component to its AcroForm field through the `acroform` report's `componentKeys`, and, by page and position, to what you noted while inspecting the pages. Then decide:

- **Label** — in order of precedence: a label the server already made human-readable (newer servers use the tooltip); the field's `tooltip` from the `acroform` report; the nearest visible label from your inspect notes. Always replace a machine label — `f1_01[0]`, `topmostSubform[0].Page1[0]…`, or a bare field name such as `state`.
- **Key** — a camelCase key, unique in the form, derived from the final label. On a saved form a key is the path its submission data lives at, so the existing-form lanes keep every key unless the user approves a rename at the gate.
- **Type** — keep the converted type unless your notes justify a change, such as a text field that is plainly an email address or a date. A changed type must be in the PDF overlay allow-list: `textfield`, `number`, `password`, `email`, `phoneNumber`, `currency`, `checkbox`, `signature`, `select`, `textarea`, `datetime`, `file`, `htmlelement`, `signrequestsignature`. The PDF renderer rewrites any other input type to `hidden`, so the field disappears from the page while still holding data.
- **Radio groups** — a PDF radio group arrives as several `checkbox` components with `inputType: "radio"`, one shared `name`, and one `value` each. Keep each one's `type`, `inputType`, `name`, and `value` unchanged and give them one human label; do not merge them into a `radio` component, which is not on the allow-list.
- **Validation** — set `validate.required` from the conversion when present, else from the `acroform` report's `required`, else from a visible required marker; set `disabled` from the report's `readOnly` when the conversion did not. Add formats and lengths only where the document states them.
- **Options** — give `select` values readable labels; keep the server's values.
- **Conditions** — turn conditional prose into conditions on the affected components. How simple and JSON Logic conditions behave is in [`conditionals.md`](../../formio-form/references/conditionals.md), and cross-field rules in [`validation.md`](../../formio-form/references/validation.md); the component JSON comes from `formio-schema`. Express a condition as data, never as a JavaScript string.
- **Unmatched or uncertain** — leave the component exactly as converted and list it at the gate. Never guess.

## The gate table

Show one row per component that changes:

| Field | Label (source) | Key | Type | Validation | Condition |
| --- | --- | --- | --- | --- | --- |
| `f1_01[0]` | First name (tooltip) | `firstName` | textfield | required (PDF flag) | — |

Beneath it, list the components left as converted and why, and — for a recognized conversion — say that matching was positional. The user may change any row; present the table again before saving.
