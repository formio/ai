# CHANGE — Change an existing project, then version it

This document is loaded by the parent `formio-application` skill on the modify-existing branch, at Steps 2 and 3, and on both branches when the work is finished. It is **not** a standalone skill — no frontmatter.

## The source of truth

The Form.io project the working directory resolves to is the source of truth, versioned with Form.io's own version tags. `template.json` is an export of the newest tag: never edit it to change the project, and never re-import it into a project that already has content. A re-import updates every form it names in place, deletes and recreates that form's actions, and replaces the project's access lists with the template's — it would overwrite whatever changed in the project since the export. Changes are made in the project with the form, role, and action tools; `template.json` is refreshed afterwards by exporting the new tag.

## Before Step 2 — check the project against its current version

This is the modify-existing branch's first deployment-touching call, so run the Preflight here (tools check, then `project_get`) rather than waiting for Step 3.

Call `project_tag_list` with `compare: true` and `cwd` set to the directory the Preflight's `project_get` reported. It reports the project's current version, every tag, and what changed since the current version.

- **Changes since the current version.** Someone changed the project outside this workflow — the portal, another tool, another person. Show the user what changed (by kind and name), say that the plan is made against the project as it is now, and offer to capture those changes first as a patch tag (the current version with its patch number raised, for example `1.2.0` → `1.2.1`, with a description naming the outside changes). Either answer continues; the plan never discards them.
- **No current version.** The project was never tagged — built in the portal, or by this skill before versioning. Offer to create a baseline tag `0.1.0` ("Baseline before changes") so the change has a version to be compared against. Either answer continues.
- **No changes.** Continue.

The baseline the planner reads is the template of the current tag (`project_export` with `tag`) when nothing changed since it, and `project_export` of the project's current state otherwise. Write it beside the workspace's other planner files and pass its path to the planner as the baseline, with the user's feature request. The planner then runs its change mode — [`change-plan.md`](../formio-resource-planner/references/change-plan.md) — and emits a dated change section in `template.md` and `changes.json`: in the template's own shape, only the roles, resources, forms, and actions the change creates, plus an `updates` list of the existing forms it changes. Stash the `changes.json` path and the names of the new resources for Step 4.

## Step 3 — apply the change plan

Never call `project_import` on this branch. Apply `changes.json` with the granular tools instead, so each call changes exactly what the plan names and nothing else.

**The approval gate.** Before any call, show one list of everything that will change, in the order it will be applied, and ask once:

```
About to change <projectUrl>:

  Create role       <name>, ...
  Create resource   <name>, ...
  Create form       <name>, ...
  Update form       <name>: <what changes>, ...
  Create action     <form>:<action>, ...

Proceed?
```

**The order.** Apply roles, then resources, then forms, then actions, so every reference resolves to something that already exists:

1. `role_create` for each new role.
2. `form_create` for each new resource, then each new form. Replace each role and resource machine name in an `access` or `submissionAccess` list, and in a resource select's `data.resource`, with the `_id` the project has for it — from `role_list` and `form_get`, or from the create call just made.
3. For each entry in `updates`: `form_get` the stored form, apply the change to it, and `form_update` it with a `note` naming the change. When `form_update` asks for agreement to save without history, relay that to the user rather than answering it yourself.
4. `action_create` for each new action, on its form's `_id`, with resource machine names in its settings resolved to `_id`s the same way.

**A failure stops the run.** Report what was applied and what was not, by name, and the error. Do not retry with different values and do not roll back what was applied: undoing is itself a change to the project, so it waits for the user's say-so.

## Finishing — version the project

When the work is finished — the Form.io changes and the application code that uses them — version the project. This applies to both branches: on build-new it follows the import and the framework handoff.

1. **Propose the version.** From the `current` version `project_tag_list` reports: `1.0.0` for a first build; a minor bump for a feature (`1.2.0` → `1.3.0`); a patch bump for a fix (`1.2.0` → `1.2.1`). Write a one-line description of what changed (at most 256 characters).
2. **Ask.** Show the proposed version and description and ask before creating it; the user may change either.
3. **On approval:** create it with `project_tag_create`, then call `project_export` with `tag` set to that version and write the result over `template.json`. Say which version `template.json` now holds.
4. **If the user declines:** create nothing, leave `template.json` as it is, and say that the project's changes are untagged and `template.json` does not include them.

Deploying a version to another stage is not done here — that is the portal's or the user's own CI/CD.
