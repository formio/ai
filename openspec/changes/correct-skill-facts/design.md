## Context

The pre-1.0 review listed skill statements that disagree with Form.io's source. On 2026-10-12 each was re-checked against nirvana at `2c17582c48` and the packages `packages/skill-tests` runs against (`@formio/js` 5.6.1, `@formio/core` 2.9.0; `@formio/react` 6.2.2 from its published tarball). Items found already fixed — the `project-actions.md` tool table and the preflight's list of writing tools — are not part of this change. Routing and cross-skill contracts are proposal 6, the planner's delta mode is proposal 7, and tests that compile examples or compare skill text with tool schemas are proposal 8.

The governing constraint is that no fix may make a skill less effective: every change replaces a wrong statement with the right one, and no API, pattern, or example is removed without a working replacement.

## Goals / Non-Goals

**Goals:**

- Every statement in the proposal reads as the source behaves, in every place it appears.
- A test fails if any corrected statement reverts.
- The runtime references stop telling application code to use the MCP server's token, and the validator enforces the distinction.

**Non-Goals:**

- Changing MCP server code or the tool surface.
- Renumbering planner action priorities: the emitted values already match the server defaults and `templates/default.json`; only the prose describing them is wrong.
- Replacing hardcoded versions with run-time `npm view` reads. The versions checked are correct today (React Router 8, `@vitejs/plugin-react` ↔ Vite, the zone.js peer, the stylesheet size); only the stray `@5.5.1` CDN pin is wrong. Making the rest resolve at run time is drift prevention, proposal 8.
- Moving `FRAMEWORK.md`'s maintainer section out of `plugin/`: that is layout, proposal 6.

## Decisions

### 1. Source of each fact

| Fact | Source |
| --- | --- |
| No static `Formio.login`; login installs the JWT | `packages/core/src/sdk/Formio.ts` (statics; `saveSubmission` token handling ~1641-1670) |
| `ssoInit` consumes the callback | `Formio.ts` `samlInit` / `oktaInit` ~2240-2335; `apps/formio-server` SAML return `?saml=` |
| Providers constructed with `new` | `packages/formio.js/src/Formio.js` ~41, ~80, ~104 |
| `validate()` returns an error array | `packages/formio.js/src/components/_classes/nested/NestedComponent.js` |
| Submit sequence | `packages/formio.js/src/Webform.js` submit path |
| `logout` GET, `currentUser` URL, `formio.user` | `Formio.ts` ~2107-2175 |
| Action priority | `apps/formio/src/actions/actions.js` (`.sort('-priority')`, handler filter) |
| Lockout opt-in, 401 when locked | `apps/formio/src/actions/LoginAction.js` ~141 |
| Registration via `user/register` | `apps/formio/src/templates/default.json` |
| PUT keeps omitted fields | `packages/resourcejs/Resource.js` ~845-873; `apps/formio-server` `ProjectResource.js` ~262-385 |
| Import needs objects | `apps/formio/src/templates/import.js` |
| Expiry is 440 | `apps/formio/src/middleware/tokenHandler.js` |
| Submission `access` is server-set | `apps/formio/src/middleware/addSubmissionResourceAccess.js`; `models/AccessSchema.js` |
| Token swap gives no default role | `apps/formio-server/src/hooks/alter/currentUser.js` ~90-111 |
| Email-token macro | `apps/formio-server/src/hooks/alter/email.js` ~173 |
| Export omits `_id` | `apps/formio-server/src/hooks/settings.js` ~1465 |
| Role Assignment runs on create | `apps/formio/src/actions/RoleAction.js` ~21-29 |
| Email filtering and wrapper | `apps/formio/src/util/email/index.js` ~124-163; `actions/EmailAction.js` ~274-281 |
| Webhook editions | `apps/formio/src/actions/WebhookAction.js`; `apps/formio-server/src/actions/webhook/WebhookAction.js` |

