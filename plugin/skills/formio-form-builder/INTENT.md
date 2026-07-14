# INTENT — Form type + embed intent

This document is loaded by the parent `formio-form-builder` skill during Step 1. It is **not** a standalone skill — no frontmatter, no independent trigger.

## The interview

Ask everything in **one** batched `AskUserQuestion` call — two questions, one round trip. Never split them into two calls, and never ask the embed question later as a separate round.

The form-type question's options come from the inference rules below: when the phrasing already signals a type, put that type first with "(Recommended)" so the user confirms rather than decides cold. The distinguishing signals live in [`FORM_TYPES.md`](./FORM_TYPES.md) — read its "Phrasing signals" table before asking.

```
AskUserQuestion({
  questions: [
    {
      question: "What kind of form should this be?",
      header: "Form type",
      multiSelect: false,
      options: [
        {
          label: "Single-page form (Recommended)",   // reorder so the inferred type is first
          description: "A webform — every field on one page, completed and submitted in one view. Best for shorter forms."
        },
        {
          label: "Multi-page wizard",
          description: "Fields broken into bite-size pages with Previous/Next navigation. Best for long or staged forms."
        },
        {
          label: "PDF form",
          description: "Interactive fields overlaid on an existing PDF document you upload. Best for reproducing an official/paper form."
        }
      ]
    },
    {
      question: "After the form is saved to your Form.io project, do you also want it embedded into an application?",
      header: "Embed?",
      multiSelect: false,
      options: [
        {
          label: "No — just create the form",
          description: "The flow ends after saving, with your form's URL. You can embed it any time later."
        },
        {
          label: "Yes — embed it in my app",
          description: "After saving, hand off to the embedding skill to put the form into your page or application."
        }
      ]
    }
  ]
})
```

## Inferring the form type

Infer from phrasing when unambiguous, and let the question confirm rather than discover:

- **Wizard implied** — "multi-page form", "multi-step", "wizard", or the user describes stages/steps/sections. Reorder the options so "Multi-page wizard (Recommended)" is first.
- **PDF implied** — "pdf form", "fill out this PDF", "overlay fields on my PDF". Put "PDF form (Recommended)" first.
- **Webform implied** — "survey", "contact form", "questionnaire", or any single-form ask with no size or layout cues. Keep "Single-page form (Recommended)" first.
- **Ambiguous** — a long field list with no type named, or an existing document mentioned without the word PDF. Do NOT mark any option recommended; present the three types neutrally and ask.

See the "Phrasing signals" table in [`FORM_TYPES.md`](./FORM_TYPES.md) for the full signal list. Even when the inference is certain, the question still runs — it is a confirmation, and it carries the embed question in the same batch either way.

## The embed answer gates Step 4

- **"Yes — embed it in my app"** — an **explicit yes**. Stash `embedIntent: yes`; after SAVE succeeds, run Step 4 (EMBED) per [`EMBED.md`](./EMBED.md).
- **"No — just create the form"**, an "Other" answer that is not clearly a yes, or anything hedged ("maybe", "later", "not sure") — stash `embedIntent: no`. The flow ends at SAVE with the saved form URL. Tell the user they can embed later — the `formio-form` skill picks that up whenever they ask.

The EMBED step fires ONLY on the explicit yes. Never infer embed intent from context (e.g., the working directory containing an app is NOT a yes).

## What to stash for later steps

- `formType` — `webform` | `wizard` | `pdf`; Step 2 (SCHEMA) passes it to `formio-schema` for the definition's display mode.
- `embedIntent` — `yes` | `no`; read after SAVE to decide whether Step 4 runs.
- For `pdf`: route to [`PDF_FORM.md`](./PDF_FORM.md) — the PDF lane subsumes SCHEMA and SAVE, has the agent analyze and upload the user's PDF document itself, and enriches the auto-converted fields before saving.
