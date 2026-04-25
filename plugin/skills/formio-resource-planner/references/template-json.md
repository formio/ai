# Form.io `template.json` reference

Canonical shape for a Form.io project export. Same document you get from `GET /{projectName}/export` and can POST to `/{projectName}/import` as `{ "template": <the json> }`.

When emitting Phase B of the `formio-resource-planner` skill, follow this reference verbatim. The shapes, defaults, and ordering are not negotiable — Form.io parses strictly.

## Top-level

```jsonc
{
  "title": "Human Readable Title", // required; shown in portal UI
  "version": "2.0.0", // always "2.0.0" for current Form.io
  "name": "machineName", // required; camelCase, unique per deployment
  "roles": {
    /* role map */
  },
  "forms": {
    /* form map */
  }, // may be {} — key is still required
  "actions": {
    /* action map */
  }, // may be {} — key is still required
  "resources": {
    /* resource map */
  }, // may be {} — key is still required
  "access": [
    /* top-level project-access array — see `Top-level access` below */
  ],
}
```

**Emit these eight keys in EXACTLY this order, every time:** `title`, `version`, `name`, `roles`, `forms`, `actions`, `resources`, `access`. Form.io's importer is tolerant of other orderings, but downstream diff tools, grading scripts, and human reviewers key off this layout — drifting from it produces noisy diffs and gradebook failures even when the template is semantically valid. `forms`, `actions`, and `resources` may be empty objects but the keys must exist; `access` must be a non-empty array (see below). A `description` key is optional — if you include it, place it immediately after `title` so it reads like human-facing prose at the top of the file; otherwise omit entirely.

## Roles

```jsonc
"roles": {
  "administrator": {
    "title": "Administrator",
    "description": "A role for Administrative Users.",
    "admin": true,
    "default": false
  },
  "authenticated": {
    "title": "Authenticated",
    "description": "A role for Authenticated Users.",
    "admin": false,
    "default": false
  },
  "anonymous": {
    "title": "Anonymous",
    "description": "A role for Anonymous Users.",
    "admin": false,
    "default": true     // exactly one role should be default: true
  }
}
```

Every project has these three by default. Add custom roles with `admin: false, default: false`; describe each one's capability in the `description`.

## Top-level `access`

The top-level `access` array controls who can perform **project-scoped** operations — listing the project's forms, creating new forms at the project level, reading the project itself, etc. It is distinct from the per-resource `access` array (which controls reading the resource definition) and from `submissionAccess` (which controls reading/writing submission rows). Every template MUST include a top-level `access` array.

Default shape — grant `read_all` to the three default roles so the project is discoverable, and restrict all write operations to `administrator`:

```jsonc
"access": [
  { "type": "create_all", "roles": ["administrator"] },
  { "type": "read_all",   "roles": ["administrator", "authenticated", "anonymous"] },
  { "type": "update_all", "roles": ["administrator"] },
  { "type": "delete_all", "roles": ["administrator"] }
]
```

Notes:

- This is a literal array of `{ type, roles }` objects — same vocabulary as `submissionAccess`, different scope.
- Unless the plan says otherwise, emit the default shape above verbatim. Tightening it (e.g., dropping `anonymous` from `read_all`) locks anonymous users out of the portal's form list and usually is NOT what the user wants.
- If the plan includes custom roles that should see the project (e.g., `moderator`, `salesRep`), add them to `read_all`. Never add custom roles to `create_all` / `update_all` / `delete_all` — those are administrator-only operations.
- `access` MUST be the LAST key in the emitted template.json, after `resources`. That ordering is what makes the project's data model (resources/forms/actions) readable before the access footer.

## Resources & Forms — shared shape

`resources` and `forms` are parallel maps; both entries use the same schema except for `type`:

- `type: "resource"` for data resources (Project, Task, User, CompanyUser, etc.)
- `type: "form"` for user-facing forms that are not persistent data resources (login forms, public submission forms, signup forms)

```jsonc
"<machineNameKey>": {
  "title": "Human Readable Title",
  "type": "resource",              // or "form"
  "name": "machineName",           // matches the map key; camelCase
  "path": "url-path",              // kebab-case; served at ${FORMIO_PROJECT_URL}/<path>
  "tags": [],                      // freeform, often ["join"] for join resources
  "components": [ /* ... */ ],
  "access":           [ /* ... */ ],
  "submissionAccess": [ /* ... */ ]
}
```

