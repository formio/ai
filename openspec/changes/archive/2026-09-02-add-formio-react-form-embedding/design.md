## Context

`add-formio-react-skill` left an embed row marked reserved in `formio-react`'s dispatch table, routing such requests to `formio-form` with a disclosure that its guidance covers the Vanilla JS renderer. This change fills the row.

Two facts established by inspection shaped it. First, `formio-form` is not an orchestrator: it is a Vanilla JS task guide built entirely around `Formio.createForm(element, srcOrJson, options)`, and no reference in it mentions React, Angular, or frameworks. `formio-angular` points *at* it for embedding rather than the reverse, so today every framework's embed request lands on imperative DOM guidance. Second, `@formio/react`'s embedding surface is substantial and its sharp edges are not inferable from prop names — they are documented in the monorepo's own `docs/gotchas/react.md` and `docs/architecture/react.md`, which are as much a source for this skill as the package's TypeScript.

## Goals / Non-Goals

**Goals:**

- Make React embedding a real branch, authored from source rather than from what the Vanilla JS path implies.
- Carry the lifecycle traps that cause the actual production failures, as first-class content rather than footnotes.
- Keep one home for definition-level behavior, so nothing is documented twice.
- Close the unqualified-embed-in-a-React-workspace gap with the smallest mechanism that closes it.
- Leave the equivalent Angular gap visible and cheap to close.

**Non-Goals:**

- Turning `formio-form` into a framework dispatcher. Considered and rejected below.
- Angular embedding. Named as a gap, specified by a later change.
- Form management. `FormBuilder`, `FormEdit`, `FormGrid`, `SubmissionTable`, and `Report` are named so a reader recognizes them and told that nothing here covers them. Building a form-manager UI is a real use case and a deliberate omission, not an oversight — and the spec says so rather than letting an agent improvise coverage.
- An eval harness. This is reference documentation; there is no generated artifact to grade.

## Decisions

**A host check, not a router.** The first sketch of this change made `formio-form` a framework dispatcher symmetric with `formio-application`'s `FRAMEWORK.md`. That was more mechanism than the problem needs. Skill activation is description-driven, so "embed this form in React" reaches `formio-react` directly once its description claims React embed triggers — a dispatch table would add a hop that description matching already performs. The only request the descriptions cannot resolve is the one that names no framework from inside a framework workspace, and that needs one detection step before mounting code is written, not a table with branch documents.

The check is deliberately bounded in two ways. It applies only to the **mounting** half, because a definition question — a conditional, a calculated value, a cascading select — has the same answer in every framework and should be answered where it lives. And it never becomes an interview: an undetectable host means proceed, not ask. A cheap check that sometimes does nothing is worth having; a question round on every embed request is not.

**One home for definition behavior.** `formio-form`'s description already asserts that "field behavior inside ANY framework's rendered form stays here" — the instinct predates this change; only the dispatch was missing. Keeping it that way is what makes the framework embed skills small: `formio-react-form` documents what differs because the host is React, and links for everything that does not. Duplicating the JSON Logic primer into each framework skill would be the fastest way to have three copies that disagree within a year.

**The lifecycle traps are the content, not an appendix.** A React developer can guess most of the `Form` component's prop list. What they cannot guess is that `options={{}}` written inline destroys and recreates the entire form instance on every parent render, that `submission` is deliberately excluded from the create dependencies and applied to the live instance behind an equality guard, that instance creation races unmount, or that a module-level default prop is a shared reference the builder mutates in place. Those are the failures that reach production, they are already written down in the monorepo's gotchas registry, and a skill that omits them is worse than the source it was derived from. Each is specified as symptom, cause, and remedy, because a reader arrives holding the symptom.

The Next.js requirement gets the same treatment for the same reason: the natural assumption is that marking a file a client component is sufficient, and it is not — `@formio/js` reaches for `window` during the server render pass regardless. Stating the misconception is worth more than stating the fix.

**Security prose is carried, not cross-referenced.** The library's convention is one canonical copy for shared guidance, and the security section bends it: a form definition is executable code in the page's JavaScript context, and a reader who arrives at the React skill may never open `formio-form`. So the section is duplicated with prose kept identical, which the `shared-prose-stays-identical` suite already enforces for the portal-login paragraph. Identical duplication is a maintained copy; a summary is a copy that drifts silently.

**`ReactComponent` is documented only as a migration target.** It is deprecated, it warns at construction and at init, and its own deprecation notice points at custom `@formio/js` components. Omitting it entirely would leave a reader who finds it in existing code with no guidance; presenting it neutrally would read as endorsement.

**Angular's gap is recorded where it is actionable.** It would be easy to note it in `formio-react`'s dispatch table, where it does not belong and no one will look. It goes in `formio-form`'s host check instead — the code path that actually encounters an Angular workspace — which tells the truth on contact: `@formio/angular` ships its own renderer component, no Angular embedding skill exists yet, and the Vanilla JS path does work here without being the recommended approach.

**Anonymous embedding leads, because it is the common case.** Treating authentication as the default and anonymity as the exception gets the frequency backwards: most embedded forms are public. The consequence worth specifying is diagnostic — a 401 on a public submit is a form-access configuration problem, and a skill that reaches for "log the user in" as the fix sends people down a path that cannot work for a public form.

**Styling earns a reference of its own.** It looks like polish and is actually the first failure a reader hits: the renderer emits Bootstrap-classed markup and ships no CSS, so the default experience of a correct integration is a form that looks broken. That symptom reads as a rendering bug, which sends people to debug mounting. Naming symptom before cause is worth more here than the styling options themselves.

## Risks / Trade-offs

- **Two skills now claim embed-shaped triggers** → the boundary is specified in both descriptions and gets `collision-guards` cases; `formio-react-form` claims only React-named phrasing, `formio-form` keeps the unqualified triggers.
- **The host check could grow into the router it deliberately is not** → it is specified as one step with an explicit prohibition on branch documents and on interviewing, and its scope is bounded to mounting.
- **Duplicated security prose can drift** → covered by the shared-prose suite, the same mechanism already holding the portal-login paragraph identical across skills.
- **Documented lifecycle traps are pinned to current `@formio/react` internals** → they are stated as symptom and remedy rather than as dependency-array contents, so guidance survives a refactor that changes the mechanism but not the behavior.
- **A reader may take the embed branch when they want CRUD** → the embed branch re-dispatches and says why, rather than serving a half-answer.
- **Applying out of order** → this change edits files `add-formio-react-skill` creates. The dependency is stated in the proposal; apply that change first.

## Migration Plan

Additive. `formio-form` keeps every trigger it claims today and gains a handoff it did not have; the reserved row becomes live. Rollback is removing the sub-skill directory and restoring the row to reserved — the wording for which is already in the prior change.

## Open Questions

- Does `mounting.md` document PDF rendering via `FormClass`, or route to a PDF-specific skill? Leaning toward one line and a link, decided when the reference is written.
- Should `provider.md` cover multi-tenant setups (a custom `Formio` per deployment) in depth, or name the capability and stop? Depends on whether the pattern shows up in real requests; naming it is the default.
