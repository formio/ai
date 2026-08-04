---
'@formio/mcp': minor
---

Start without configuration, and describe every tool fully.

The server no longer exits when `FORMIO_PROJECT_URL` is unset. It starts, serves `tools/list`, and raises the (already clearer) missing-project error only when a tool actually needs the value. Previously any client that connected before being configured — including automated crawlers — saw a dead process and concluded the server exposed no tools at all.

Every tool now declares an `outputSchema` and MCP annotations (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), so a caller can type-check responses and tell a read from an overwrite before invoking anything.

Breaking change to the list tools' payloads: `form_list`, `role_list`, `action_list`, `action_types_list`, and `form_revisions_list` now return a named object (`{ forms: [...], count: n }`) instead of a bare array, because structured content must be an object.
