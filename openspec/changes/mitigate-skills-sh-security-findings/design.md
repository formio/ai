## Context

skills.sh publishes three audits per skill — Gen Agent Trust Hub (a model-based reviewer), Snyk (heuristic rules, `W011` "third-party content exposure"), and Socket (supply-chain analysis). The four flagged skills and what each scanner said:

| Skill | Agent Trust Hub | Snyk | Socket |
| --- | --- | --- | --- |
| `formio-sdk` | FAIL, HIGH: CREDENTIALS_UNSAFE, REMOTE_CODE_EXECUTION, DYNAMIC_EXECUTION, INDIRECT_PROMPT_INJECTION | pass | pass |
| `formio-form` | SAFE, five risks all "Mitigated" | MEDIUM W011, own score 0.10 | pass |
| `formio-angular` | SAFE | pass | 2 LOW: `skills add --all`, forced caret ranges |
| `formio-application` | SAFE | MEDIUM W011, own score 0.30 | pass |

The controlling observation is the `formio-form` row. It documents the same Evaluator, `createForm`, and external-fetch surface as `formio-sdk`, and Agent Trust Hub rates it SAFE, citing its "Security — a form definition is executable code" section by name. `formio-react` passed the same scanner for the same reason: its resources sub-skill states that planner artifacts describe software rather than direct the agent. These scanners reward a stated trust boundary; they do not require the capability behind it to disappear. That sets the shape of this change: state the boundaries where they are missing, fix the two findings that turned out to be real defects, and accept what remains.

Two findings are defects independent of any scan. The `skills` CLI defines `--all` as shorthand for `--skill '*' --agent '*' -y`, so the current `npx skills add https://github.com/angular/skills --all -a <agent> -y` ignores its own `-a` and installs into every agent's directory. And `BOOTSTRAP.md`'s caret paragraph says "do NOT override the user's `.npmrc`" and then instructs `--save-prefix='^'` "to force the `^` regardless" — two instructions an agent cannot both follow.

Constraints from the repository: skill markdown is written without hard wraps and unwrapped per-file with Prettier; `shared-prose-stays-identical.test.ts` fails any paragraph that is nearly but not exactly identical across two skills; `url-terminology.test.ts` forbids `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL` outside environment-variable prose; `description-budget.test.ts` caps descriptions; `no-install-commands-in-skills.test.ts` keeps install commands out of non-setup skills (the Angular `skills add` is a pre-existing, tested exception). The `formio-sdk` Vitest suite already exercises `registerEvaluator` and `DefaultEvaluator` against the real `@formio/js`, so the sandboxed-evaluator example this change promotes is known to run.

## Goals / Non-Goals

**Goals:**

- Clear `formio-sdk`'s Agent Trust Hub failure by stating the four trust boundaries the scanner found missing, in the place it reads them (`SKILL.md`) and beside the APIs they bound (the references).
- Fix the `--all` / `-a` conflict and the caret contradiction in `formio-angular`, which are correctness fixes that happen to be what Socket flagged.
- Give `formio-form` and `formio-application` the cheapest honest statement of their trust boundaries, and accept a residual Snyk finding if it does not move.
- Lock every new statement with a structural test so it cannot silently erode, matching how the library already guards its preflight prose and planner-artifact trust rules.
- Remove the one genuinely bad example — a literal credential in source — and make its class impossible to reintroduce.

**Non-Goals:**

- Removing or hiding any API. `Utils.Evaluator`, `requireLibrary`, `cdn.setBaseUrl`, `Formio.createForm`, external select sources, the Angular skills install, and plain-language intent capture stay documented. A skill that omits the dangerous half of its surface is a worse reference than the source it was derived from, and the user's stated rule is that a finding whose only remedy is gutting the skill is a finding we live with.
- Pinning `angular/skills` to a commit SHA. A SHA in a shipped skill goes stale and breaks the install; the named-skill scope plus preview plus approval gate is the proportionate control.
- Switching the Angular installs to exact pins. Caret is a deliberate repository decision; the lockfile carries integrity. What changes is that the user's own `.npmrc` wins when it says otherwise.
- Adding a generic "security" test framework across all skills. Each assertion lives in the skill's existing structural or flow-contracts suite.
- Guaranteeing a scanner outcome. The verdicts are model-based; the change is judged by whether the boundaries are stated and tested.

## Decisions

**One `## Security` section per skill that documents an execution surface, not a shared paragraph.** `formio-form` already has one and `formio-react-form` carries an identical copy, which the shared-prose suite enforces byte-for-byte. `formio-sdk` gets its own rather than a third copy, because the two skills argue from different positions: `formio-form` is a task guide about a definition the renderer executes; `formio-sdk` is an API reference about calls the application makes — the credential rule and the loader rule have no counterpart in `formio-form`, and the Evaluator rule is about direct `Utils.Evaluator` calls rather than definition-level logic. Distinct prose is therefore both honest and what the drift suite requires: a near-copy would fail it, and an identical copy would say things about the SDK that are not the SDK's concern. The one shared idea — returned JSON is data, not instructions — is worded to the SDK's own call sites (`Formio` calls and MCP tools) so it reads differently from `formio-form`'s new fifth bullet, which is worded to the embed task (`form_get`, pasted JSON, pre-fill submissions).