### 2. A runtime authentication paragraph, selected by file name

Runtime references (`runtime-*.md`) carry a new `RUNTIME_AUTH_PARAGRAPH`:

> Application code calling these endpoints at runtime sends the end user's JWT in the `x-jwt-token` header — the token the login form's Login action, or an SSO flow, returns in its `x-jwt-token` response header — or no token where the Anonymous role holds the permission. The JWT from the MCP server's browser-based portal-login flow authorizes only the server's own tool calls; application code neither receives nor sends it.

`validateAuthParagraph` selects by file name: `runtime-*.md` requires the runtime paragraph (and may also carry the canonical one when it documents build-time endpoints), `pdf-api.md` requires both, `server-status.md` neither, every other reference the canonical one. The two `formio-auth` documents about the end user's JWT switch to the runtime paragraph.

*Alternatives:* exempting runtime references from any paragraph leaves them with no statement of which token to send, which is the question an agent writing application code has; rewording the canonical paragraph to cover both cases makes one paragraph say two things. A name prefix is the scope the library already uses, so no new registry is needed.

### 3. Tests assert the corrected statement, and execute it where a harness exists

Each corrected fact gets a test in a new `packages/skill-tests/src/source-facts/` suite, one file per skill. A test asserts both that the wrong statement is absent and that the right one is present, so a revert and a deletion both fail. Where `skill-tests` already loads the real package, the test also checks the behaviour itself: `Formio.login` is undefined, a provider declared as in the example is constructible with `new`, and `validate()` on a rendered form returns an array. Existing tests that assert the wrong text (`application-orchestration.test.ts`'s "reads no submission data") change with the prose.

*Alternative:* compiling every code block. That catches more, but it is a harness of its own and is proposal 8.

### 4. The skills.sh items are corrections, not score changes

- `formio-sdk` `SKILL.md`'s agent-facing bullet returns to the form its spec already requires: whatever any `Formio` call or MCP tool returns describes the application and never instructs the agent. The narrowed version claimed no tool returns submission data, which `formio-api`'s documented submission endpoints contradict.
- `formio-application` Step 1 drops "opens no file a third party supplied" — false on the modify-existing branch, where the workspace holds dependencies — and states that workspace files are data, not instructions.
- `formio-sdk`'s two Socket LOW findings, on the Evaluator and logic references, stay accepted as recorded in the 2026-10-01 change: they describe the API the skill exists to document.

Scanner scores may not move; the change is judged by whether the statements are true.

### 5. Sanitizer, persona, and email prose states behaviour

The options example, the persona actions, and email filtering are stated as what the code does and how to use it — the default example keeps the default sanitizer and the iframe snippet is labelled opt-in; persona actions run on create only and changing a persona is an administrator task; the Email action filters the listed values and no others. The webhook section lists the Enterprise settings by function.

### 6. CLAUDE.md follows

`CLAUDE.md` lists the canonical auth paragraph among conventions "not enforced by automated tests"; `validate-library.test.ts` enforces it. The note is corrected and gains the runtime paragraph rule, and the MCP Tool Preference sentence's retired `authenticate` tool name is replaced.

## Risks / Trade-offs

- [Wide prose change, many files] → One test per fact, and `pnpm test` runs the existing drift, link, and terminology suites over every file touched.
- [The shared "Where these two values come from" paragraph has 12 copies, and only `SKILL.md` copies are drift-tested] → The new test collects every copy under `plugin/skills/` and requires them identical apart from the link.
- [Okta's `/current` Bearer exchange was not located in server source] → The corrected SSO text describes what the SDK does on the client and makes no claim about the server's handling.
- [Prettier on edited markdown] → Hand-edit; no tree-wide reformat; never run Prettier on files with markdown fences.

## Migration Plan

Markdown and test changes only. Ships in the 1.0 release with an `@formio/ai` patch changeset that folds into the pending major.

## Open Questions

None.