## `access` vs `submissionAccess` — keep these straight

- **`access`** — who can **read the form/resource definition** (the component tree, not the data). For resources, the default is wide open: grant `read_all` to `administrator`, `anonymous`, and `authenticated`. Locking this down is rarely what anyone wants.
- **`submissionAccess`** — who can **create/read/update/delete submissions** (the actual data rows). This is where row-level access policy lives.

### Default `access` for every resource

```jsonc
"access": [
  {
    "type": "read_all",
    "roles": ["administrator", "anonymous", "authenticated"]
  }
]
```

### Default `access` for a public form (login, register, public feedback)

Same wide-open default is fine. If the user wants the login page hidden from authenticated users (unusual), constrain it to `anonymous` only — but most deployments leave it open.

### `submissionAccess` — the access-control story

Common combinations:

```jsonc
// Admin-only resource (joins, system records):
"submissionAccess": [
  { "type": "create_all", "roles": ["administrator"] },
  { "type": "read_all",   "roles": ["administrator"] },
  { "type": "update_all", "roles": ["administrator"] },
  { "type": "delete_all", "roles": ["administrator"] }
]

// Owner-level access (user-owned records):
"submissionAccess": [
  { "type": "create_all", "roles": ["administrator"] },
  { "type": "read_all",   "roles": ["administrator"] },
  { "type": "update_all", "roles": ["administrator"] },
  { "type": "delete_all", "roles": ["administrator"] },
  { "type": "read_own",   "roles": ["authenticated"] },
  { "type": "update_own", "roles": ["authenticated"] }
]

// Public submit, admin read (feedback, contact us):
"submissionAccess": [
  { "type": "create_own", "roles": ["anonymous"] },
  { "type": "read_all",   "roles": ["administrator"] },
  { "type": "update_all", "roles": ["administrator"] },
  { "type": "delete_all", "roles": ["administrator"] }
]

// Login / register forms (data goes to the user resource, not here):
"submissionAccess": [
  { "type": "create_own", "roles": ["anonymous"] }
]
```

Group-based access (row-level, driven by a Group Assignment action on a join resource) is enforced at runtime by the action — you don't encode it in `submissionAccess` on the child resources. See "Group Assignment action" below.

## Component shapes

Every `components` array ends with a submit button. Each input component has at minimum `type`, `key`, `label`, `input: true`.

### textfield

```jsonc
{
  "type": "textfield",
  "key": "name",
  "label": "Project Name",
  "validate": { "required": true },
  "input": true,
  "tableView": true,
}
```

### textarea

```jsonc
{
  "type": "textarea",
  "key": "description",
  "label": "Description",
  "input": true,
  "tableView": false,
  "autoExpand": false,
}
```

### email (on user resource — always `unique: true`)

```jsonc
{
  "type": "email",
  "key": "email",
  "label": "Email",
  "inputType": "email",
  "placeholder": "Enter your email address",
  "persistent": true,
  "unique": true,
  "protected": false,
  "input": true,
  "tableView": true,
}
```

### password (user resource only)

```jsonc
{
  "type": "password",
  "key": "password",
  "label": "Password",
  "inputType": "password",
  "placeholder": "Enter your password.",
  "persistent": true,
  "protected": true,
  "input": true,
  "tableView": false,
}
```

### number

```jsonc
{
  "type": "number",
  "key": "amount",
  "label": "Amount",
  "input": true,
  "tableView": true,
}
```

### datetime

```jsonc
{
  "type": "datetime",
  "key": "dueDate",
  "label": "Due Date",
  "format": "yyyy-MM-dd",
  "enableDate": true,
  "enableTime": false,
  "input": true,
  "tableView": true,
}
```

### select — static values

```jsonc
{
  "type": "select",
  "key": "status",
  "label": "Status",
  "dataSrc": "values",
  "data": {
    "values": [
      { "label": "Open", "value": "open" },
      { "label": "In Progress", "value": "inProgress" },
      { "label": "Done", "value": "done" },
    ],
  },
  "defaultValue": "open",
  "input": true,
  "tableView": true,
}
```

