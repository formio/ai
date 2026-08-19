## REMOVED Requirements

### Requirement: A configured project may be offered without being applied

**Reason**: The capability existed to solve one problem, stated in its own Purpose: `FORMIO_PROJECT_URL` pinned the server and `project_set` could not redirect it, so an install-time prompt wired to that variable would silently defeat every later mapping. `FORMIO_DEFAULT_PROJECT_URL` was the workaround — a project URL an agent must confirm and persist, which takes no part in resolution.

The scope reorder removed the premise. The environment is now the WEAKEST source: a committed `formio.json` wins, then the working-directory mapping, then the environment. `FORMIO_PROJECT_URL` therefore no longer pins anything and `project_set` can redirect a directory whose environment names a different project — which is precisely the guarantee the offering variable was invented to provide. A second variable that offers rather than applies is now a second way to say the same thing, plus a suggestion an agent may mistake for an answer instead of asking.

**Migration**: Remove `FORMIO_DEFAULT_PROJECT_URL` from any environment, client configuration, or bundle user-config that sets it. Where an install-time project answer is genuinely the only route — the `.mcpb` desktop bundle, which has no working directory to map and no repository to commit into — set `FORMIO_PROJECT_URL` instead: it is now overridable by both stronger sources, so it suggests without pinning. Everywhere else, supply the project per directory with `project set` (optionally `--scope repo`) or a committed `formio.json`, and let `project get` report what is missing.

### Requirement: The pinning and offering variables are distinguished in writing

**Reason**: With the offering variable gone there is one project variable, so there is no pair to distinguish. The requirement's remaining content — that `FORMIO_BASE_URL` gains no offering counterpart, and that a surface collecting a project URL must say which variable it sets — is either moot or absorbed: `project-map-routing` states the precedence order for both URLs in one place, and `agent-plugin-packaging` states what each manifest sets.

**Migration**: Documentation that contrasted the two variables should state the single precedence order instead — committed file, then working-directory mapping, then environment — which is what a reader needs in order to predict what a value will do.

### Requirement: An install-time project prompt never pins the server

**Reason**: A prompt can no longer pin the server, because no environment variable can. The rule it enforced is now a property of resolution rather than a constraint on install surfaces.

**Migration**: None required. An install-time `FORMIO_PROJECT_URL` is overridden by a committed `formio.json` or a `project_set` mapping, so the failure this requirement guarded against cannot occur.

---

## Note on how this removal was archived

`openspec archive` could not apply this delta, and the limitation is worth recording for the next capability removal.

The delta removes every requirement in the capability, so the rebuilt spec has none — and OpenSpec validates that a spec has at least one requirement. Deleting `openspec/specs/default-project-offer/` first does not help: the archive step then reads the delta as a *create* for a capability that does not exist, warns that the REMOVED requirements have nothing to remove, and aborts on the same validation rule.

The capability was therefore deleted from `openspec/specs/` directly, and this delta was held aside while `openspec archive` verified and applied the change's other five deltas — which it reported as already in sync. It was restored here afterwards so the reasoning survives in the archive rather than only in the proposal.

No prior change in this repository had removed a capability wholesale, so there was no precedent to follow. A future removal will hit the same wall.
