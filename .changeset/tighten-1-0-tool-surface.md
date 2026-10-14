---
'@formio/mcp': patch
---

- `action_create` and `action_update` accept every condition shape Form.io stores — the portal's `{conjunction: '', conditions: [], custom}`, legacy `field`/`eq` conditions, and `null` — and send it unchanged; a `custom` JavaScript or JSON Logic condition is no longer dropped, so an action read with `action_get` can be saved back as read. `settings` may be `null`.
- Every tool refuses a top-level argument it does not declare, naming it, instead of ignoring it silently; form, action, role, and template documents stay open to fields their schemas do not list.
- `project_import` is annotated as not idempotent: each import recreates the actions of the forms it names.
