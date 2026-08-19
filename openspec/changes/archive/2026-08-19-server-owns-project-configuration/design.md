## Context

Two URLs are needed at exactly one moment — when an `@formio/mcp` tool calls the deployment API — and the guidance for choosing them is currently spread across four documents. `formio-application/DEPLOYMENT.md` is the declared owner: three valid shapes, plain-language descriptions with example values, a validation section, a Base-URL derivation table, an exit-code table for `project get`, and the `project_set` rules. `formio-mcp-setup/SKILL.md` points at that document as the owner and then restates the shapes anyway "in short", because a reader mid-setup will not open another skill's file. `formio-angular/SETUP.md` carries its own copy of the exit-code table and points at the same owner for "the full table". Each of them independently instructs the agent to interview, validate, derive, and persist.

The server, meanwhile, is the one component always present, and it knows strictly more than any of them: which directory was searched, which half of the pair is missing, whether a base URL can be derived from the project URL's shape, and which source won. It already carries the three-shapes guidance in its MCP `instructions` for exactly this reason — an agent with no skills installed has nothing else to read. What it does not yet do is make its *errors* self-sufficient, so today an agent that hits one still needs a document to interpret it.

`guard-unconfigured-project-calls` is a prerequisite: it introduces the unresolved-base-URL state and the shape-aware derivation these errors describe.

## Goals / Non-Goals

**Goals:**

- One owner for the URL wording — the server — reachable by every caller, including agents with no skills installed.
- One read surface for skills: `project get`.
- Errors verbose and staged enough that relaying one, collecting one value, and running one named command is the whole remedy.
- Skills get shorter, not longer: the duplicated shapes, descriptions, validation, derivation, and exit-code tables are deleted rather than relocated.
- The proactive probe stays, so the common path never needs a failed tool call to discover a missing configuration.

**Non-Goals:**

- Not removing the server's MCP `instructions` guidance — the errors are additive to it, not a replacement.
- Not making the probe the enforcement. The server's errors remain the backstop for anything that skips the probe.
- No change to project-URL precedence, to the mapped-base-URL-outranks-environment rule, or to `~/.formio/projects.json`'s format, mode, or merge semantics.
- Not adding a machine-readable output mode to `project get`. Agents read prose; exit codes plus verbose stderr are the contract.
- Not touching frontmatter descriptions, so the description snapshot stays valid.

## Decisions

**Errors carry the guidance; documents stop carrying it.** The alternative — keep the wording in `DEPLOYMENT.md` and have other skills link to it — is what exists today, and it failed twice over: `formio-mcp-setup` duplicated it anyway rather than send a reader elsewhere mid-flow, and a skill-less agent could not reach it at all. Guidance has to travel with the failure it explains. That is only true of the error text, so the error text is where it goes.

**Report the two failures one at a time, project URL first.** A compound "set both" message reads as a bigger task than it is, and the base URL that will be needed depends on the project URL the user has not yet supplied — a hosted-cloud answer needs no base URL at all, and only a path-less customer host needs one that cannot be derived. Sequencing means each prompt asks for exactly one value, and the second only appears when it is genuinely required.

**Make `--project-url` optional on an already-mapped directory.** This is not a convenience — it is what makes the base-URL error's own remedy runnable. `project set --base-url <url>` is the command the message names, and with `--project-url` required the user would have to re-supply a value the mapping already holds, from a message that deliberately did not ask for it. Requiring at least one of the two flags keeps the no-mapping case honest. The MCP tool follows the same rule so the tool and the command stay one behavior.

**`project get` is the read surface, including where a skill only wants to display the values.** `formio-angular/CONFIG.md` writes `appUrl` and `apiUrl` into a committed file, so it needs the same two values the server resolves — and any second path to them (a handoff variable, a remembered answer, its own derivation) is a way for the committed file and the mapping to disagree. Reading them from one place makes that class of bug unrepresentable.

**Confirm a handoff rather than trust it.** `formio-angular` currently skips SETUP when `formio-application` hands URLs in. The handoff is not wrong, but it is a copy, and the mapping is what every later tool call and `@formio/angular` itself resolve against. Re-running `project get` costs one subprocess and removes the copy.

