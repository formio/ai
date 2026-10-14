## Context

On 2026-10-13 the maintainer built `claude-react-storyboard-2` end to end with a hand-made local plugin build (`dist/plugin-local`, manifests pointed at the bundled server) and reported it working. The Version Packages PR #89 is open and mergeable. It bumps both packages to 1.0.0 and moves every pin to it. No `.changeset/pre.json` exists, so 1.0.0 publishes under `latest`.

## Goals / Non-Goals

**Goals:**

- One command for the local test build.
- Current screenshots.
- A recorded verification of the release candidate.
- A clean publish to every automated channel.

**Non-Goals:**

- Tool or skill changes.
- #82 and #83, which land after 1.0.
- An "upgrading to 1.0" note, which the maintainer declined.

## Decisions

### 1. The local build rewrites a copy

`build:plugin:local` runs `build:plugin` and copies `dist/plugin` to `dist/plugin-local`. It then rewrites only the `formio-mcp` entries in that copy's manifests to `node [--use-system-ca] <abs>/server/stdio.mjs`.

The published bundle stays byte-for-byte what `test:plugin` verifies. `--use-system-ca` matches the live runner, so a locally trusted deployment such as form.test works with verification on. The rewrite is a pure function over a manifest object, unit-tested.

*Alternative:* a flag on `build:plugin` would risk a published bundle that launches a local path.

### 2. Screenshots are taken by a person

Automated input on the Inspector page was blocked by another extension in the maintainer's Chrome profile. The images are retaken by hand, or with that extension disabled, against the 1.0 server's local build. They do not block the release: the README references them by `raw.githubusercontent.com/.../main/...` URL, so replacing the files on `main` updates what npm and GitHub display without a republish.

### 3. Verification reuses the existing harnesses

The live suite runs from the release-candidate commit. The routing and planner evals run on the current skill text and are graded with the current graders, and the results are compared with the last recorded runs:

- routing 32/32;
- planner 137/0 on the full-plan cases and 161/0 including the change-mode cases.

### 4. Merging #89 is the release

The release workflow, not a manual publish, publishes every automated channel. After it runs, each is checked:

- **npm:** `@formio/mcp` and `@formio/ai` at 1.0.0;
- **MCP Registry:** the 1.0.0 entry;
- **bundles:** the `.mcpb` bundles, Smithery, and the Docker Hub `1.0.0` tag;
- **GitHub:** the 1.0.0 release.

The directory listing is a maintainer action in claude.ai/directory/manage.

## Release verification results

Run on 2026-10-13 against the release candidate (`main` after #104 plus this change).

| Check | Result | Last recorded |
| --- | --- | --- |
| Live suite, `https://form.test/sandbox` | 33/33; project left as found (`1.0.0`, no probe entities) | 33/33 |
| Planner eval (`iteration-rc`) | 161 pass / 0 fail (full-plan 137/0, change mode 24/0) | 161/0 |
| Routing eval, first run (`iteration-rc`) | 31/32 — `extend-generic` went to `formio-angular` | 32/32 |
| Routing eval, after the description fix (`iteration-rc2`) | 32/32 | 32/32 |
| #89 versions and pins | 33 `@formio/mcp@` pins and 7 package versions move to 1.0.0; none left at 0.14.1 | — |

**The routing miss was a wording defect, not noise.** Five independent graders on `extend-generic` alone ("also track X" in an Angular workspace) split 3–2. Every one of them named the same reading of `formio-application`'s Not-for clause, "…named work on a project already planned and imported, or in an existing Angular/React workspace": its second half could stand alone. The clause now reads "Angular- or React-named requests, whether for a planned, imported project or an existing workspace in that framework". The extend trigger now says "even in an Angular or React workspace". Three phrases were shortened to stay within the 1,024-character budget (1,023). Five fresh graders then chose `formio-application` 5/5, and the full eval was 32/32.

**The changelog's 1.0 headline was stale.** It quoted the tools/list size from proposal 2: about 48.6k characters under a 50,000 budget. It now reads about 38.7k under the current 42,000 budget.

## Risks / Trade-offs

- **[A channel fails after npm publishes]** → The workflow is re-runnable, and its later steps detect the published npm version.
- **[The directory's auto-publish picks up `main` before the release finishes]** → The listing is updated after every automated channel is confirmed.

## Migration Plan

Merge this change, then #89. Confirm every channel, then update the directory listing.

## Open Questions

None.