### select — reference to another resource (Form.io's foreign key)

Use `"reference": true` and **omit** `valueProperty`. With `reference: true`, Form.io stores a proper submission reference (not just a raw `_id` string), which lets it resolve the link — including transitively through multi-level resource hierarchies — at read time. A bare `valueProperty: "_id"` only stores the ObjectId string and breaks hierarchy traversal once you add a third level (e.g., Task → Project → Team).

```jsonc
{
  "type": "select",
  "key": "project",
  "label": "Project",
  "widget": "choicesjs",
  "placeholder": "Select a project",
  "dataSrc": "resource",
  "data": { "resource": "project" }, // must match the resource's machineName key
  "template": "<span>{{ item.data.name }}</span>", // how each option renders
  "reference": true, // store as a resolvable reference, not a bare _id
  "searchField": "data.name__regex", // typeahead filter
  "validate": { "required": true },
  "input": true,
  "tableView": true,
}
```

Never add `valueProperty` to a `dataSrc: "resource"` select — the `reference: true` + omitted `valueProperty` pattern is the Form.io canonical shape for referencing another resource.

### select — reference to a **group** resource (field-based submission access)

When this select points at a resource that acts as the **group** for a Group Assignment action (e.g., `Task.project` points at `Project`, which is the group), the select component itself carries a `submissionAccess` block with four empty-role entries. This is how Form.io propagates the group's ACL to the child resource. Without this block, child-resource access does **not** inherit from the group and group permissions don't work end-to-end.

```jsonc
{
  "type": "select",
  "key": "project",
  "label": "Project",
  "widget": "choicesjs",
  "placeholder": "Select a project",
  "dataSrc": "resource",
  "data": { "resource": "project" },
  "template": "<span>{{ item.data.name }}</span>",
  "reference": true, // store as a resolvable reference, not a bare _id
  "searchField": "data.name__regex",
  "validate": { "required": true },
  "input": true,
  "tableView": true,

  // Field-based resource access — copy verbatim.
  // Roles are intentionally empty arrays: permissions are resolved
  // at runtime from the Group Assignment action's stored ACLs on the
  // referenced submission, not from static role lists.
  "submissionAccess": [
    { "type": "read", "roles": [] },
    { "type": "create", "roles": [] },
    { "type": "update", "roles": [] },
    { "type": "delete", "roles": [] },
  ],
}
```

When to include this block: on **every** child-resource `select` component that references a resource acting as a group. Examples:

- `Task.project` where `Project` is the group (membership via `ProjectUser` join)
- `Contact.company` where `Company` is the group (membership via `CompanyUser` join)
- `Deal.company` where `Company` is the group

When **not** to include it: on selects that are not group references — e.g., `Task.assignee` (pointing at User), `Deal.contacts` (pointing at Contact as an attachment), a status lookup, any static-value select. These use the plain `select` shape without `submissionAccess`.

### select — transitive group-access mirror (for sub-resources 2+ levels from the group)

When a resource is **two or more levels below** the group in the hierarchy (e.g., `Contact`/`Deal`/`Activity` under `Account`, where `Team` is the group on `Account`), the sub-resource cannot simply point at the group resource — it has no direct relationship to the group. Instead, it carries **two** reference selects:

1. A **normal parent reference** pointing at the immediate parent (e.g., `account` on `Contact`), using the standard resource-select shape (`reference: true`, no `submissionAccess`). This is what the user picks.
2. A **hidden, calculated mirror of the group field** (e.g., `team` on `Contact`), auto-populated from the parent's group value. This carries the four-entry `submissionAccess` block that actually propagates group access to the sub-resource.

The mirrored field is invisible to the user — it exists purely to carry the group reference into the sub-resource's submission so Form.io can enforce group access on reads.

