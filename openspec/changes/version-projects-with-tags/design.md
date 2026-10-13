## Context

The flow was set by the maintainer on 2026-10-12 and 2026-10-13:

- The Form.io project the folder resolves to is the source of truth, versioned with Form.io's own tags.
- `template.json` is an export of the newest tag.
- Changes to an existing project go through the granular tools.
- The tags are semver, and the agent asks before creating one.
- Deploying a tag to another stage stays outside the agent.
- The work ships in 1.0.
- It replaces proposal 7 (`add-planner-delta-mode`).

How Form.io versions work, from nirvana (`apps/formio-server/src`):

- **Tags are per family.** They are stored under the primary project, so every stage of a family shares them (`middleware/tagHandler.js` ~4-48).
- **Creating a tag.** `POST {projectUrl}/tag {tag, description}` exports the project when no `template` is sent, forces the template's `access` to `[]`, and stores the snapshot as one main document plus one chunk per form (`resources/TagResource.js` ~51-100, `createTagChunks.js`). It also sets the creating project's `tag`. Names are unique within the family and at most 32 characters; descriptions are at most 256.
- **Reading tags.** `GET /tag` lists tags without their templates. `GET /tag/:id` returns the chunk-merged template under `template` (`getFullTagTemplate.js`).
- **Current version.** It is the project's `tag` field (default `0.0.0`); `GET /tag/current` reports it.
- **Availability.** Every deployment this toolkit targets is Enterprise, so the tag and deploy routes are always present; the toolkit carries no handling for deployments without them.
- **Export.** `GET /export` strips `_id`, owner, timestamps, and submissions (`apps/formio/src/templates/export.js`).
- **Import.** It updates every form it names in place, resets `_vid`, and soft-deletes and recreates that form's actions (`import.js` ~621-631, 867-904). A template `access` replaces each named project access type (`hooks/settings.js` ~1365-1444). An action whose resource is not in the template loses it (`import.js` ~657-660). These behaviours are why re-importing an existing project is ruled out.

The MCP server has no tag support today, and its `tools/list` has about 4,400 characters of headroom under the 42,000 budget.

## Goals / Non-Goals

**Goals:**

- Every change to an existing project is made in the project, through tools whose effect is exactly the change.
- After every finished change, `template.json` equals the newest tag's template.
- Changes made outside the agent are seen before the agent plans over them.

**Non-Goals:**

- Listing stages, deploying tags, or distinguishing authoring from live stages.
- Creating stages; that stays in the portal.
- Changing what `project_import` does on the server.

## Decisions

### 1. Two tools and one argument

- **`project_tag_list`** answers "what version is this, and what versions exist", in one call. It reads the project's `tag` and the tag list.
- **`project_tag_create`** writes a version.
- **`project_export` gains `tag`**, so `template.json` is refreshed from the tag's stored template. That template is exactly what the tag captured, and it is not a re-export that might already include later edits.

`project_get` is left alone. It resolves the project locally and makes no request, so it works before login and offline; making it fetch the version would change that.

*Alternatives:* a separate `project_version_get` would cost a tool slot for one field. Fetching the version inside `project_get` would make every preflight a network call.

### 2. The comparison runs in the server, behind `compare: true`

Spotting changes made outside the agent means comparing two large templates. An agent comparing them by reading is slow and easy to get wrong, so the tool compares them and reports names.

`compare: true` exports the project and fetches the current tag's template. It then compares the two:

