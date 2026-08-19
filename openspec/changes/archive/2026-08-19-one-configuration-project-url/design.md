## Context

Two properties of the configuration surface no longer match the code beneath it.

`FORMIO_DEFAULT_PROJECT_URL` was introduced for one reason, recorded in its own Purpose: `FORMIO_PROJECT_URL` pinned the server and `project_set` could not redirect it, so an install-time prompt wired to it would silently defeat every later mapping. The scope reorder made the environment the weakest source, so that pinning no longer happens — and the workaround outlived the problem.

The base URL is now derived in every deployment shape but one. `https://api.form.io` for a `form.io` host; the project URL's parent for sub-directory routing; unresolved only for a path-less customer host, which is rare across the customer base. The library nevertheless presents two co-equal values to configure, which asks every reader and every agent to reason about a value they will almost never supply.

And one name is doing three jobs. `FORMIO_PROJECT_URL` appears 223 times under `plugin/skills`: 171 as substitution slots in endpoint headings, ~35 naming a value handed between phases, ~15 about the environment variable itself. Only the last is an environment variable. The other two borrowed its spelling, which turns "use the project URL" into "go read an environment variable" — and that conflation demonstrably misleads: it is why `FORMIO_DEFAULT_PROJECT_URL` was read as part of the base-URL defaulting story during this work, when it is an unrelated project suggestion.

The measured footprint matters for scoping. There are 204 `Base URL` / `baseUrl` mentions under `plugin/skills`, in two populations: 68 are endpoint roots in eight `formio-api` platform references, and ~50 across fourteen files are configuration guidance. Both are in scope, but for different reasons and with different treatments — the guidance is rewritten, the roots are renamed.

## Goals / Non-Goals

**Goals:**

- One configuration to think about: the Project URL.
- One project variable. Nothing offers a project without applying it.
- A base-URL model with two outcomes — derived, or asked — and no third that reads as a guess.
- Guidance placed where it is actionable: ask for the project first, explain sub-domain routing only in the message that needs it.

**Non-Goals:**

- The 68 `${FORMIO_BASE_URL}` endpoint roots. They say where an endpoint lives.
- `FORMIO_BASE_URL` as an environment variable. It stays as the weakest source, for the shop whose projects all sit on one deployment; it simply stops being advertised as something to configure.
- Any change to precedence, derivation arithmetic, or the `.git` boundary.
- The `.mcpb` bundle's base-URL prompt, which a desktop host still needs.

## Decisions

**Remove the offering variable rather than re-document it.** The alternative was to keep it and narrow its description. Rejected: it now duplicates what `FORMIO_PROJECT_URL` does — suggest a project that stronger sources override — while adding a second concept to name, validate, report, and explain in every environment table. And it carries the failure mode the user identified: a suggestion is a value an agent may act on instead of asking, which is worse than no value when asking is cheap and correct.

**Point the desktop bundle at `FORMIO_PROJECT_URL`.** A desktop host has no working directory to map and no repository to commit into, so an install-time value is its only practical route to a project — which is why the bundle prompts at all while the CLI manifests now do not. Setting the pinning variable there used to be forbidden; it is now the right answer, because the environment is the weakest source and any later `project_set` or committed file overrides it. Same protection, one variable.

**Rename the `default` base-URL source to `derived`, and keep the value identical.** `https://api.form.io` for a `*.form.io` project is not a fallback — it is the one deployment whose base URL is a constant, so naming it from the host IS a derivation. Reporting it as a "default" invites the reading the whole shape effort was meant to remove: that the server guessed. Two outcomes are easier to hold than three, and `project get` output becomes "derived from the project URL" or "not determined — here is the command."

**Split the guidance by actionability rather than by completeness.** The unset-project error carried all three URL shapes, which made a message asking for one value read as asking for two. The base URL is derived from whichever project URL the user is about to supply, so shape guidance cannot be acted on before that answer exists. The project error therefore describes a Project URL and gives an example per deployment kind; the base-URL error keeps the sub-domain explanation, because that is the only place a reader can do something with it.

