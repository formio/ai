---
'@formio/mcp': major
'@formio/ai': major
---

The 1.0 tool surface. Breaking changes for any client calling the tools directly; the skills and READMEs ship updated in the same release.

- **Renamed tools:** `action_types_list` → `action_type_list`, `form_revisions_list` → `form_revision_list`, `hello` → `server_status` (server name and version plus the `cwd`'s project resolution; no Form.io request). The old names are not registered.
- **Publish and revert are their own tools:** `form_publish` (`formId`, `note`) and `form_revert` (`formId`, `version`, `note`). `form_update` no longer takes `publish`, `revert` or `version`; its `draft: true` mode saves the draft fields of the body it is given and ignores the rest, so `form_get`'s output can be passed back.
- **Form addressing:** `formId` is always a 24-character ObjectId (every action tool, `form_update`, `form_publish`, `form_revert`); `formIdOrPath` accepts either and is taken by `form_get`, `form_revision_list` and `form_revision_get`.
- **`role_create`** takes a nested `role` object, like `role_update`.
- **One list contract:** `form_list`, `role_list`, `action_list` and `form_revision_list` take `limit` (default 100), `skip`, `sort` and `select`, and return `total` and `hasMore` read from Form.io's `Content-Range`; `count` is removed. Lists no longer stop at Form.io's default of 10. `form_list`'s `tags` matches forms carrying all of them; `form_revision_list` is newest first with compact fields; `action_type_list` returns the whole catalog.
- **No consent prompts:** a write that would save without revision history (an unlicensed deployment, a form with revisions off, or an explicit `revisions: ""`) needs `acceptNoHistory: true`, otherwise it is refused with `HISTORY_NOT_ACCEPTED` for the agent to ask the user. The elicitation and local browser consent pages, and `~/.formio/revisions-license-consent.json`, are removed.
- **Errors:** every tool error's text starts with a `[CODE]` from a fixed set, and the result carries `{ code, status?, body? }` in `_meta["io.form/error"]`, including Form.io's response body. Existing message text is unchanged after the prefix.
- **Output schemas are open:** a valid Form.io response with fields a schema does not list (`_vid`, `pdfComponents`, `controller`, `esign`, `null` settings) is no longer rejected by clients that validate output.
- **Smaller surface text:** `tools/list` is about 48.6k characters (from 68.5k), under a tested 50,000 budget; the full project-resolution rules stay in the server instructions.
- `FORMIO_INSECURE_TLS` and `FORMIO_FORCE_BROWSER` both accept `true` or `1`, case-insensitive. `@formio/mcp` exports only `./package.json`: the package is its `formio-mcp` binary. The `project get` / `project set` flags and exit codes (0, 1, 2, 3) are documented as the 1.0 CLI reference, unchanged.
