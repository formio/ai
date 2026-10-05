## Why

The skills.sh remediation (PRs for `mitigate-skills-sh-security-findings` and #80) closed the scanners' third-party-content findings by stating that the agent never touches submission data, and the toolset backs that with the absence of any submission tool. That over-corrects: building a form whose `select` reads a Resource (`dataSrc: resource`) needs rows in that Resource before the dropdown shows anything, and verifying a form's validation, conditionals, calculated values, and actions needs a test submission. Today both are pushed to "an administrator signs in to the portal", which stops an otherwise complete build. The agent needs to write and read back its own submissions, while every submission an end user or another agent wrote stays out of reach — enforced by the MCP server, not by prose asking the agent to behave, because an enforced boundary is what the scanners have rated as mitigated and a prose-only one is what they flag.

## What Changes

- **New MCP tools `submission_create`, `submission_get`, `submission_list`, `submission_update`, `submission_delete`.** Every one is scoped by the server to submissions this server created for the calling working directory; there is no parameter that widens the scope.
- **Every agent-created submission carries a server-written tag** in `metadata`: `source: 'agent'`, an `agentSession` label derived from the working directory, and an `agentSig` HMAC that binds the tag to the submission's project, form, owner, and full stored `data`, using a signing key held only on the machine running the server and generated per working directory. `metadata` is writable by anyone who submits, so the label alone is a claim; the signature is the proof.
- **Reads return only verified records.** `submission_list` and `submission_get` force the tag filter onto every query, discard any `metadata.*` filter the agent supplies, and re-verify the signature of every returned record, dropping any that fail before the result reaches the agent. A record that fails verification is reported as not found, with none of its content.
- **Writes act only on verified records.** `submission_update` and `submission_delete` verify the target first and refuse otherwise; `submission_update` refuses any change to the tag fields.
- **`submission_create` requires a `purpose`** — `reference-data` or `test` — recorded in the tag so test rows can be found and removed as a set.
- **One canonical guideline** at `plugin/skills/formio-mcp-setup/references/agent-submissions.md` states when the agent may create, update, read, and delete submissions: only its own; only invented values; `action_list` checked before every create, because email, webhook, login, and role actions have real-world effects; a preview and approval before every write; an explicit warning for test data in a live project; and cleanup of test rows. Skills that seed or test link to it rather than restate it.
- **The over-corrected prose is revised** to the enforced boundary — "the submission tools return only submissions this server created and signed": `formio-actions/SKILL.md`'s "no submission tool" paragraph, the last rule of `formio-sdk`'s Security section, `formio-application` Step 1's "reads no submission data", and the planner references that assign reference-data seeding to an administrator in the portal. The ban on reading submissions by any other route (HTTP, scripts, SDK) stays.
- **Skills gain the seeding and testing step where it belongs:** `formio-form-builder` (seed a Resource a select reads; submit a test row), `formio-application` (optional reference-data seeding after import), and `formio-actions` (exercise an action with a test submission after reviewing its effects).

## Capabilities

### New Capabilities

- `submission-crud`: the five `submission_*` MCP tools — registration, inputs, the Form.io endpoints each calls, annotations, output shapes, and error behavior.
- `agent-submission-scope`: the server-enforced boundary — the metadata tag, the per-working-directory session label, the signing key and its storage, forced query filters, signature verification on every read and before every write, and immutability of the tag fields.

### Modified Capabilities

- `formio-mcp-setup-skill`: gains the canonical `references/agent-submissions.md` guideline.
- `formio-actions-skill`: replaces "the toolset cannot reach a submission" with the scoped-tools boundary and the test-an-action flow.
- `formio-sdk-skill`: the Security section's build-time rule names the scoped submission tools instead of stating that no tool returns submission data.
- `formio-application-skill`: Step 1's first-party-inputs statement names the agent's own submissions, and an optional reference-data seeding step follows import.
- `formio-resource-planner-skill`: reference-data seeding is no longer an administrator-only portal task; the planner notes which Resources need seed rows for their selects.
- `formio-form-builder-skill`: gains seed-and-test steps that follow the guideline.

## Impact

- **Server code:** new `packages/mcp-server/src/tools/submission_*.ts`, a new scope module (tagging, signing, verification, query shaping), a signing-key store under `~/.formio/` following `token-cache.ts`'s pattern, registration in `tools/index.ts`, and the `.mcpb` manifest tool list. Tests in `packages/mcp-server/src/__tests__/`, including that a record failing verification never reaches the tool result.
- **Skill docs:** the files listed above, plus `formio-api/references/runtime-submissions.md`'s MCP Tool Preference section, which names the scoped tools for the build-time cases and keeps runtime CRUD as application code.
- **Skill tests:** `formio-sdk/security-section.test.ts` and `skill-descriptions/application-orchestration.test.ts` assertions written for #80 ("none returns submission data", "reads no submission data") change to the scoped wording; `build-time-vs-runtime.test.ts` keeps its ban on build-time HTTP and gains an allowance for the named tools.
- **Server instructions** (the MCP server's `instructions` text) state the scope rule once, so a client without the skills still gets it.
- **Scanner exposure:** the stated boundary is a true description of enforced behavior. The scanners are model-based, so re-scan outcomes are recorded after release rather than assumed.
- **No breaking change** to existing tools. No new runtime dependency; HMAC uses `node:crypto`.