**A `config.ts` that disagrees with the mapping is a question, not a skip.** The existing skip rule compares `config.ts` against "the SETUP values", which under this change means the mapping. Silently skipping on a mismatch would leave the app pointed at one deployment while build-time tools resolve another — the exact split-brain the single-read-surface decision exists to prevent, arrived at through the skip path. Surfacing both records and asking is the only safe branch.

**Delete `DEPLOYMENT.md` rather than keep it thin.** The first draft kept it, reasoning that scripting Step 2 was a real job worth a file. That was wrong on the mechanism: a file named for a topic is where that topic re-grows, and 160 lines of shapes, descriptions, validation, derivation tables and precedence prose accumulated there precisely because the file existed as the place URL nuance belonged. Keep it thin and the next edge case lands there again. The costs of deleting turn out to be nearly nil — the inbound references from `formio-mcp-setup` and `formio-angular/SETUP.md` are being deleted anyway, since removing that coupling is the point of the change — leaving one spec delta on the sibling-doc list, which this change is already writing.

**Fold configuration resolution into the preflight and drop to four steps.** Once the probe belongs to every skill's preflight, `formio-application` having its own Deployment *step* is a second copy of the same work. And the ordering concern that motivated a separate proposal — resolution must precede planning, or the user finishes the planner interview before learning there is no project — is satisfied structurally rather than by prose, because a preflight runs before every step by definition. This is why the separately-proposed `reorder-deployment-before-plan` change is dropped rather than merged: with no Deployment step, there is nothing left to order. Step 4.5's conditional `formio-auth` handoff becomes Step 3.5, and `FRAMEWORK.md`'s Step 5 / Step 5a become Step 4 / Step 4a.

**Three things about the URLs stay outside the server; everything else goes in.** The temptation is to push all of it server-side and have skills say nothing, but an agent needs to be able to *name* what it is asking for without first provoking an error — so a one-sentence definition of each URL stays in the shared preflight, alongside the two command names and the `~/.formio/projects.json` prohibition. The shapes, example values, validation rules, and derivation stay server-side only, because those are what a user needs at the moment of failure, which is exactly when the server is speaking.

**Fix the `MCP_CONFIG.md` drift while editing the same list.** The sibling-doc requirement still names `MCP_CONFIG.md` as required while a different requirement in the same spec forbids linking it — leftover from the removed MCP-configuration step. Correcting it is in scope because this change rewrites that list anyway, and leaving a knowingly-wrong entry beside a corrected one would be worse.

**This change's `server-config` delta restates its prerequisite's edits.** `guard-unconfigured-project-calls` modifies the same `server-config` requirements, and the delta here is written on top of them — the derived and unresolved base-URL sources included. So the two must be applied in order, guard then this; applying this one first would silently revert guard's edits.

## Risks / Trade-offs

**The probe adds a subprocess to every tool-calling skill invocation** → One `npx` call, and it is the same call `formio-mcp-setup` and `formio-angular/SETUP.md` already make. Mitigation: the probe is required only before the first deployment-touching call, so reference-only work — most `formio-api`, `formio-schema`, and `formio-sdk` traffic — never pays it.

**`npx` resolving an old `@formio/mcp` reports nothing and exits 0** → Already a documented trap, and this change increases dependence on the command. Mitigation: every invocation is version-pinned (`@formio/mcp@<pinned>`), which is already the convention in the documents being rewritten; keep the pin in the shared preflight wording so it cannot be dropped per-skill.

**Deleting the shapes from the skills makes the skills worse for a human reading them** → With `DEPLOYMENT.md` gone, nobody browsing the skills library can see the three shapes without triggering an error. Accepted: the server's `instructions` are visible to every connected client, the shapes appear in the unset-project error the user will actually see, and the alternative is the duplication that motivated the change.

**A skill relays an error verbatim that names a `--cwd` the user did not expect** → The message echoes the directory searched, which for an omitted `cwd` is the server's own working directory. That is a feature — it is how the wrong-directory case gets named — but a relayed message could confuse a user whose agent forgot the argument. Mitigation: the preflight requires passing the user's working directory on the probe and on every tool call, which is where the correct value comes from.

**Error text becomes a test surface, so wording changes break tests** → Asserting on prose is brittle. Mitigation: assert on the load-bearing tokens — the command name, the flag, the echoed URL, the absence of `api.form.io` — rather than on whole sentences.
