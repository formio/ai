# Phase B emission — transcript requirements, actions, and output order

The exact Phase B emission rules for `formio-resource-planner`. Read this after the user approves the Resource Map and before emitting the `template.md` + `template.json` pair.

## Transcript requirements

The markdown block MUST follow the section order in [`template-md.md`](template-md.md) exactly: `# Resource Map — <App Name>` → `## Resources` → (optional `## Forms`, only when the app has bespoke data-collection forms) → `## Users & Auth` → `## Roles` → `## Access Matrix` → `## ER Diagram` → `## Access Flow Diagram` → `## Companion artifact`. Downstream graders and consumer skills key on these exact headings.

The `## ER Diagram` and `## Access Flow Diagram` sections in `template.md` MUST contain **Mermaid** fenced blocks (` ```mermaid\nerDiagram\n...``` ` and ` ```mermaid\nflowchart TD\n...``` ` respectively) — not ASCII. ASCII is for Phase A's chat-approval gate only. Every resource and join named in `## Resources` must appear as a node in both Mermaid blocks. See [`template-md.md`](template-md.md) → "ER Diagram section" and "Access Flow Diagram section" for the exact shapes, cardinality vocabulary, and worked examples for the three canonical patterns (owner-only, direct-child group, transitive group).

The JSON block MUST be a valid, importable Form.io template. Read [`template-json.md`](template-json.md) for the full schema, component shapes, action shapes, and access-array rules before writing. Do not improvise structure. The top-level keys are always, in **exactly** this order: `title`, `version`, `name`, `roles`, `forms`, `actions`, `resources`, `access`. Include all eight keys — `forms`, `actions`, and `resources` may be empty objects when the map has no entries, but the keys themselves are not optional, and `access` must be a non-empty project-level access array (see the "Top-level `access`" section in the reference). An optional `description` key may be placed immediately after `title`; omit it entirely otherwise.

## Actions emission — per use-case

Emission algorithm (run this exactly once per template.json, right before writing the file):

1. **Walk every `resources` entry.** A Resource almost always exists to store records, so it normally gets an action keyed `"<name>:save"` — see [`template-json.md`](template-json.md) → "Save Submission (anything that persists)". Add it unless the resource is deliberately client-only (data used in the browser, never sent to the submission API); if you think one is, decide deliberately. Join resources (`ProjectUser`, `TeamUser`) need Save too — Group Assignment does not replace Save; they co-exist.
2. **Walk every `forms` entry.** A Form gets a `"<name>:save"` only when it is meant to persist its submission. Add it for ordinary data-collection forms (job applications, surveys, intake). **Omit it** when the form does not persist, for example: a **login form** (authenticates an existing user; emit only `<name>:login` — a plain `<name>:save` with empty `settings` is optional, used only when the user wants a login audit trail), a **notification-only form** (fires an Email or Webhook but stores nothing), or a **client-only form** (e.g. an embedded Search form whose data the app reads in the browser to build a query — no actions at all). When you do add Save and the form legitimately writes into a different resource than itself (e.g., a `userRegister` form writes into the `user` resource), set `settings.resource` to the target resource's machine name — see [`template-json.md`](template-json.md) → "Save Submission (on a register form — writes into `user` resource)". **A login-form `save` must NEVER set `settings.resource`** — pointing it at any resource makes every login attempt create a brand-new record there.
3. **Auth-form actions.** For the login form, add a Login action (`"<form>:login"`). For the register form, add a Role Assignment action (`"<form>:role"`) that assigns the default authenticated role, AND a Login action so the user is signed in immediately on successful registration. Order: Save → Role Assignment → Login — all three live under the same register form's action keys.

   **Login action `settings.resources` — For most cases, emit `["user"]`.** The Login action's `settings.resources` is an array of user-type resource machine names the login form will authenticate against. Emit `["user"]` unless the the prompt specifically indicates that "admins" will use the application, in which case emit `["admin"]` for ONLY admins, and `["user", "admin"]` if both users and admins can login.

   **Multi-role user systems — one conditional Role Assignment per persona.** This applies only when the plan puts all personas on ONE shared user resource (the common default). When the plan instead calls for a resource per role (e.g., a separate `admin` resource, Login `settings.resources: ["user", "admin"]`), skip it — each user-type resource gets its own unconditional Role Assignment on create, and no selectboxes are needed. When the plan's `## Roles` section has TWO OR MORE assignable (non-default) roles on one user resource — e.g., `student` / `collegeAdmin` / `scholarshipAdmin` — the register form's single Role Assignment is not enough: it only covers the self-register persona, and the remaining personas have NO working assignment path, because the API strips direct `roles` writes on submissions (POST/PUT/PATCH, even as project owner). Emit BOTH halves of the multi-role pattern into `template.json`: (a) a `role` selectboxes component on the `user` resource with one value per assignable persona, and (b) one conditional Role Assignment action per persona keyed `"user:role<Persona>"`, gated with `condition: { conjunction: "all", conditions: [{ component: "role", operator: "isEqual", value: "<persona>" }], custom: "" }`. Exact shapes: [`template-json.md`](template-json.md) → "Multi-role user systems — role selectboxes + one conditional Role Assignment per role". A plan whose `Admin operations` line says "assign roles via the portal" WITHOUT these actions is a bug — the portal edits the same user form, so it needs the selectboxes + conditional actions to work at all.

   **Admin-only work goes through the Form.io portal, not the app login form.** If the plan has administrator-only responsibilities (seeding reference data, creating group-membership rows, assigning roles to users, reviewing submissions, moderating content), those are performed by an administrator signing in to the Form.io **project portal** for this project — the same portal URL the developer uses to manage the project's forms, resources, and submissions. Do NOT design the app's in-app login surface around administrator access. Instead, capture the admin-only operations in `template.md`'s `## Users & Auth → Admin operations` line so downstream skills and the end user see which tasks need the portal.

