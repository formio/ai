# SAVE — persist the form via `form_create`

This document is loaded by the parent `formio-form-builder` skill during Step 3. It is **not** a standalone skill — no frontmatter, no independent trigger.

By this point Step 2 (SCHEMA) has produced the complete form JSON definition via `formio-schema`. This step writes it into the user's Form.io project.

## The approval gate

Saving writes into the user's live project, so it sits behind an approval gate. Before calling `form_create`, show the user a short plain-language summary and get a yes:

- **Title** — the form's display title.
- **Path** — the machine path the form will live at (`formPath`).
- **Type** — webform, wizard, or PDF form (from INTENT).
- **Target project** — the `FORMIO_PROJECT_URL` the form will be created in.
- A one-line component summary ("12 fields across 3 pages", "6 fields including a signature").

A declined gate stops the flow — do not save, do not proceed to EMBED, leave nothing behind.

## The call

On approval, invoke the MCP server's `form_create` tool with the authored definition. `form_create` itself validates against the `formio-schema` conventions — the definition from Step 2 is passed through unmodified.

Before the call, if there is any doubt the path is free, check with `form_get` (a hit means the path is taken — pick a new path with the user rather than overwriting).

## On success — confirm the saved form

Report back, always including the full form URL:

```
Saved ✓  "{title}" is live at {FORMIO_PROJECT_URL}/{formPath}
```

The form URL `{FORMIO_PROJECT_URL}/{formPath}` is the handle everything downstream uses — it is what EMBED hands to `formio-form`, and what the user shares, renders, or revisits. If INTENT captured `embedIntent: yes`, continue to Step 4 (EMBED); otherwise the flow ends here — remind the user they can embed later by asking to embed this form.

## Error branches

### Auth failure (401 / unauthenticated)

The MCP server authenticates via its browser-based portal-login flow: the `authenticate` tool opens the Form.io portal login in a browser, captures the returned JWT, and attaches it to every subsequent request as the `x-jwt-token` header. On an auth error:

1. Tell the user sign-in is needed and invoke `authenticate`.
2. When the login completes, retry the same `form_create` call — the definition is unchanged.

Do not attempt PKCE or API keys — they are not how this server authenticates.

### Validation failure (400 / schema rejected)

The server rejected the definition. Quote the shortest decisive error line, route the fix back through `formio-schema` (Step 2 owns the definition), and offer the user a choice: retry with the corrected definition, or bail. Never hand-patch the JSON outside the schema skill.

### Project not found / wrong URL

The target `FORMIO_PROJECT_URL` did not resolve. Re-confirm the project URL with the user (a typo or the wrong environment is the usual cause) and retry.
