---
'@formio/mcp': patch
---

**`action_delete` no longer fails after succeeding.** The Form.io API answers `DELETE /form/{formId}/action/{actionId}` with the plain text body `OK`, and `formioRawFetch` calls `res.json()` unless the caller opts into `responseType: 'text'`. `action_delete` did not, so every delete threw `Unexpected token 'O', "OK" is not valid JSON` — after the action had already been removed. The tool now reads the response as text, the way `project_import` already does for the same reason.

The tool's own tests could not catch this: they mock `formio-client.js`, which is the module that parses the response, so they asserted against a JSON body no deployment sends. A new test drives the real `formioFetch` with `fetch` stubbed to return the text body the API actually returns, and covers the refusal path too, where the status is reported instead of a parse error.
