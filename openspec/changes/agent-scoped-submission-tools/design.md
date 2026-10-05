## Context

The MCP server has 23 tools and none reaches a submission. The skills describe that absence as the build-time boundary (`formio-actions/SKILL.md` "Build time vs runtime", `formio-sdk` Security, `formio-application` Step 1), and the skills.sh scanners rated that boundary as mitigated. What it costs: a form whose `select` reads a Resource shows an empty dropdown until someone adds rows, and nothing in the toolset can check a form's behavior with a real submission. Both are handed to "an administrator in the portal".

The agent authenticates as the developer's portal account, so a submission's `owner` does not separate the agent's rows from rows that developer typed in by hand. An earlier draft of this change kept a local ledger of created ids. It was dropped in favor of a tag on the submission itself, which the portal can show, which survives across sessions, and which needs no id list kept in sync.

Findings from the Form.io server source (`formio/src`, `resourcejs`, `formio-server/src/hooks`) that constrain the design:

- **`metadata` is kept as sent on `POST`** (`submissionHandler.js:92` picks `data`, `owner`, `access`, `metadata`) and **can be written by anyone with create permission, anonymous users included**. A tag is therefore a claim, not a proof.
- **The index filters on `metadata.*`**. `metadata` is a Mixed schema path, and `resourcejs` checks only the key's root (`Resource.js:437`). Operators come from `__` suffixes. Values are strings except `true`/`false`/`null` under `__eq`/`__ne`.
- **Query params pass into the Mongo filter with no sanitizing.** Keys not in the schema are copied raw (`Resource.js:492`), and Express's extended `qs` parser turns `a[$ne]=x` into objects. A tool that forwarded agent-supplied params could have its query widened.
- **`PATCH` is an `update`.** It fires update-method actions and re-validates the whole submission (`submissionHandler.js:25-27`, `SubmissionResource.js:137`, `submissionApplyPatch.js`).
- **`PUT` replaces `metadata` wholesale** (Mixed path, `item.set`).
- **`?dryrun=1` validates and returns the normalized submission without running actions or saving** (`submissionHandler.js:89,150,218,373`). It is available to any caller.
- **Server code also writes some `metadata` keys:** `jwtIssuedAfter`, a webhook action's `metadata[action.title]`, and enterprise revisions' `previousData`/`jsonPatch`. The tag lives under one key, `metadata.agent`, so none of these touch it.

## Goals / Non-Goals

**Goals:**

- The agent can create reference-data and test submissions and read, update, and delete its own, from the same working directory, across sessions.
- No submission the agent did not create reaches a tool result. That includes a forged tag, a copied tag, and a query the agent tries to widen, and it is enforced in server code.
- The skills can describe the boundary as it is, "returns only submissions this server created and signed", and that sentence is true.
- Writes have no side effect beyond the one real write the user approved.

**Non-Goals:**

- Reading end-user submissions for any reason: support, debugging, reporting, or migration. That remains application code or portal work.
- Sharing agent rows between machines or teammates. The key is per directory on one machine.
- Bulk import. One row per `submission_create` call keeps every write previewable.
- Hiding agent rows from the portal. They are ordinary submissions, visibly tagged.

## Decisions

### D1. Tag under `metadata.agent`, signed, not a bare label

`metadata.agent = { source, session, purpose, sig }`. `sig = HMAC-SHA256(key, canonical({ projectUrl, formId, owner, session, purpose, data }))`.

- **Why signed:** anyone who submits can write `metadata`, and the rows a dropdown reads are readable by end users, so both a constant `source: agent` and a secret session label leak and can be copied.
- **Why the whole `data` is covered:** a copied tag verifies only on a record whose data is byte-identical to the agent's own, so outsider-authored content can never verify.
- **Why `owner` is covered:** a non-admin cannot set `owner` to the developer's account (to confirm in task 1.2), so even an exact replica must come from someone who already administers the project.
- **Alternative rejected: sign `_id` after create.** Binding to the server-assigned `_id` needs a second write, and a `PATCH` or `PUT` fires update-method actions: a second email or webhook the user did not approve.
- **Alternative rejected: an id ledger.** It is invisible in the portal, lost on another machine, and has to stay in sync with deletions made in the portal.

- **Why only four fields.** `sig` is the proof, and `source` lets both the index query and a person in the portal pick out agent rows. `session` and `purpose` are not proof — the per-directory key already isolates directories, and the signature already covers both — but each does a job the signature cannot, because Mongo cannot verify an HMAC and can only filter on plain values. `session` confines the index query to this directory's rows, so other directories' agent rows never fill a page and push this directory's own rows past the `limit`. `purpose` is what `submission_list` with `purpose: "test"` filters on, so a later session can find and delete its test rows. An earlier draft also carried a random `nonce`. It was dropped: with the full `data` and `owner` signed, it added no protection, and two identical seed rows sharing a signature is harmless.

### D2. Dry-run first, then sign what the server will store

The signature has to cover the stored `data`, but the server fills defaults, computes calculated values, and strips unknown keys. `?dryrun=1` returns exactly that normalized submission without running actions or saving. The tool signs the dry-run `data`, sends it as the real body, and verifies the real response.

- **Cost:** one extra request per write.
- **Failure mode:** a server-side value that changes between two evaluations (a calculated "now") makes the stored record fail verification. The tool fails closed: it reports the differing field names and the `_id`, returns none of their values, and tells the user to remove the row in the portal. `submission_delete` makes no exception for it, since an exception keyed on anything weaker than the signature is one a copied tag could meet.
- **Alternative rejected: signing only the agent-supplied keys.** Stored values of unsigned keys could then be outsider-written, and returning them would break the boundary.

### D3. One key per working directory; the session label is derived from it

