---
'@formio/mcp': minor
'@formio/ai': minor
---

Make the Form.io project, versioned by its own tags, the source of truth, and `template.json` an export of the newest tag.

- New tools: `project_tag_list` reports the project's current version and every tag, and with `compare: true` which roles, resources, forms, and actions changed since the current tag; `project_tag_create` creates a semver tag with a description. `project_export` takes `tag` to export the template a tag stored.
- `project_import`'s description states what an import replaces — each form it names is updated in place with its actions recreated, and a template's `access` replaces the project's — and that it is for a first build.
- `formio-application` tags a first build `1.0.0` and exports it over `template.json`. Extending an existing project now checks for changes made outside the agent, plans the change with the planner's new change mode (`changes.json`), applies it with the form, role, and action tools — never a re-import — and finishes by proposing the next version, asking, tagging, and exporting it over `template.json`.
- The planner gains a change mode that emits only the new entities and the updates to existing forms.
- `platform-staging.md` documents family-wide tags, `tag/current`, and `type: 'tag'` deploys, and no longer claims a 409 for protected stages.