```jsonc
{
  "label": "Team",
  "key": "team",
  "type": "select",
  "widget": "choicesjs",
  "placeholder": "Select the team",
  "dataSrc": "resource",
  "data": { "resource": "team" },
  "template": "<span>{{ item.data.name }}</span>",

  // Critical behaviour for transitive group access:
  "hidden": true, // not shown to the user
  "calculateValue": "value = data.account.data.team;", // auto-populate from parent's group field
  "refreshOn": "account", // recalc when the parent changes

  "validate": { "required": true },
  "reference": true, // same as any resource select
  "input": true,
  "tableView": true,

  // Same field-based access block as the direct group-reference select:
  "submissionAccess": [
    { "type": "read", "roles": [] },
    { "type": "create", "roles": [] },
    { "type": "update", "roles": [] },
    { "type": "delete", "roles": [] },
  ],
}
```

**The calculateValue expression** follows a fixed pattern: `value = data.<parentKey>.data.<groupKey>;`

- `<parentKey>` — the key of the immediate parent's select on this form (e.g., `account`).
- `<groupKey>` — the key of the group-reference select on the parent resource (e.g., `team`).

Because the parent's select uses `reference: true`, Form.io resolves the parent into a full submission object on read, so `data.account.data.team` walks through the resolved account's data to find its team value. The mirror also uses `reference: true` — it stores the same kind of resolvable reference as the original.

**What makes this different from the direct group-reference select.** Only three properties: `hidden: true` (invisible), `calculateValue` (auto-populated from parent), and `refreshOn` (recalculates when parent changes). Everything else — `reference: true`, the `submissionAccess` block, `validate.required` — is identical to a normal group-reference select.

**When to add a mirrored group field.** Any resource that sits two or more hops from the group in the ER graph and needs to inherit the group's access. Walk the path from the resource to the group: if you have to traverse more than one `select` to get there, add a mirror. A single-hop child (e.g., `Account.team`) uses the direct group-reference select pattern — no mirror needed.

**Where to put it in the form.** Put the mirrored field adjacent to the parent reference (usually right after it). The user won't see it because `hidden: true`, but it keeps the form definition readable for whoever maintains the template.

### select — multiple references (1:N embedded or N:N as attachment)

Add `"multiple": true` to the resource-select above. Use when the relationship carries no data of its own; otherwise model it as a join resource.

### submit button

```jsonc
{
  "type": "button",
  "key": "submit",
  "label": "Submit",
  "action": "submit",
  "theme": "primary",
  "disableOnInvalid": true,
  "input": true,
}
```

## The canonical `user` resource

Always include the `user` resource when the project has authentication. Its shape is fixed:

```jsonc
"user": {
  "title": "User",
  "type": "resource",
  "name": "user",
  "path": "user",
  "tags": [],
  "components": [
    { "type": "email",    "key": "email",    "label": "Email",    "persistent": true, "unique": true, "protected": false, "inputType": "email", "placeholder": "Enter your email address", "input": true, "tableView": true },
    { "type": "password", "key": "password", "label": "Password", "persistent": true, "protected": true, "inputType": "password", "placeholder": "Enter your password.", "input": true, "tableView": false },
    { "type": "button",   "key": "submit",   "label": "Submit",   "action": "submit", "theme": "primary", "disableOnInvalid": true, "input": true }
  ],
  "access": [
    { "type": "read_all", "roles": ["administrator", "anonymous", "authenticated"] }
  ],
  "submissionAccess": [
    { "type": "create_all", "roles": ["administrator"] },
    { "type": "read_all",   "roles": ["administrator"] },
    { "type": "update_all", "roles": ["administrator"] },
    { "type": "delete_all", "roles": ["administrator"] },
    { "type": "read_own",   "roles": ["authenticated"] },
    { "type": "update_own", "roles": ["authenticated"] }
  ]
}
```

Add extra fields (firstName, lastName, profile photo, etc.) after `email`/`password` and before `submit` if the user described a custom user shape.

## Actions

**Actions are mandatory.** The top-level `actions` map is not decoration — it is where Form.io persists submissions and enforces access. A `template.json` whose `actions` map does not contain a `save` entry for each resource and form is broken on arrival: the forms render, accept input, and then drop every submission, because nothing is wired to write them to MongoDB. Every entry in `resources` AND every entry in `forms` MUST contribute at least one key to the `actions` map.

Minimum set per resource/form type (reference — the planner SKILL.md `Actions emission — required per resource` section re-states the algorithm):

