## Context

The MCP server has `form_get` (read), `form_list` (list), and `form_create` (create) tools. The Form.io Update Form API is `PUT /form/{formId}` with the full form JSON body and the `x-token` header. The response is the updated form JSON. The `formioFetch` function already supports `method` and `body` options (added for `form_create`), so PUT requires no HTTP client changes.

The update workflow is a multi-step LLM process:

1. LLM calls `form_get` to fetch the current form definition
2. LLM applies the user's requested changes (add/remove/modify components, change settings)
3. LLM calls `form_update` with the form's `_id` and the complete updated form JSON

The tool accepts the full form JSON (not a diff/patch). This matches the Form.io API which expects the complete form definition on PUT.

## Goals / Non-Goals

**Goals:**

- Register a `form_update` MCP tool that accepts a form ID and the updated form definition
- Send the update via `PUT /form/{formId}` using existing `formioFetch`
- Tool description guides the LLM through the fetch-modify-update workflow

**Non-Goals:**

- Partial/patch updates (the Form.io API requires the full form definition)
- Automatic field diffing or merge logic in the tool itself — the LLM handles this
- Form deletion (future tool)

## Decisions

### 1. Accept `formId` and `form` as separate parameters

The form ID identifies which form to update. The `form` parameter contains the complete updated form JSON. Keeping them separate makes it explicit which form is being targeted and prevents the LLM from needing to ensure `_id` is in the body.

**Alternative considered:** Single `form` parameter with `_id` inside. Rejected — less explicit and the LLM might omit `_id` from the body.

### 2. Use `formio-form` skill reference in the description

Like `form_create`, the tool description instructs the LLM to use the `formio-form` skill for schema guidance when constructing the updated form JSON. It also instructs the LLM to first call `form_get` to fetch the current definition before making changes.

### 3. Accept the form body with `.passthrough()` on a minimal Zod schema

The Zod schema requires `components` (since every valid form needs them) and accepts optional top-level fields. Using `.passthrough()` allows the LLM to include any additional form properties (`access`, `submissionAccess`, `settings`, etc.) without the tool rejecting them. This mirrors `form_create`.

## Risks / Trade-offs

- **[Full replacement]** → The PUT API replaces the entire form. If the LLM forgets to include existing fields, they'll be lost. The tool description mitigates this by instructing the LLM to always fetch first.
- **[Large payloads]** → Complex forms have large component arrays. Acceptable since the LLM is working with the full definition and the API handles it fine.
