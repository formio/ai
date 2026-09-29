## ADDED Requirements

### Requirement: Each working directory has its own signing key and session label

The server SHALL keep one signing key per resolved working directory in a local key store under `~/.formio/`, written with file mode `0600` and following the read-modify-write pattern of the token cache. The key SHALL be 32 random bytes from `node:crypto`, created on the first submission tool call from that directory. The session label SHALL be derived from the key (`HMAC(key, "agent-session")`, hex, truncated to 32 characters) so it names the directory without revealing the key or the path. Neither the key nor the key-store path SHALL appear in any tool result, error message, or log line.

#### Scenario: First call creates the key

- **WHEN** `submission_create` is called with a `cwd` that has no key in the store
- **THEN** the server generates a 32-byte key, writes it to the store with mode `0600`, and derives the session label from it

#### Scenario: Two directories are isolated

- **WHEN** directory A creates a submission and directory B calls `submission_get` for its `_id` against the same project
- **THEN** B's verification fails because B's key produces a different signature, and B receives the not-found result

#### Scenario: The key never leaves the server

- **WHEN** any submission tool returns a result or an error
- **THEN** the result contains neither the key bytes nor the key-store path

### Requirement: Agent-created submissions carry a server-written, signed tag

Every submission written by `submission_create` or `submission_update` SHALL carry `metadata.agent` containing `source: "agent"`, `session` (the session label), `purpose` (`"reference-data"` or `"test"`), `nonce` (16 random bytes, hex), and `sig`. `sig` SHALL be `HMAC-SHA256(key, canonical({ projectUrl, formId, owner, session, purpose, nonce, data }))`, where `canonical` is key-sorted JSON and `data` is the submission data as the server will store it. The agent SHALL NOT be able to supply any part of `metadata`; any `metadata` in the tool input is rejected.

#### Scenario: The tag is written by the server

- **WHEN** `submission_create` is called with `data` and `purpose: "test"`
- **THEN** the request body's `metadata.agent` holds `source`, `session`, `purpose`, `nonce`, and `sig`, all computed by the server

#### Scenario: Agent-supplied metadata is refused

- **WHEN** `submission_create` or `submission_update` is called with a `metadata` field in its input
- **THEN** the tool returns `isError: true` without making any request

### Requirement: The signature covers the data as stored, obtained without running actions

Before the real write, the server SHALL submit the same body with `?dryrun=1`, which validates and normalizes the data (defaults, calculated values, stripped unknown keys) without executing actions or saving. It SHALL sign the `data` the dry run returns, then send the real write with that data and the tag. After the real write, it SHALL verify the response. When the stored data does not verify — a server-side value that differs between two evaluations — the tool SHALL report which fields differed, report the `_id`, and state that the record is not reachable by the submission tools and is removed in the Form.io portal. No submission tool makes an exception for such a record: an exception keyed on anything but a valid signature would let a copied tag direct a write at a record the agent did not create.

#### Scenario: Normalized data is what gets signed

- **WHEN** a form fills a default value for a field the agent omitted
- **THEN** the dry run returns the default, the signature covers it, and a later `submission_get` verifies the record

#### Scenario: The dry run fires no action

- **WHEN** `submission_create` runs against a form with an email action on `create`
- **THEN** the dry-run request carries `dryrun=1`, and only the real write can trigger the action

#### Scenario: Non-deterministic stored data fails closed

- **WHEN** the stored data differs from the dry-run data
- **THEN** the tool reports the differing field names and the `_id`, and returns none of the differing values

### Requirement: Every read is filtered by the server and verified per record

`submission_list` SHALL build its query string itself from structured inputs. It SHALL always include `metadata.agent.source=agent` and `metadata.agent.session=<label>`, and SHALL always request `_id`, `form`, `owner`, `data`, and `metadata`. It SHALL reject any filter key that does not start with `data.`, any key or value containing `$`, `[`, or `]`, and any operator suffix outside `__eq`, `__ne`, `__gt`, `__gte`, `__lt`, `__lte`, `__in`, `__nin`, `__exists`, and `__regex`. Every returned record SHALL be verified — tag present, `session` equal to the label, `form` equal to the requested form, and `sig` valid — and records that fail SHALL be dropped before the result is built. `submission_get` SHALL verify the same way and return a not-found result, with no field of the record, when verification fails.

#### Scenario: A forged tag is dropped

- **WHEN** an end user submits `metadata.agent` copied from an agent record but with different `data`
- **THEN** the list query returns it, verification fails, and the tool result does not include it

#### Scenario: A metadata filter from the agent is refused

- **WHEN** `submission_list` is called with a filter key `metadata.agent.session`
- **THEN** the tool returns `isError: true` without making any request

#### Scenario: Query operators cannot be smuggled in

- **WHEN** `submission_list` is called with a filter key `data.x[$ne]` or `$or`
- **THEN** the tool returns `isError: true` without making any request

#### Scenario: A human-created submission is not returned by id

- **WHEN** `submission_get` is called with the `_id` of a submission entered in the portal
- **THEN** the tool returns a not-found result and no field of that submission

### Requirement: Writes act only on verified records and never change the tag's identity

`submission_update` and `submission_delete` SHALL fetch and verify the target before any write, and refuse with a not-found result when verification fails. `submission_update` SHALL keep the original `session`, `purpose`, and `nonce`, SHALL re-sign over the dry-run-normalized new `data`, and SHALL send the full tag, because a `PUT` replaces `metadata` wholesale.

#### Scenario: Updating a record the agent did not create is refused

- **WHEN** `submission_update` targets an unverified `_id`
- **THEN** no `PUT` is sent and the tool returns the not-found result

#### Scenario: Purpose survives an update

- **WHEN** a `purpose: "test"` record is updated
- **THEN** the stored tag still says `purpose: "test"` and verifies

### Requirement: Tool results expose only the agent's own fields

Tool results SHALL contain `_id`, `form`, `created`, `modified`, `data`, and `purpose` for each verified record, and SHALL NOT contain `sig`, `nonce`, `owner`, `access`, or any other `metadata` key.

#### Scenario: The signature is not echoed

- **WHEN** `submission_get` returns a verified record
- **THEN** the result has `purpose` and `data`, and no `sig` or `nonce`
