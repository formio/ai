---
'@formio/mcp': minor
'@formio/ai': minor
---

Add five `submission_*` MCP tools that let the agent seed the Resource a `select` reads and write test submissions. Each tool reaches only submissions this server created and signed for the calling working directory.

**`@formio/mcp`** adds `submission_create`, `submission_list`, `submission_get`, `submission_update`, and `submission_delete`.

- **The tag.** Every submission the agent writes carries a server-written `metadata.agent` tag (`source`, `session`, `purpose`, `nonce`, `sig`). The signature is an HMAC-SHA256 over the project, form, owner, tag fields, and the full stored `data`. The server gets that data from a `?dryrun=1` pass, which validates and normalizes without running actions or saving. The key is 32 random bytes per working directory, kept in `~/.formio/mcp-submission-keys.json` with mode `0600`. It never appears in a tool result or error.
- **Reads.** Every read forces the tag filters and builds its query from structured `data.*` filters. Agent parameters are never forwarded, because Form.io copies unrecognized query parameters straight into its Mongo filter. Each returned record's signature is re-verified, and a record that fails is dropped before the agent sees it. A get by id answers a 404 and a record the agent did not create the same way: not found, with none of its content.
- **Writes.** Update and delete verify the target first. Update keeps the record's identity, re-signs over the dry-run-normalized data, and refuses caller-supplied `metadata`. Every write result names the form actions it ran.
- **Server instructions.** They now state the scope, the ban on reaching any other submission by another route, and the `action_list` check before a write.
- **API errors.** `FormioApiError` now carries the HTTP `status` and the response `body`, so a dry-run 400 can report Form.io's validation messages.

**`@formio/ai`** adds one canonical guideline, `formio-mcp-setup/references/agent-submissions.md`, covering when the agent writes a submission:

- the two purposes, `reference-data` and `test`;
- no reference rows in user-type Resources or in forms with a Login, Role Assignment, or Group Assignment action;
- invented values on a reserved domain;
- `action_list`, a preview, and approval before every write, with a warning for a live project;
- test-row cleanup.

The skills now use it:

- `formio-form-builder` offers to seed an empty dropdown source and to write a test submission after SAVE.
- `formio-application` gains Step 3.6, which offers the reference rows the planner marks with a new `Seed: reference-data` line.
- `formio-actions` documents testing an action with a test submission.

The earlier wording that said no submission tool exists, that no tool returns submission data, and that only an administrator in the portal seeds reference data now names the scoped tools. The ban on reading an end user's submission by any route stays.