| Resource / form type                           | Required `actions` keys                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Plain resource (Project, Task, …)              | `<name>:save`                                                      |
| `user` resource                                | `user:save`                                                        |
| Login form                                     | `<name>:save`, `<name>:login`                                      |
| Register form                                  | `<name>:save`, `<name>:role`, `<name>:login`                       |
| Join resource with group-based access          | `<name>:save`, `<name>:group`                                      |
| Join resource without group access             | `<name>:save`                                                      |
| Any form that sends email / calls a webhook    | the above plus `<name>:email` / `<name>:webhook`                   |

Each action is keyed `"<formMachineName>:<actionName>"`. Fields:

- `title`: human-readable
- `name`: the action type — `save`, `login`, `role`, `group`, `email`, `webhook`, etc.
- `form`: the machineName of the form/resource the action runs on
- `priority`: integer — higher runs later within the same handler phase
- `method`: `["create"]`, `["update"]`, or `["create", "update"]`
- `handler`: `["before"]` or `["after"]`
- `settings`: action-specific payload

### Save Submission (default on every form/resource)

Every form and resource gets a Save Submission action by default. Include one per form/resource in the `actions` map:

```jsonc
"project:save": {
  "title": "Save Submission",
  "name": "save",
  "form": "project",
  "priority": 10,
  "method": ["create", "update"],
  "handler": ["before"]
}
```

### Save Submission (on a register form — writes into `user` resource)

For a register form that forwards its data into the `user` resource:

```jsonc
"userRegister:save": {
  "title": "Save Submission",
  "name": "save",
  "form": "userRegister",
  "priority": 11,
  "method": ["create", "update"],
  "handler": ["before"],
  "settings": {
    "resource": "user",
    "fields": {
      "email":    "email",
      "password": "password"
    }
  }
}
```

### Login

Attached to any form with email/password fields that should issue a JWT:

```jsonc
"userLogin:login": {
  "title": "Login",
  "name": "login",
  "form": "userLogin",
  "priority": 2,
  "method": ["create"],
  "handler": ["before"],
  "settings": {
    "resources": ["user"], // always just ["user"] — do NOT add "admin"; see rule below
    "username": "email",
    "password": "password",
    "allowedAttempts": 5,
    "attemptWindow": 30,
    "lockWait": 1800
  }
}
```

#### `settings.resources` — always `["user"]`

`settings.resources` is an array of user-type resource machine names the login form authenticates against. Emit `["user"]` and nothing else. Do NOT add `"admin"` (or any other built-in user-type resource name the template does not itself declare) — doing so causes Form.io's project importer to reject the template.

Administrator responsibilities (seeding reference data, creating group-membership rows, assigning roles, reviewing/moderating submissions, inviting users) are performed by an administrator signing in to the **Form.io project portal** — the same portal used to manage forms, resources, and submissions at the project level. The app's login form is for end users only.

On register forms that should log the user in immediately after signup, attach a Login action too (same settings, form points to the register form, same `resources: ["user"]`).

### Role Assignment

Grants a role when a submission is created. Typically on a register form.

```jsonc
"userRegister:role": {
  "title": "Role Assignment",
  "name": "role",
  "form": "userRegister",
  "priority": 1,
  "method": ["create"],
  "handler": ["after"],
  "settings": {
    "association": "new",    // "new" for the submitter, "existing" to target a field
    "type": "add",            // "add" | "remove"
    "role": "authenticated"   // role's machineName key from `roles`
  }
}
```

### Group Assignment (Group Permissions) — has two halves

Group-based access is configured in **two places** that must be in sync. Missing either half leaves the group permissions broken:

**Half 1 — the action on the join resource.**

Attach Group Assignment to the join resource (e.g., `ProjectUser`, `CompanyUser`) whose two fields identify a group and a user. The action stores ACLs on the referenced group submissions at runtime.

```jsonc
"projectUser:group": {
  "title": "Group Assignment",
  "name": "group",
  "form": "projectUser",
  "priority": 5,
  "method": ["create"],
  "handler": ["after"],
  "settings": {
    "group": "project",   // field key on the join resource that identifies the group
    "user":  "user"        // field key on the join resource that identifies the user
  }
}
```

