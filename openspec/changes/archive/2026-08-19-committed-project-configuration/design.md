## Context

`~/.formio/projects.json` maps a working directory to a project, keyed by absolute path, in the user's home directory. Both facts make the target un-versionable: a clone on another machine has no entry, a CI runner has no entry, and no reviewer can see which deployment a branch points at. The only alternative is `FORMIO_PROJECT_URL` in the environment, which is per-process rather than per-folder and equally unreviewable.

The server has no upward directory walk today — `readProjectEntry` does an exact-key lookup on the absolute path — so discovery is the new machinery this change adds.

The resolver already tracks provenance (`ProjectUrlSource`, `BaseUrlSource`) and `project get` already reports which source won. That existing plumbing is what makes a third layer tractable: the reporting surface exists and only needs widening.

One asymmetry in the current spec is load-bearing here. The project URL resolves environment-first ("`FORMIO_PROJECT_URL` from the environment, when set and non-empty" ranked above the mapping), while the base URL resolves mapping-first ("`env.FORMIO_BASE_URL` from the matched project-map entry, otherwise the configured base URL"). The same pair resolves in opposite directions, and the base-URL half already implements the scope-ordering this change adopts for both.

## Goals / Non-Goals

**Goals:**

- A target that travels with the code, survives a clone, and shows up in a diff.
- Per-folder targeting without a second mechanism: a monorepo points two app folders at two projects.
- One precedence order, by scope, applied identically to both URLs.
- Every layer visible: which one won, and which ones it shadowed.
- No new silent-wrong-deployment paths — the failure class this whole line of work has been closing.

**Non-Goals:**

- No named environments and no environment selector. One target per file; a branch that deploys elsewhere commits different values.
- No secrets in the file. A project URL names infrastructure; `FORMIO_API_KEY` and tokens stay where they are.
- No change to `~/.formio/projects.json`'s format, `0600` mode, or merge semantics.
- No change to the token cache, which stays keyed by base URL.
- Not a general project-config file. It holds the two URLs and ignores unknown keys; it is not a home for renderer options or skill settings.

## Decisions

**Discover by walking up from `cwd`, nearest file wins.** The alternative — an explicit path argument, or a single file at a fixed location — cannot express a monorepo whose folders target different projects, which is half the request. The upward walk is the rule `.editorconfig`, `tsconfig.json`, `.npmrc`, and `.prettierrc` already teach, so the semantics need no explanation. Cost: one file governs its whole subtree, so a reader in a deep folder must know the walk to know what applies — which is why `project get` reports the winning file **by path** rather than just naming the layer.

**Stop the walk at a directory containing `.git`.** Without a boundary, a `formio.json` in `$HOME` silently governs every repository beneath it, which is precisely the silent-wrong-deployment failure the shape-aware base-URL rules were added to prevent — reached from a new direction. The boundary is inclusive: the directory holding `.git` is searched, since a repository-root file is the common case. A directory outside any repository simply has no committed layer, which is correct — there is nothing there for git to version.

**Precedence by scope, narrowest first: committed → mapping → environment.** This is the user's call and it reverses today's environment-first rule for the project URL. Two things recommend it beyond the stated preference. First, it makes the pair consistent: the base URL already resolves mapping-above-environment, so today one pair resolves in two directions and after this it resolves in one. Second, it matches what each source *means* — a committed file is a statement about the code, a mapping is a statement about one machine, and an environment variable is a process-wide default. Ordering them by how specific they are to the code is the only ordering that reads as a rule rather than as a list.

**Report shadowing, not just the winner.** With three layers, "my `project_set` did nothing" becomes the obvious support question, and today's output cannot answer it — a losing layer is simply absent from the report. Naming the shadowed source and the value it holds turns an invisible precedence rule into a visible one. This is the same reasoning as the `config.ts`-versus-mapping mismatch branch: the fix for two records disagreeing is to show both, never to pick one quietly.

**`project set` takes an explicit `--scope`, defaulting to `user`.** Inferring the scope — writing the committed file whenever one exists, the mapping otherwise — would make the same command do two different things depending on the tree, and would let a routine `project set` modify a tracked file the user did not mean to touch. Defaulting to `user` keeps every existing invocation behaving exactly as it does now, so this change adds a capability without moving anyone's cheese. `--scope repo` prints the path it wrote, because "the nearest file" is not evident from the arguments.

**A broken committed file is its own error, not "unconfigured".** Reporting it as unconfigured sends the caller to `project_set`, which writes a mapping the broken file then shadows — the caller fixes the symptom, the problem persists, and the precedence rule makes it invisible. This mirrors the existing `ProjectMapUnreadableError` reasoning, one layer up.

## Risks / Trade-offs

**A CI job that relied on `FORMIO_PROJECT_URL` pinning silently changes target** → This is the breaking edge, and it is silent by nature: the job keeps running and writes to a different project. It bites only a job that has BOTH an environment value AND a committed file or a mapping covering its `cwd` — a configuration that is now contradictory by construction. Mitigation: `project get` reports the environment value as shadowed rather than omitting it, so the state is inspectable in one command, and the change ships with a migration note naming this exact combination. A pinned launch with a clean checkout and no mapping — which is most of them — is unaffected.

**A committed file gives every consumer of that checkout the same target** → No runtime value overrides it. Accepted deliberately: that is what "the code declares its target" means. The escape is to not carry the file, or to carry a different one on the branch that wants a different target.

**A committed file plus a personal mapping is a new way to be confused** → Two records, one wins. Mitigation: the shadowing report, and `project set --scope repo` so a developer who wants the committed value can update it rather than shadow it locally. Accepted rather than closed: the whole point of the layering is that a personal override is possible.

**One file governing a subtree surprises a reader deep in the tree** → `apps/web/deep/thing` resolving to the repository root's file is correct and non-obvious. Mitigation: `project get` names the winning file's absolute path, so the answer to "why this project?" is one command away.

**A project URL in a public repository names infrastructure** → Not a credential, but it is a pointer to a deployment. Accepted and stated in the spec: teams that consider their deployment hostnames sensitive keep using the personal mapping or the environment, both of which remain fully supported. The file is opt-in.

**The `.git` boundary breaks a non-git workspace someone expected to work** → A directory outside a repository gets no committed layer even if a `formio.json` sits above it. Accepted: that file is not versioned by anything, so honoring it would deliver the confusion of the feature without its benefit. `project get` says no committed configuration was found, so the situation is legible.

**A `formio.json` committed into the wrong directory governs everything beneath it** → The upward walk that makes per-folder targeting work is the same mechanism that makes a misplaced file broad. The sharpest instance is this library's own repository: a file committed at its root would be discovered by every skill invocation, eval run, and test in the tree. Mitigation: the file is written into the application workspace by the scaffolding skills, `project set --scope repo` defaults to the `--cwd` directory rather than an ancestor, `project get` names the winning file's path, and a guard test asserts this repository carries none.
