## Why

After the first build, agents treat the local `template.json` as the truth about a Form.io project, but the project is what the application runs against, and anyone can change it in the portal. Once they differ, an agent that edits `template.json` and re-imports it overwrites those changes. And the import is not the merge the skills describe. Re-importing a form deletes and recreates all of its actions and resets its revision counter, and a template's `access` replaces the project's access lists. An action that names a resource missing from the template loses that link. Today `formio-application`'s modify-existing branch does exactly this, calling a planner "delta mode" that does not exist and telling the user the import is additive.

Form.io already has a versioning system: a version tag snapshots the project's export under a name and comment, and the project records which tag it is at. This change makes the project, versioned by those tags, the source of truth, and makes `template.json` an export of the newest tag that the agent never edits. It replaces proposal 7 (`add-planner-delta-mode`) from the 1.0 plan.

## What Changes

- **New MCP tools** (in the 1.0 tool surface):
  - `project_tag_list` returns the current version of the project the folder resolves to, plus every tag (name, description, created), newest first. With `compare: true` it also reports which roles, resources, forms, and actions differ from the current tag — changes made outside the agent.
  - `project_tag_create` creates a semver tag with a description on that project, snapshotting its current state.
- **`project_export` gains `tag`**: exports the template a named tag stored instead of the project's current state.
- **`formio-application`, first build:** unchanged through import; then the agent asks to create tag `1.0.0` with a comment, and exports that tag over `template.json`.
- **`formio-application`, every later change:**
  - **Check:** `project_tag_list` with `compare: true`; changes made outside the agent are shown, and the agent offers to capture them as a patch tag first.
  - **Plan:** the planner produces a change plan — `template.md` gains a dated change section, and `changes.json` holds only the new entities, in the template's own shape, plus the updates to existing forms.
  - **Apply:** the agent applies the change plan with the existing tools (`role_create`, `form_create`, `form_update`, `action_create`), never with `project_import`.
  - **Version:** when the feature is finished, the agent proposes the next semver tag and a comment, asks, creates it, and exports it over `template.json`.
- **No re-import of an existing project.** `project_import` is for a first build into a project with no content of its own; the skills never edit `template.json` and never re-import it.
- **Corrected claims:** the "import is additive" wording in `formio-application` and `project_import`'s "merges, it does not replace" description; `platform-staging.md`'s nonexistent 409 for protected stages, and its missing `type: 'tag'` deploy and `tag/current` endpoint.
- **Deploying a tag to another stage** stays outside the agent — the portal or the user's own CI/CD — and the skills say so once. No skill distinguishes stages; the folder's project is the one being authored.

## Capabilities

### New Capabilities

- `project-tags`: the `project_tag_list` and `project_tag_create` MCP tools.

### Modified Capabilities

- `project-export`: `tag` argument; description.
- `project-import`: description states the replace semantics and that it is for a first build.
- `formio-application-skill`: first-build tagging, the modify-existing check → plan → apply → version flow.
- `formio-resource-planner-skill`: the change-plan mode and its eval cases.
- `api-skills-library`: `platform-staging.md` corrections; router tool list.

## Impact

- Every Form.io deployment this toolkit targets is Enterprise, so version tags are always available; there is no fallback for deployments without them.

- `packages/mcp-server`: two tools, one argument, tests; tools/list stays under the 42,000-character budget (about 4,400 free today).
- `plugin/skills`: `formio-application` (`SKILL.md`, `INTENT.md`, `IMPORT.md`, a new `CHANGE.md`, `FRAMEWORK.md` handoff fields), `formio-resource-planner` (change-plan reference), `formio-api` (router list, `platform-staging.md`), every copy of the shared preflight's list of writing tools.
- `packages/skill-tests`: tests per requirement; planner eval cases for the change plan, with a baseline run before the change.
- READMEs listing the tools; `CLAUDE.md`.
- Changesets: `@formio/mcp` minor and `@formio/ai` minor, folding into the pending 1.0 major.