Do not attach Group Assignment to non-join resources.

**Half 2 — field-based `submissionAccess` on every child's group-reference select.**

Every child resource that should inherit the group's access (e.g., `Task` inheriting from `Project`, `Contact`/`Deal` inheriting from `Company`) needs a `submissionAccess` block on its `select` component that points at the group resource. See "`select` — reference to a **group** resource" in the Component shapes section above for the exact shape. The four empty-role entries (`read`, `create`, `update`, `delete`) tell Form.io to resolve access at runtime by looking up the referenced submission's ACL, populated by the Group Assignment action on the join.

Without Half 2, a logged-in user with a ProjectUser membership can see the Project row but **cannot** see the Tasks attached to it — the child's access does not automatically propagate.

**Transitive access — 2+ levels below the group.**

When a resource is not a direct child of the group but a grandchild (or deeper) — e.g., `Contact` under `Account`, with `Team` as the group on `Account` — half 2 cannot point at the group directly because the sub-resource has no relationship with the group. Instead, add **both** a parent reference and a hidden, calculated mirror of the group field to the sub-resource. The mirror is invisible, auto-populated from the parent, uses `reference: false`, and carries the same four-entry `submissionAccess` block.

See "`select` — transitive group-access mirror" in Component shapes for the exact shape and the `calculateValue` pattern. Every level of the hierarchy below the direct child repeats this mirror so access flows all the way down.

## Assembly checklist

Before emitting the Phase B JSON, walk through this list:

- [ ] Top-level has all eight keys in EXACTLY this order: `title`, `version`, `name`, `roles`, `forms`, `actions`, `resources`, `access`. `description` is optional; if included, it goes immediately after `title`. `access` is a non-empty array (see "Top-level `access`").
- [ ] `version` is `"2.0.0"`.
- [ ] `roles` contains `administrator`, `authenticated`, `anonymous` plus any custom roles from the plan; exactly one has `default: true`.
- [ ] Every resource has an `access` array with `read_all` granted to all three base roles.
- [ ] Every resource with user data has a meaningful `submissionAccess` reflecting the plan (owner, group, role-based, public).
- [ ] Every resource and form has a Save Submission action in `actions`.
- [ ] Every `select` with `dataSrc: "resource"` has a `data.resource` key that matches an actual `resources.<key>` machineName.
- [ ] Every `select` with `dataSrc: "resource"` has `"reference": true` and does **not** have `"valueProperty"`. Bare `valueProperty: "_id"` breaks multi-level resource hierarchies at read time.
- [ ] Every login-action `settings.resources` array equals exactly `["user"]`. Never include `"admin"` or any other resource name the template itself does not declare — the Form.io importer rejects it. Administrator tasks are performed via the Form.io project portal, not via the app login form.
- [ ] Every Role Assignment action references a role that exists in `roles`.
- [ ] Every Group Assignment action's `settings.group` and `settings.user` match field keys on the join resource it's attached to.
- [ ] **Every child resource whose access flows from a group has a four-entry `submissionAccess` (`read`, `create`, `update`, `delete`, roles: `[]`) on the `select` component that references the group.** Missing this block silently breaks group permissions on the child.
- [ ] **Every resource 2+ levels below the group has a hidden, calculated mirror of the group select** (`hidden: true`, `calculateValue: "value = data.<parent>.data.<group>;"`, `refreshOn: "<parent>"`, `reference: true`) carrying the same four-entry `submissionAccess` block. Without the mirror, group access stops at the direct child and grandchildren are invisible to group members.
- [ ] The `user` resource is present if the plan has any authentication.
- [ ] `components` arrays end with a submit button.
- [ ] `path` values are kebab-case; `name` and `key` values are camelCase; neither contains collision-avoidance integer suffixes (no `user-123`, no `Employee 775`).

## Verification

After writing, mentally trace one flow end-to-end: a user signs up on `userRegister` → Save action writes to `user` → Role Assignment adds `authenticated` → Login action issues a JWT → the user can now load `project` (via `access.read_all`) but only sees rows where a `ProjectUser` membership exists (via the Group Assignment ACL). If any link in that chain is missing, fix before emitting.