**Separate the three uses by spelling, and reserve `FORMIO_*` for the environment.** The alternative was to keep one spelling and explain the three meanings in a terminology note. Rejected: a note is read once and the token is read hundreds of times, and the misreading it has to prevent — "there is an environment variable I should consult" — is exactly the action an agent takes without pausing to check a note. Making the spelling carry the distinction means one rule applies everywhere with nothing to remember: an `FORMIO_*` name always means the environment variable.

**Single braces for the slot, not double.** `{projectUrl}` rather than `{{projectUrl}}`, because double braces are Postman's placeholder syntax and `api-skills-validation` exists partly to keep unresolved Postman placeholders out of the references. A slot that looked like the thing the validator rejects would be a new source of confusion in place of the one being removed. Single braces also match the property names an agent already sees in `project get` output and `project_set` arguments.

**The endpoint roots are renamed rather than removed, and an earlier draft of this proposal had them out of scope entirely.** That exclusion was right about the reason — they document where an endpoint lives, not how to configure anything — and wrong about the conclusion, because the problem with them is the spelling rather than the presence. Keeping the exclusion would have left 171 instances of the misleading token in the files an agent reads most.

**Overrule the existing terminology specs rather than work around them.** `api-skills-authoring` and `api-skills-validation` currently REQUIRE the `${FORMIO_*}` root form and forbid alternatives, so this rename is non-conformant until those requirements change. They are changed here rather than exempted, because an exemption would leave the spec tree asserting the form the library no longer uses.

**Anchor the work on Code versus Docs/Skills, as requested.** The two halves fail differently and are verified differently: the code half is proven by resolver, CLI, and bundle tests; the docs half is proven by content sweeps over the skills tree. Keeping them as separate task groups also keeps the endpoint-root exclusion visible — it is a docs-half rule, and it is the one instruction that prevents a sweep from deleting reference documentation.

## Risks / Trade-offs

**Removing an environment variable breaks anyone who set it** → `FORMIO_DEFAULT_PROJECT_URL` never participated in resolution, so nothing resolves differently; what changes is that the suggestion stops appearing in the resolution error and the server instructions. A user who relied on seeing it will now be asked for the project instead, which is the intended flow. Mitigation: the changeset names the variable and says to set `FORMIO_PROJECT_URL` instead where an install-time value is genuinely needed.

**`derived` instead of `default` is a reported-string change that callers may match on** → `project get`'s `Source:` line and the resolver's `sources.baseUrl` both change for the hosted-cloud case. Mitigation: both are covered by tests in this repository, and the skills read the prose rather than the enum. Called out in the changeset because an external consumer could be matching on it.

**A shorter unset-project error tells a self-hosted user less up front** → Someone on a sub-domain-routed deployment now learns about the base URL in a second message rather than the first. Accepted deliberately: they cannot act on it until they have supplied a project URL, and the second message arrives immediately after they do.

**A docs sweep could delete endpoint roots instead of renaming them** → The two jobs look alike to a regex: "remove base-URL configuration guidance" and "rewrite base-URL endpoint roots" both match `baseUrl`. Mitigation: the docs tasks assert a COUNT — the eight `formio-api` references must still carry the same number of roots after the rename as before, in the new spelling. A deletion fails that assertion where a rename passes it.

**A 171-instance mechanical substitution is where a typo hides** → One malformed root in a reference an agent reads is a broken URL it will build. Mitigation: the substitution is scripted rather than hand-edited, and the validator is updated first so it rejects both the old spelling and a malformed new one — the rename lands against a test that already knows the target shape.

**Renaming a token that appears in the eval harnesses or fixtures** → A fixture asserting the old root would fail for the right reason but look like a regression. Mitigation: the repo-wide grep in the final task group covers `packages/skill-tests` and any `.eval-artifacts` fixtures, not just `plugin/skills`.