4. **Join resources with group-based access.** Every join resource that implements group-level access (e.g., `ProjectUser`, `TeamUser`, `CompanyUser`) needs a Group Assignment action keyed `"<join>:group"`. The action's `settings.group` MUST match the field key on the join whose `select` points at the group resource; `settings.user` MUST match the field key whose `select` points at the user resource. A join without Group Assignment stores rows but never grants access — the whole group-access model is dead.

Minimum viable action set per resource type:

| Resource / form type | Required action keys in `actions` |
| --- | --- |
| Plain resource (`Project`, `Task`, etc.) | `<name>:save` |
| `user` resource | `user:save` |
| Login form (e.g., `userLogin`) | `userLogin:login` (optional plain `userLogin:save` for audit only — never with `settings.resource`) |
| Register form (e.g., `userRegister`) | `userRegister:save`, `userRegister:role`, `userRegister:login` |
| Join resource with group access (`ProjectUser`) | `projectUser:save`, `projectUser:group` |
| Join resource WITHOUT group access | `<join>:save` |
| Any form mentioned as sending email / webhook | the required set above PLUS `<name>:email` / `<name>:webhook` |

Priority ordering inside `actions`: Save always has the lowest priority number relative to the others on the same form (runs first — persist before downstream actions read the submission). Role Assignment runs after Save (needs the submission `_id`). Login runs last on register forms (issues the JWT once the role is attached). Use the priority values shown in [`template-json.md`](template-json.md); do not invent new numbers.

**Self-check before emit — actions block.** For each resource and form, confirm its actions match its intent: anything meant to persist to the submission API has a `<name>:save`; a client-only form/resource (data used in the browser only, e.g. a Search form) may correctly have none. The failure to hunt for is a persisting resource or form with no Save — that silently drops submissions. Then check the roles: if `roles` declares 2+ assignable personas, the `user` resource MUST carry the `role` selectboxes component and one conditional `user:role<Persona>` action per persona — a multi-role plan without them leaves every non-self-register persona unassignable (direct `roles` writes are stripped by the API). Then check every login form: if it has a `save` (audit trail), its `settings` MUST be empty — a login-form `save` with `settings.resource` set is always a bug; strip the `resource` key.

The generic-self-check section at the bottom of [`template-json.md`](template-json.md) includes the "Every resource or form meant to persist has a Save Submission action" line; this section restates why that line is load-bearing — the accidental missing-Save on a persisting form is the bug to catch, while a deliberately action-less client-only form is fine.

## Order in the transcript

Render the markdown block first, then the JSON block — so a user reading the transcript top-to-bottom sees the narrative (with both ASCII diagrams) before the wall of JSON. The ASCII diagrams are already inside the markdown block; no need to re-print them separately.

After both blocks, tell the user the filenames that were written to disk (using the paired collision-aware names from above). One line:

```
Wrote ./template.md and ./template.json.
```

Then finish with a short "Next steps" section:

```
### Next steps

- **Import directly**: `project_import` (MCP tool) with the contents of `template.json`; fall back to `curl -X POST -H "x-jwt-token: $JWT" -H "Content-Type: application/json" -d "{\"template\": $(cat template.json)}" $FORMIO_PROJECT_URL/import` only when the MCP server is unavailable
- **Or pass the pair to another skill / tool**:
  - `form_create` (MCP tool) for each entry under `resources` and `forms` in `template.json`
  - `action_create` (MCP tool) for each entry under `actions`; the REST shapes live in `formio-api/references/project-actions` if the MCP server is unavailable
  - `role_create` (MCP tool) for the non-default roles listed under `roles`; REST fallback in `formio-api/references/project-roles`
  - Framework scaffolders (`formio-angular/formio-angular-resources`, future `formio-react`, …) — hand them BOTH `template.md` (architectural intent) and `template.json` (structured reference). The `.md` is the seed they reason from; the `.json` is the structured companion they consult for field-level shapes.
```