The key store lives at `~/.formio/mcp-submission-keys.json` as `{ [normalizedCwd]: base64Key }`, mode `0600`, using the same read-modify-write helpers as `token-cache.ts`. The cwd is normalized the way `project-map.ts` normalizes it. `session = HMAC(key, "agent-session")` truncated to 32 hex characters.

- **Isolation is cryptographic:** another directory's agent cannot verify these rows even with the label.
- **The label is not a secret.** It exists so the index query is narrow. It is derived rather than being a path hash, so it does not reveal the directory name.
- **Alternative rejected: one key per server process.** The user chose per-directory scope so test rows can be cleaned up in a later session.

### D4. The server builds every query; agent input is structured, never forwarded

`submission_list` takes `filters` as `Record<string, string>` whose keys match `^data\.[A-Za-z0-9_.]+(__(eq|ne|gt|gte|lt|lte|in|nin|exists|regex))?$`. Values must be strings with no `[`, `]`, or `$`. The tool assembles `URLSearchParams` itself, appends the forced `metadata.agent.source` / `metadata.agent.session` (and `metadata.agent.purpose` when given), and sets `select=_id,form,owner,data,metadata,created,modified`.

- Anything outside that grammar is refused before any request.
- This closes the raw-param widening the source review found, whatever the server's parser does.

### D5. Verify per record; a failed or missing record looks the same

`verifyRecord(record, ctx)` is a pure function. It returns the projected record, or `null` when any of these fail: the tag is missing, `source` or `session` differ, `form` differs, or the HMAC check fails. The check uses `timingSafeEqual`.

- List results drop the nulls and report a `dropped` count.
- A get by id returns the same not-found result whether Form.io said 404 or verification failed. The agent learns nothing about a record it does not own, not even that it exists.

### D6. Update and delete verify first; update keeps identity and re-signs

- **Update:** `GET` and verify, dry-run the `PUT` body, sign keeping the original `session` and `purpose`, then `PUT` the full tag, because a `PUT` replaces `metadata` wholesale.
- **Delete:** `GET` and verify, then `DELETE`.
- **Effects are named:** each write result lists the form's actions matching its method, so the user sees what the write triggered. The skill guideline requires naming them before the write as well.

### D7. Pure core, I/O at the edges

- `agent-scope.ts` holds the pure functions: `canonicalize`, `signTag`, `verifyRecord`, `buildListQuery`, `projectRecord`.
- `submission-keys.ts` holds the key store's I/O.
- Each `submission_*.ts` tool wires them to `formioFetch`.

This follows the repo's functional-core convention and keeps the security logic testable with no network.

### D8. Guideline lives in `formio-mcp-setup/references/agent-submissions.md`

- It sits beside `project-urls.md`, the library's other server-owned guidance, which every skill links to rather than restating.
- The server's `instructions` carry the short form for clients without the skills.
- The ban on reaching other submissions by HTTP, scripts, or pasted content stays in each skill's existing "Never work around missing tools" text.

## Risks / Trade-offs

- **[A project admin copies an agent row exactly, including `owner`]** → They see and control the project already. The copy has byte-identical data, so no outsider content verifies. Accepted.
- **[API-key auth leaves `owner` unset]** → The signature covers `owner: null`, so copying needs create access plus identical data. The copy still carries no outsider content. Accepted.
- **[A calculated value that isn't deterministic makes seeds unreadable]** → The tool detects this at create time, says so, and names the `_id` so the user can remove the row in the portal. The guideline tells the agent to prefer forms without server-side "now" values for test rows.
- **[`dryrun` behaves differently on some deployment or version]** → Task 1.1 confirms it against a live deployment. If it is missing, create fails closed rather than falling back to an unsigned write.
- **[The real write fires create actions]** → That is inherent to submitting. The guideline's `action_list` check, the named effects in the approval preview, and the action names in the tool result cover it.
- **[`__regex` filters allow expensive patterns]** → Patterns are limited to 200 characters. The query is already confined to the agent's own rows by the forced filters.
- **[The scanners flag the new tools anyway]** → The skills describe enforced behavior, and a test asserts that a forged record never reaches a result. Re-scan outcomes are recorded after release, not assumed.
- **[Key file loss]** → Rows the agent made become unreadable to it (fail closed) but stay visible and deletable in the portal. The guideline notes this.

## Migration Plan

- The change is additive: no existing tool changes behavior.
- The skill prose revisions ship with the tools in one release, so no published skill describes tools that do not exist, or says tools are missing when they exist.
- Rollback: revert the release. Tagged rows remain ordinary submissions and can be deleted in the portal by filtering on `metadata.agent.source=agent`.

## Open Questions

- **Q1 (task 1.1) — resolved 2026-09-29.** Against Form.io Enterprise 9.9.2 (`https://form.test/sandbox`), `live-submission-behavior.test.ts` confirmed that a `?dryrun=1` `POST` returns the default-filled and server-calculated `data` with no record saved and no action run; the real write stores exactly the dry-run `data`, with the same `owner`; and a `?dryrun=1` `PUT` returns the recomputed data while leaving the stored record and the update actions untouched. D2 stands. The hosted cloud was not exercised; it runs the same server code, and the create-time check fails closed if a deployment ever differs.
- **Q2 (task 1.2) — resolved 2026-09-29.** On the same deployment, `metadata.agent` is stored verbatim, and a non-admin `POST` that sets `owner` to the admin's id is stored with the caller as `owner`. Covering `owner` in the signature therefore adds protection: an exact replica of an agent row has to come from someone who already administers the project.
- **Q3:** Should `submission_list` allow `sort` on `metadata.agent.purpose`? The current answer is no: filter by `purpose` instead.
