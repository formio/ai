## Context

Both CLI plugin manifests prompted for `FORMIO_BASE_URL` at install and wired the answer into the server's `env` block. The working tree already removes them; the rest of the repository has not caught up, which is why eleven tests fail and two specs still require the fields.

Three changes landed since that prompt was designed, and together they leave it with nothing to do. The base URL is now derived from the project URL's shape when it can be — `https://api.form.io` for a `form.io` host, the project URL's parent path for a sub-directory-routed deployment. The environment became the weakest of three resolution sources, below a committed `formio.json` and the working-directory mapping. And when no source supplies a base URL and none can be derived, the failure is an actionable message rather than a silent default.

## Goals / Non-Goals

**Goals:**

- The repository agrees with the manifests: specs, tests, skill prose, and READMEs.
- The removal is recorded as a behavior change with a self-describing remedy, not as a break.
- The `.mcpb` asymmetry is written down as a decision, so nobody "fixes" it later for symmetry.

**Non-Goals:**

- No change to `scripts/build-mcpb.ts`.
- No change to resolution, derivation, or the error messages — this change only removes a source that fed them.
- Not revisiting `FORMIO_DEFAULT_PROJECT_URL`, which is a suggestion rather than a setting and is unaffected.

## Decisions

**Not labelled BREAKING, and the distinction is worth being precise about.** The precedence reorder in `committed-project-configuration` is breaking because it silently changes which project a launch targets: the job keeps running and writes somewhere else. This removal is the opposite kind of change. When no base URL can be determined, resolution succeeds with the value absent and the first JWT-authenticating call fails with a message naming `project set --base-url`, the `formio.json` `baseUrl` key, and the project it applies to — and a skill's preflight `project get` prints the same message before any tool call is made. There is no state in which an agent cannot determine what is needed. The cohort affected is narrow (JWT auth against a sub-domain-routed self-hosted deployment), the remedy is one command per directory, and API-key deployments never read the base URL at all.

**Keep the `.mcpb` prompt.** A desktop host has no working directory to interview in — the server's process cwd is fixed at spawn and is the app's, not the user's — so `project_set` and a committed file are both out of reach there in a way they are not for a CLI. The existing suite already records this reasoning for the bundle's project prompt; the base URL follows the same logic. Removing it for symmetry would leave desktop users with no route to a base URL at all.

**Correct the Cursor requirement's justification while editing it.** It argued that an install-time project answer must feed `FORMIO_DEFAULT_PROJECT_URL` because `FORMIO_PROJECT_URL` "takes precedence over every working-directory mapping." The scope reorder made that false — the environment is now the weakest source. The conclusion still holds for a better reason (an install-time answer is the wrong SCOPE for a per-project value, whichever variable it lands in), so the requirement keeps its shape and loses the stale premise.

**Keep the placeholders-match-variables invariant even though both sets are now empty.** It costs nothing, it is the rule Cursor enforces at submission, and it is what catches a future placeholder added without a declaration. Deleting it because it currently holds trivially would remove the guard exactly when the manifest has no other protection.

## Risks / Trade-offs

**A self-hosted sub-domain-routed user upgrades and hits an error they did not have before** → Real, and narrow: JWT auth only, one directory at a time, with the fixing command named in the message. Mitigation: the changeset says which cohort and what the one-time fix is. Accepted because the alternative is a global that is right for one project and wrong for the next, which is the failure the derivation rules exist to surface.

**The `.mcpb` asymmetry looks like an oversight to a future reader** → Two manifests prompt for nothing and one prompts for a base URL. Mitigation: a spec scenario asserts the bundle still prompts and says why, so the asymmetry is a documented decision rather than drift.

**The Cursor `variables` invariant now passes vacuously** → A test that cannot fail is a test that stops being read. Mitigation: the assertion is re-expressed as "no `${VAR}` placeholder appears anywhere in the manifest," which is a real claim about the current file rather than a comparison of two empty sets.