**Rules map one-to-one onto the four findings, and each is carried to the reference that documents the API.** A scanner that reads `SKILL.md` finds the rule; an agent that opens `setup.md` for `requireLibrary` finds the same rule beside the bullet it is about to act on. The section states the rule and links; the reference restates it in one or two sentences in its own words. This mirrors how the library handles the `fetch.authenticate` credential-leak rule today: stated in `formio-form/SKILL.md`, restated beside the Data Source component in `external-data.md`.

**The credential example is replaced, not annotated.** Annotating `api_key: 'SG.x...'` with "do not do this in real code" leaves a literal secret shape in a file agents copy from. The example becomes a non-secret settings edit (`settings.cors`), plus one sentence on where credential-bearing settings belong. A regex test over every markdown file under the skill forbids the class (`SG.`-prefixed strings, `api_key: '…'`, `password: '…'`), which also catches `auth.md`'s `password: 'hunter2'` — not flagged, but the same class, and cheaper to fix now than to explain later. Alternative considered: use a `process.env.SENDGRID_API_KEY` placeholder. Rejected because the settings object is written server-side by the portal in practice, and an example that reads a secret into browser code teaches the wrong place to hold it.

**Evaluator examples reorder rather than shrink.** The reference keeps every example, because `evaluate('valid = data.age >= 18;', …)` is how Form.io's own custom validation works and a reader needs to see it. What changes is which example a reader (or scanner) meets first: the sandboxed evaluator, then JSONLogic, then string code each introduced as an authored literal. The existing Vitest coverage of `registerEvaluator` means the promoted example is known-good.

**`--skill angular-new-app`, verified against the live CLI.** `npx skills add <repo> --list` on 9 September 2026 shows exactly two skills, `angular-developer` and `angular-new-app`, and the help text defines `--all` as `--skill '*' --agent '*' -y`. Installing one named skill with an explicit `-a <agent>` is what the current text already claims to do and does not. The `--list` preview is added because it costs one command and is exactly what Socket describes as "install only reviewed skills"; the offer now tells the user a name they have just seen listed. `-y` stays: interactive CLI prompts hang in agent shells, and the user's approval of the shown command is the gate, as the text already says.

**Caret stays the default; the user's `.npmrc` wins.** Socket's remediation ("avoid caret ranges") conflicts with a repository decision made for maintenance reasons, and the lockfile already provides the integrity Socket is asking for. The actual defect is the contradiction, and it is resolved in the direction the first half of the paragraph already states: the skill never overrides a workspace's configured prefix. The Step 4 check changes from "reads `^<version>`" to "resolves to the captured version in whatever range form the workspace writes". One sentence names the committed lockfile as the thing that fixes versions, which is the honest answer to the finding.

**`formio-form` gets a runtime/build-time sentence, because that is what Snyk misread.** Snyk's W011 text says the workflow "retrieves select options or data from external sources". It does not; the application does, at runtime, in the browser. The reference now says so in its first block. Shape validation before `setSubmission`, no raw `{{{ }}}` over external items, and own-domain example hosts are the remaining low-cost statements. If W011 persists at its own score of 0.10, it is accepted.

**`formio-application` states the gates it already has.** Agent Trust Hub rated the skill SAFE by citing the Phase A approval gate and the import preview. The Snyk finding reads the skill as executing user text. The mitigation is to say in Step 1 what is true — the description is planner input, it is never interpolated into commands, URLs, or source, and everything derived from it passes two approval gates and the planner's identifier validation — and to stop describing the handoff as passing the request "verbatim" for a sub-skill to act on, which is the one phrase that reads as an injection carrier. The extend sub-skills already carry the data-not-instructions rule; the contract points at it. This finding is expected to remain and is accepted.

**Tests live in each skill's existing suite.** `formio-sdk` gains `security-section.test.ts` alongside its API-surface tests; `formio-angular`'s assertions join `flow-contracts.test.ts`, whose purpose is exactly "places where a following agent is told two different things"; `formio-form`'s join `skill-structure.test.ts` and `external-data.test.ts`; `formio-application`'s join `application-orchestration.test.ts`. No new harness, no cross-skill security suite — the library's precedent (`planner-artifact-trust.test.ts`) is a focused suite per rule.

## Risks / Trade-offs