- roles, resources, and forms by machine name, as exported (Form.io's exporter carries only design fields);
- actions by the form they belong to plus their name.

It reports what was added, removed, and changed. It is off by default, because it costs two template transfers.

*Alternative:* comparing each form's `modified` time with the tag's `created` time is cheaper, but it misses role and action changes and any change that restores an earlier value.

### 2a. A tag export carries the project's current access

Form.io empties a template's project-level `access` when it stores a tag, so a tag's template alone would give `template.json` no project access lists, and a later first-build import of that file would apply none. `project_export` with `tag` therefore fills an empty `access` from the project's current export, fetched alongside the tag. Access a tag did store is kept. A current version with no stored tag — set by a deploy from a template, or left by deleting a tag — makes `compare: true` report that, not fail.

### 3. Errors use the existing contract

The tag routes' errors map through the server's existing status mapping. The one tag-specific case is a tag name missing from the family's list, which `project_export` reports as `NOT_FOUND` naming the tag.

### 4. Semver is checked by the tool

The tool requires `MAJOR.MINOR.PATCH` with an optional pre-release suffix, up to 32 characters. The server accepts any name, but checking here keeps a typo from becoming a version that can never be reused, since tags cannot be edited and names must be unique. Tags created in the portal under other names are still listed and exportable.

### 5. Changes to an existing project are applied, never imported

Each branch then works like this:

- **First build into an empty project** imports, as today, then tags `1.0.0`.
- **Every change after that** is a planner change plan applied with `role_create`, `form_create`, `form_update`, and `action_create`. These are applied in dependency order, behind one approval gate listing every entity, with machine names resolved to ids from the project.
- **`form_update` keeps its own rules:** read with `form_get` first, the user agrees to save without history where needed, and the note is required.

A failure stops the run and reports what was applied. Nothing is rolled back without the user, because rolling back is itself a change to a live project.

*Alternative:* re-importing a merged template overwrites changes made since the export, resets revisions, and recreates actions on every form it names.

### 6. The change plan is the template's shape, minus everything unchanged

`changes.json` uses the same `roles` / `resources` / `forms` / `actions` maps as `template.json`, containing only new entities, plus an `updates` list: each existing form to change, with the components or settings to add or alter. Keeping the shape means the planner's canonical JSON shapes in `template-json.md` still apply. It also means the extend sub-skills, which read new resource shapes from the delta pair today, read the same shapes from `changes.json`. It has no top-level `access`, and refers to existing entities by their baseline machine names.

### 7. Versioning finishes each branch, after the application code

The version is created when the feature is done, Form.io changes and application code together, so a tag marks a state the application works against. The agent proposes the next version from `current`:

- `1.0.0` for a first build;
- a minor bump for a feature;
- a patch bump for a fix.

It also proposes a one-line description, asks, and on approval creates the tag and exports it over `template.json`. This is described as how each branch finishes, not as a fifth step.

### 8. Where the skill text goes

- **New `formio-application/CHANGE.md`:** the modify-existing check, the apply gate, and the version step.
- **`IMPORT.md`:** keeps the first-build import and gains a corrected preview warning.
- **`INTENT.md` and `SKILL.md`:** carry the corrected routing.
- **`FRAMEWORK.md`'s handoff reference:** names `changesJsonPath`.
- **Planner:** gains `references/change-plan.md`.
- **Writing tools:** `project_tag_create` writes to the deployment, so it joins the shared preflight's list of writing tools in every copy.

## Risks / Trade-offs

- **[Applying many entities one call at a time is slower than one import, and can stop part-way]** → One gate lists everything first. Dependency order means anything applied before a failure is usable. The failure report names exactly what was and was not applied.
- **[`compare: true` on a large project costs two template transfers]** → It is opt-in, and runs once per change, before planning.
- **[`changes.json` updates to existing forms are a new format the planner must learn]** → Change-mode eval cases grade it, and the full-plan cases are re-run against the base commit's pass rate.
- **[Tags made in the portal under non-semver names]** → They are listed and exportable. The agent proposes the next semver from the newest semver tag, and asks.
- **[Tools added to a surface frozen for 1.0]** → The maintainer chose to ship this in 1.0, and the budget test guards the size.

## Planner eval results

**Baseline — `main` (93dec9c, before any planner edit), with-skill runs:** 130 pass / 3 fail.

| Case | Pass / fail | Failing assertion |
| --- | --- | --- |
| eval-0-task-manager-classic | 32 / 1 | Every form has a Save Submission action |
| eval-1-crm-with-company-scoping | 32 / 1 | Every form has a Save Submission action |
| eval-2-minimal-no-auth-feedback | 32 / 0 | — |
| eval-3-complex-crm-transitive | 34 / 1 | Every form has a Save Submission action |

The single failing assertion is the same in all three: the login forms carry only a Login action, which the planner prescribes, so the grader's "every form" check appears stale. It is left as-is so the after-run is graded identically.

**After the change** (`iteration-change`, same grader for the existing cases): 154 pass / 3 fail.

| Case | Baseline | After |
| --- | --- | --- |
| eval-0-task-manager-classic | 32 / 1 | 32 / 1 |
| eval-1-crm-with-company-scoping | 32 / 1 | 32 / 1 |
| eval-2-minimal-no-auth-feedback | 32 / 0 | 32 / 0 |
| eval-3-complex-crm-transitive | 34 / 1 | 34 / 1 |
| eval-4-change-time-entries (new) | — | 12 / 0 |
| eval-5-change-vendor-on-deals (new) | — | 12 / 0 |

The full-plan cases score exactly as on `main`, failing only the same stale assertion; both change-mode cases pass every assertion, including the well-formedness check added in review.

## Live validation (form.test, 2026-10-13)

This branch's server was run over stdio against `https://form.test/sandbox` (Enterprise, portal login through the browser) and every tool was called through an MCP client.

- **Version tools.** `project_tag_list` reported the project's current version `1.0.0` and its tags, newest first. `project_tag_create` created `0.0.1-mcpprobe.<n>`, which became the current version. `project_export` with `tag` returned the stored template.
- **Comparison.** `compare: true` against the old `1.0.0` reported the forms, resources, and actions added since. Against the new tag it reported nothing until a field was added, and then the one changed form.
- **Refusals.** A non-semver tag was refused as `INVALID_ARGUMENT` with no request. A duplicate tag returned `VALIDATION_FAILED` naming it, and an unknown tag `NOT_FOUND`.
- **Everything else.** `server_status`, `project_get`, `project_set` (to a subdirectory), and `form_list` passed. So did `form_create`, `form_get` (by path and by id), `form_update` (live and draft), `form_publish`, `form_revision_list`, `form_revision_get`, and `form_revert` (to revision 0, plus refusing `draft`). The role tools (`role_list`, `role_create`, `role_update`) passed, as did the action-type tools (`action_type_list`, `action_type_get`). The action tools passed through a full create, get, update, and delete cycle (`action_list`, `action_create`, `action_get`, `action_update`, `action_delete`). `project_import` passed with a one-form template, as did `project_export`.
- **Clean-up.** The probe forms, role, and tag were deleted afterwards, and sandbox's current version was restored to `1.0.0`.
- **After the review fixes.** `project_export` with `tag: "1.0.0"` returned the project's eight access entries, identical to the current export, where the stored tag holds `[]`. With the project's version set to `9.9.9`, for which no tag exists, `compare: true` returned the listing with the message "The project is at 9.9.9, which has no stored tag to compare against." and no error. The version was then restored to `1.0.0`.

## Migration Plan

Ships in 1.0 with `@formio/mcp` and `@formio/ai` minor changesets, which fold into the pending major. A workspace built before this change has a `template.json` that was never tagged. The first change run finds no current version and offers a `0.1.0` baseline tag before planning.

## Open Questions

None.
