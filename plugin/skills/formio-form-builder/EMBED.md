# EMBED — conditional handoff to the embedding skill

This document is loaded by the parent `formio-form-builder` skill during Step 4. It is **not** a standalone skill — no frontmatter, no independent trigger.

## The gate

This step runs ONLY when INTENT captured `embedIntent: yes` — the user's explicit yes to "embed it in my app". Any other answer means the flow already ended at SAVE. Never enter this step on inference (an app in the working directory is not a yes; a hedge like "maybe later" is not a yes).

## The handoff

Embedding mechanics live entirely in the `formio-form` skill — rendering, options, events, conditional logic. This skill hands off and steps aside; it never duplicates that guidance.

Pass to `formio-form`:

- **The saved form URL** — `{FORMIO_PROJECT_URL}/{formPath}` from SAVE. This is the `src` the embedding skill renders.
- The form type from INTENT (a wizard renders with its display mode intact — the embedding skill may care about page navigation).
- The user's own words about where the form goes ("my checkout page", "the careers section"), verbatim.

## Framework routing

- **No framework named** — `formio-form` is the library's default embed skill; hand off to it.
- **Angular-explicit** — the user named Angular or `@formio/angular` at any point: route through `formio-angular` instead, per the library's standing rule that Angular-explicit phrasing always goes to the Angular skill.

After the handoff, the embedding skill owns the conversation — do not resume the form-builder flow unless the user asks for another form.