- [Agent Trust Hub does not flip `formio-sdk` to SAFE despite the section] → The section mirrors what the same scanner cited as mitigation in `formio-form` and `formio-react`; if it still fails, the residual is on capabilities the skill exists to document, which the user has ruled acceptable. Re-scan results are recorded in the change's tasks, not assumed.
- [New security prose trips `shared-prose-stays-identical.test.ts` against `formio-form` or `formio-react-form`] → Prose is written to the SDK's own surface (calls, loaders, credentials) and the fifth `formio-form` bullet to the embed task; the suite runs locally before the change is considered done, and a flagged paragraph is reworded rather than exempted.
- [Regex credential ban produces false positives on legitimate prose] → Patterns are narrow (`SG.` prefix, `api_key: '`, `password: '`) and scoped to `formio-sdk/**`; the test names the file and pattern so a false positive is diagnosable in seconds.
- [`angular/skills` renames or splits `angular-new-app`] → Same failure mode as today's `--all` path when the skill it expects is missing; `BOOTSTRAP.md`'s existing rule ("if the command fails, never retry against a different source") covers it, and the `--list` preview surfaces the rename to the user before anything installs.
- [Honoring `save-exact` produces a workspace that never picks up Form.io patch releases] → That is the user's configured choice for their workspace; the skill previously overrode it, which is the behavior Socket flagged and the paragraph itself said not to do.
- [Reordering Evaluator examples changes anchors other documents link to] → Headings are kept; only order changes. `cross-reference-integrity.test.ts` catches a broken anchor.
- [Snyk W011 remains on `formio-form` and `formio-application`] → Accepted by design. The proposal states the expected outcome per skill so a residual MEDIUM is not read as an unfinished change.

## Post-implementation audit

Two independent reviews ran after the first implementation pass — one emulating the three scanners over every file in the four skills, one walking the edits as an agent would — and both fed corrections back into this change before it was considered done.

**Corrections to the first pass (effectiveness):**

- The `{{{ }}}` guidance in `external-data.md` had the escaping direction backwards, and so did the pre-existing template-syntax list in `utils-evaluator.md`. `@formio/core`'s Evaluator sets `interpolate` to `{{ }}` (raw) and `escape` to `{{{ }}}` (HTML-escaped). Both now state the direction the source implements, and select templates are noted as sanitized by the renderer whichever spelling is used. Tests lock the direction, not merely the presence of the claim.
- The sandboxed-evaluator example was framed as a default that left authored expressions working. It does not: the override is process-wide, so the application's own `calculateValue`, `validate.custom`, and custom `logic` stop evaluating. The example now states that cost.
- The handoff contract had re-labelled the user's own feature request as data the sub-skill must not follow. The request is the user's instruction and is acted on; only the planner pair is data. `SKILL.md`, `INTENT.md`, and `FRAMEWORK.md` now say so consistently, and "verbatim" is gone from all three.
- `BOOTSTRAP.md` still re-asserted a literal `^` in two "must contain" blocks and the approval summary after the new "`.npmrc` wins" rule. All three now describe caret as npm's default and print whatever prefix the workspace wrote. The summary line for the skills install is singular and names `angular-new-app`.
- The `formio-sdk` Security section's fourth bullet mixed application-facing and agent-facing rules; it is now two bullets, parallel to `formio-form`'s layout.

**Additions from the scanner emulation (same intent, same skills):**

- `formio-sdk` references not named in the original findings but documenting the same classes of surface now carry a boundary beside the API: `auth.md` (SSO callback token, `localStorage`), `submissions.md` (temp-token URLs), `files.md` (file descriptors are end-user input), `plugins.md` (a plugin sees every request and its token — also a fifth Security bullet in `SKILL.md`), `utils-conditions.md` and `utils-logic.md` (compiled strings), `utils-form-traversal.md` (fetching `component.data.url`), `utils-mask-sanitize.md` (widening).
- `formio-angular-resources/SKILL.md`'s Next-steps block showed a hand-rolled `curl … x-jwt-token … /import`, contradicting the library-wide ban on direct requests; it now names the `project_import` tool. `app-integration.md` told the agent "do not pin versions"; it now defers to BOOTSTRAP's registry resolution and the committed lockfile.
- `formio-form/references/setup.md`'s hash-recompute command is prefaced with what it does (downloads only to hash, executes nothing).

**Deliberately not done:** pinning `angular/skills` to a commit SHA (stale-doc risk outweighs the LOW), switching caret to exact pins (lockfile is the integrity control), and any removal of a documented API.

## Migration Plan

No migration. Skill markdown ships with the next plugin release; consumers who installed with `npx skills add formio/ai` pick it up on `skills update`. No file layout, trigger, or reference name changes, so nothing links to a path that moves. Rollback is a revert of the markdown and test edits.

## Open Questions

- Whether skills.sh re-scans on every published version or on a schedule. If scheduled, the post-release verification task waits for the next scan rather than triggering one.
