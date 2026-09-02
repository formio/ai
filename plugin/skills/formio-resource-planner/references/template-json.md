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
- If the plan includes custom roles that should see the project (e.g., `moderator`, `salesRep`), add them to `read_all`. Never add custom roles to `create_all` / `update_all` / `delete_all` **in this project-level `access` array** — those are project-administration operations (creating forms, editing the project). The rule is scoped to this array and says nothing about per-resource `submissionAccess`, where end-user roles routinely hold `create_own` (and must, for any resource the app's own users create).
- `access` MUST be the LAST key in the emitted template.json, after `resources`. That ordering is what makes the project's data model (resources/forms/actions) readable before the access footer.

## Resources & Forms — shared shape

`resources` and `forms` are parallel maps; both entries use the same schema except for `type`:

- `type: "resource"` — a data model / "noun" the app stores, references, and exposes as a REST API (Project, Task, User, CompanyUser, Applicant, etc.).
- `type: "form"` — bespoke, purpose-specific data collection (job applications, surveys, RSVPs, feedback / contact forms, and the auth forms login/register). A Form captures a response to one interaction rather than a reusable record. It may reference Resources to populate `select` choices, and it may **reference an already-established Resource record** via a (often disabled, pre-selected) `select` or via the submission `owner`. A Form must NEVER create the referenced Resource on submit — see the anti-pattern callout below.

See `formio-resource-planner/SKILL.md` → "Resources vs. Forms — the core modeling decision" for which entities should be modeled as resources vs forms. Most entities are resources, and an all-resource project is valid; use `type: "form"` for the genuinely bespoke cases (survey-like, one-off intakes) rather than forcing every entity one way or the other.

```jsonc
"<machineNameKey>": {
  "title": "Human Readable Title",
  "type": "resource",              // or "form"
  "name": "machineName",           // matches the map key; camelCase
  "path": "url-path",              // kebab-case; served at {projectUrl}/<path>
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

Group-based access is enforced at runtime from the field-based block on the group-reference `select` — including **create**. On a write the server rebuilds the row's own `access` array from that block (`{ type, resources: [<groupSubmissionId>] }` per entry), and on a request it resolves the caller's group memberships against it. You therefore do NOT add `create_own` / `read_all` / etc. to a group-scoped child resource for the group's sake; the block is the whole mechanism. Two things the block does NOT cover, both real and both easy to miss: the **group resource itself** (nothing stamps a group row's own `access`, so the group needs a real `read_all` for the end-user role — see "Part 3 — the group resource needs its own read grant" below), and a create whose payload does not carry the group reference (see "What group-based create actually requires").

## Component shapes

**Default: a `components` array ends with a submit button — on both resources and forms.** A form or resource that is meant to be submitted from the rendered UI needs one, and this is the common case; do not skip it just because a Resource feels "data-model" rather than "form" (a Resource renders and submits like any other form). Two deliberate exceptions where you omit the button:

1. **An embedded form not meant to be submitted** — e.g. a client-only Search form whose data the app reads in the browser, or any form whose submit is fired programmatically by the host application (`form.submit()`). No user-facing submit.
2. **A `display: "wizard"` form** — the wizard display renders its own Next/Previous/Submit controls as internal logic. Do NOT add a manual submit button to a wizard; it produces a duplicate.

Outside those cases, include the button — omitting it on a form that IS meant to be submitted with the default display is a bug. Each input component has at minimum `type`, `key`, `label`, `input: true`.

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

When this select points at a resource that acts as the **group** for a Group Assignment action (e.g., `Task.project` points at `Project`, which is the group), the select component itself carries a `submissionAccess` block whose entries have empty `roles` arrays. On every write the server rebuilds the saved row's own `access` from that block, keyed to the referenced group submission, and resolves the caller's group memberships against it per request. Which entry types to include is a deliberate decision — see "Choosing the types" below. Without this block, child-resource access does **not** inherit from the group and group permissions don't work end-to-end.

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

  // Field-based resource access. Empty `roles` is deliberate: on each write the
  // server stamps the saved row's own `access` with these types, keyed to the
  // referenced group submission, and resolves the caller's memberships against
  // it per request. Pick the types from the menu below — the four-entry form
  // shown here is the most permissive one.
  "submissionAccess": [
    { "type": "read", "roles": [] },
    { "type": "create", "roles": [] },
    { "type": "update", "roles": [] },
    { "type": "delete", "roles": [] },
  ],
}
```

**Choosing the types — this is a real access decision, not boilerplate.** Each entry names one permission the server stamps onto the saved row. The row-level vocabulary is wider than the four CRUD names, and two of the values are shorthands:

| Entry type | What a group member may do to the row          | Appears in list results?  |
| ---------- | ---------------------------------------------- | ------------------------- |
| `read`     | read                                           | yes                       |
| `create`   | create rows referencing this group             | n/a (authorizes the POST) |
| `update`   | update                                         | no, on its own            |
| `delete`   | **permanently delete**                         | no, on its own            |
| `write`    | read + create + update — explicitly NOT delete | yes                       |
| `admin`    | read + create + update + delete                | yes                       |

`{ "type": "write", "roles": [] }` is exactly equivalent to `read` + `create` + `update` as three entries, and the four-entry CRUD block is exactly equivalent to `admin`. A row is only visible to an index/list request through `read`, `write`, or `admin`, so a block of `update` alone yields rows the member may modify but never see listed. The legacy single-value spelling of the same thing is `"defaultPermission": "<type>"` on the component; prefer the array.

Decide `delete` deliberately. The four-entry block lets **any** member of the group permanently delete **any** of that group's rows, not merely the ones they created. That is right for a kanban card or a personal task list and usually wrong for a customer record with an audit obligation — in which case use `write` and leave deletion to an administrator working through the portal. Whatever you choose, the Access Matrix's `delete` column must say the same thing: `group` when the block confers delete, `—` when it does not.

When to include this block: on **every** child-resource `select` component that references a resource acting as a group. Examples:

- `Task.project` where `Project` is the group (membership via `ProjectUser` join)
- `Contact.company` where `Company` is the group (membership via `CompanyUser` join)
- `Deal.company` where `Company` is the group

When **not** to include it: on selects that are not group references — e.g., `Task.assignee` (pointing at User), `Deal.contacts` (pointing at Contact as an attachment), a status lookup, any static-value select. These use the plain `select` shape without `submissionAccess`.

### select — transitive group-access mirror (for sub-resources 2+ levels from the group)

When a resource is **two or more levels below** the group in the hierarchy (e.g., `Contact`/`Deal`/`Activity` under `Account`, where `Team` is the group on `Account`), the sub-resource cannot simply point at the group resource — it has no direct relationship to the group. Instead, it carries **two** reference selects:

1. A **normal parent reference** pointing at the immediate parent (e.g., `account` on `Contact`), using the standard resource-select shape (`reference: true`, no `submissionAccess`). This is what the user picks.
2. A **hidden, calculated mirror of the group field** (e.g., `team` on `Contact`), auto-populated from the parent's group value. This carries the same field-based `submissionAccess` block as a direct group-reference select — the same type choice applies (see "Choosing the types") — and it is what propagates group access to the sub-resource.

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
  "calculateValue": "value = data.account?.data?.team || value;", // auto-populate from parent's group field
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

**The calculateValue expression** follows a fixed pattern: `value = data.<parentKey>?.data?.<groupKey> || value;`

- `<parentKey>` — the key of the immediate parent's select on this form (e.g., `account`).
- `<groupKey>` — the key of the group-reference select on the parent resource (e.g., `team`).

**Both halves of the guard are required. Emit the expression exactly as written.**

- **`?.` on the parent and on `.data`.** The unguarded `data.account.data.team` throws `TypeError: Cannot read properties of undefined (reading 'team')` whenever the parent reference is not resolved into a full submission — which is the normal case when loading an existing grandchild, because the stored value is `{ _id }` and nothing has expanded it. The renderer logs `An error occured within custom function for <key>` and the screen is broken from the first click.
- **`|| value` is the part that prevents damage, and it is NOT stylistic.** `Component.doValueCalculation` seeds `value` with the component's current `dataValue`, and `calculateComponentValue` then does `if (_.isNil(calculatedValue)) { calculatedValue = this.emptyValue; }`. So a bare optional chain returning `undefined` does not leave the field alone — it CLEARS it. On a group mirror that means the row is saved with no group reference, the server stamps no ACL from it, and every member of that group loses access to the record. Silent, and only visible later as rows that vanish for teammates.

Read together: the optional chaining stops the crash, the fallback stops the data loss. Emitting one without the other trades a loud failure for a quiet one.

Because the parent's select uses `reference: true`, Form.io resolves the parent into a full submission object on read, so `data.account.data.team` walks through the resolved account's data to find its team value. The mirror also uses `reference: true` — it stores the same kind of resolvable reference as the original.

**What makes this different from the direct group-reference select.** Only three properties: `hidden: true` (invisible), `calculateValue` (auto-populated from parent), and `refreshOn` (recalculates when parent changes). Everything else — `reference: true`, the `submissionAccess` block, `validate.required` — is identical to a normal group-reference select.

**When to add a mirrored group field.** Any resource that sits two or more hops from the group in the ER graph and needs to inherit the group's access. Walk the path from the resource to the group: if you have to traverse more than one `select` to get there, add a mirror. A single-hop child (e.g., `Account.team`) uses the direct group-reference select pattern — no mirror needed.

**Where to put it in the form.** Put the mirrored field adjacent to the parent reference (usually right after it). The user won't see it because `hidden: true`, but it keeps the form definition readable for whoever maintains the template.

### select — multiple references (1:N embedded or N:N as attachment)

Add `"multiple": true` to the resource-select above. Use when the relationship carries no data of its own; otherwise model it as a join resource.

### select — reference an established Resource (pre-selected + disabled)

Used inside a `type: "form"` entry to link the form to a Resource record that was **already created earlier in the application flow** (onboarding / profile / CRUD). The user does not create the record here — they fill the bespoke fields, and this select records which existing Resource the submission is about. Pre-select it to the current user's record and `disabled: true` so it cannot be changed.

```jsonc
{
  "type": "select",
  "key": "applicant",
  "label": "Applicant",
  "widget": "choicesjs",
  "dataSrc": "resource",
  "data": { "resource": "applicant" }, // machineName of the existing Resource
  "template": "<span>{{ item.data.firstName }} {{ item.data.lastName }}</span>",
  "reference": true, // store a resolvable reference, not a bare _id
  "disabled": true, // locked — the user cannot change it
  "defaultValue": "", // pre-populated at runtime to the user's own Applicant record
  "validate": { "required": true },
  "input": true,
  "tableView": true,
}
```

The pre-selection (binding the select to the logged-in user's Applicant record) is wired in the UI layer by the framework skill, not in the template — the template's job is to declare the reference select, mark it `disabled`, and require it. When the relationship is strictly 1:1 with the authenticated user, you can omit this select entirely and rely on the submission **`owner`** instead (owner-based `submissionAccess`).

> **Anti-pattern — never create the Resource from the bespoke Form.** Do NOT add a nested `form` component that creates the Resource inline, and do NOT give the Form a Save action whose `settings.resource` writes a new record into the referenced Resource. Creating the data-model record and collecting the bespoke response are two separate flow steps: the record is established first by its own flow; the Form only references it. See `formio-application/references/resource-vs-form-anti-pattern.md` → "Using Resources within Forms — the right flow (and the anti-pattern to avoid)".

### Form referencing an established Resource — full shape

A bespoke `type: "form"` entry that references the already-created `applicant` Resource (via a disabled, pre-selected select) and adds interaction-specific questions. The bespoke fields live only on this form's submission; the `applicant` record is untouched.

```jsonc
"jobApplication": {
  "title": "Job Application",
  "type": "form",
  "name": "jobApplication",
  "path": "job-application",
  "tags": [],
  "components": [
    { "type": "select", "key": "applicant", "label": "Applicant", "widget": "choicesjs", "dataSrc": "resource", "data": { "resource": "applicant" }, "template": "<span>{{ item.data.firstName }} {{ item.data.lastName }}</span>", "reference": true, "disabled": true, "validate": { "required": true }, "input": true, "tableView": true },
    { "type": "textarea", "key": "whyHire", "label": "Why should we hire you?", "input": true, "tableView": false },
    { "type": "datetime", "key": "earliestStart", "label": "Earliest start date", "enableTime": false, "input": true, "tableView": true },
    { "type": "number", "key": "salaryExpectation", "label": "Salary expectation", "input": true, "tableView": true },
    { "type": "button", "key": "submit", "label": "Submit", "action": "submit", "theme": "primary", "disableOnInvalid": true, "input": true }
  ],
  "access": [
    { "type": "read_all", "roles": ["administrator", "anonymous", "authenticated"] }
  ],
  "submissionAccess": [
    { "type": "create_own", "roles": ["authenticated"] },
    { "type": "read_own",   "roles": ["authenticated"] },
    { "type": "read_all",   "roles": ["administrator"] },
    { "type": "update_all", "roles": ["administrator"] },
    { "type": "delete_all", "roles": ["administrator"] }
  ]
}
```

This entry needs a `jobApplication:save` action in `actions` like any other form — a plain Save that writes to its OWN submission (no `settings.resource` pointing at `applicant`). The `applicant` Resource keeps its own `applicant:save` action and is created by its own onboarding flow, long before this form is opened. The bespoke fields (`whyHire`, `earliestStart`, `salaryExpectation`) are intentionally NOT on the `applicant` Resource — they belong to this one interaction.

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

When the project has authentication, include a user-type resource to hold credentials. `user` is the conventional name and the default — use it unless the plan calls for a differently-named credential resource (e.g. a separate `admin` resource, or a domain name like `member`).

The credential fields are whatever the plan needs, not a fixed pair. Form.io authenticates **any identifier component against any secret component** — the Login action's `settings.username` and `settings.password` just point at the two component keys you choose. `email` + `password` is the common default and what the block below shows, but `username` + `password`, `userId` (textfield) + `pin`, or `phone` + a code all work equally. Pick the identifier and secret the app actually uses, mark the identifier `unique: true` and the secret `type: "password"` (`protected: true`), then add the rest of the plan's fields. Treat the block below as a starting template, not a required shape:

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

Add extra fields (firstName, lastName, profile photo, etc.) after the identifier/secret pair and before `submit` if the user described a custom user shape. If the plan uses a different credential pair than `email`/`password` (e.g. `userId`/`pin`), swap the first two components accordingly and set the Login action's `settings.username`/`settings.password` to match those component keys.

## Actions

**Actions follow intent.** The top-level `actions` map is where Form.io persists submissions and enforces access. Add the actions each resource/form needs for its purpose — no more, no less. Anything meant to store records needs a `save`; skip it (and any other action) on a form/resource that never sends data to the submission API, such as a client-only Search form. The failure mode to avoid is the accidental one: a form or resource that WAS meant to persist ends up with no `save`, so it renders, accepts input, and silently drops every submission because nothing writes it to MongoDB.

Typical set per resource/form type (reference — the planner SKILL.md `Actions emission — per use-case` section re-states the algorithm). "Client-only form (Search, etc.)" is deliberately absent from this table because it has no actions:

| Resource / form type | Typical `actions` keys |
| --- | --- |
| Plain resource (Project, Task, …) | `<name>:save` |
| `user` resource | `user:save` |
| Login form | `<name>:login` (a plain `<name>:save` is optional — audit only; see warning) |
| Register form | `<name>:save`, `<name>:role`, `<name>:login` |
| Join resource with group-based access | `<name>:save`, `<name>:group` |
| Join resource without group access | `<name>:save` |
| Notification form (sends email / webhook) | `<name>:email` / `<name>:webhook` — plus `<name>:save` only if it also persists |
| Client-only form (embedded Search, etc.) | none — data read in the browser, never sent to the submission API |

Each action is keyed `"<formMachineName>:<actionName>"`. Fields:

- `title`: human-readable
- `name`: the action type — `save`, `login`, `role`, `group`, `email`, `webhook`, etc.
- `form`: the machineName of the form/resource the action runs on
- `priority`: integer — higher runs later within the same handler phase
- `method`: `["create"]`, `["update"]`, or `["create", "update"]`
- `handler`: `["before"]` or `["after"]`
- `settings`: action-specific payload

### Save Submission (anything that persists)

A Save Submission action persists a submission to the submission API. Add one to any resource or form meant to store records — which is most resources and ordinary data-collection forms. **Omit it** when the form/resource does not persist: a login form (auth only), a notification-only form (email/webhook, nothing stored), or a client-only form/resource whose data the app reads in the browser and never sends to the submission API (e.g. an embedded Search form) — the latter may have no actions at all. Include one per persisting form/resource in the `actions` map:

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

Attached to any form with an identifier + secret pair that should issue a JWT. `settings.username` and `settings.password` name the two component keys — `email`/`password` below, but set them to whatever the credential resource actually uses (e.g. `userId`/`pin`):

```jsonc
"userLogin:login": {
  "title": "Login",
  "name": "login",
  "form": "userLogin",
  "priority": 2,
  "method": ["create"],
  "handler": ["before"],
  "settings": {
    "resources": ["user"],
    "username": "email",
    "password": "password",
    "allowedAttempts": 5,
    "attemptWindow": 30,
    "lockWait": 1800
  }
}
```

#### `settings.resources` — `["user"]`, `["admin"]`, or `["user", "admin"]`

`settings.resources` is an array of user-type resource machine names the login form authenticates against. For the `userLogin:login` action, you should emit `["user"]` for most applications. If the application prompt asks for ONLY "admins" to access the application, then you must emit `["admin"]`. If the application prompt states that both "admins" AND "users" can access the application, then you should emit `["user", "admin"]`.

For most applications, administrator responsibilities (seeding reference data, creating group-membership rows, assigning roles, reviewing/moderating submissions, inviting users) are performed by an administrator signing in to the **Form.io project portal** — the same portal used to manage forms, resources, and submissions at the project level. The app's login form is for end users only.

On register forms that should log the user in immediately after signup, attach a Login action too (same settings, form points to the register form, same `resources: ["user"]`).

> **A Login form's Save Submission action must NEVER point to an underlying resource (`settings.resource`).** A `save` action on a login form with any `settings.resource` set is ALWAYS wrong — it makes every login attempt try to create a brand-new record in that resource (e.g. `settings.resource: "user"` creates a new user on every login). Forwarding a submission into a resource is the **register** form's job (`userRegister:save` with `settings.resource: "user"`), not the login form's.
>
> A **plain** save on a login form — `settings: {}`, no `resource` key — is legitimate but uncommon: it records each login attempt as a submission on the login form itself, for audit/history purposes. Only add it when the user explicitly wants a login audit trail. By default a login form emits ONLY `<name>:login`; if you do add `<name>:save`, it MUST have empty `settings` (records to this form) and MUST NOT set `settings.resource`.

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

### Multi-role user systems — role selectboxes + one conditional Role Assignment per role

**Scope: this pattern applies only when all personas share ONE user collection (a single user resource).** That is the common default, but it is a requirements decision, not a law — when the application calls for a **resource per role** (e.g., a separate `admin` resource alongside `user`, with the Login action's `settings.resources` listing both), this section does not apply: each user-type resource simply carries its own unconditional Role Assignment (assigning that resource's single role on create), exactly like a register form. Decide the shape in the interview (see `interview-guide.md` round 4) before reaching for selectboxes.

When the plan DOES share one user resource across **more than one assignable persona** (e.g., `student` / `collegeAdmin` / `scholarshipAdmin`), the register form's single unconditional Role Assignment only covers the self-register persona. The other personas need a role-selection mechanism ON the user resource itself, because **a submission's `roles` array cannot be written directly through the API** — the server filters `roles` out of POST/PUT/PATCH bodies even for the project owner, so "create the user, then PATCH `roles`" is a dead end that strands the user with no working way to create staff accounts. The Role Assignment action is the only supported writer of submission roles.

The canonical pattern is: (1) a `selectboxes` component keyed `role` on the user resource, one value per assignable persona; (2) one **conditional** Role Assignment action per persona, executing only when its box is checked. Whoever creates or edits a user (the admin in the Form.io portal, or an authorized API caller setting `data.role.<value> = true`) picks the persona on the form, and the matching action attaches the real role server-side.

Example selectboxes component on the `user` resource:

```jsonc
{
  "label": "Role",
  "key": "role",
  "type": "selectboxes",
  "input": true,
  "inputType": "checkbox",
  "optionsLabelPosition": "right",
  "tableView": false,
  "values": [
    { "label": "Student", "value": "student", "shortcut": "" },
    { "label": "College Admin", "value": "collegeAdmin", "shortcut": "" },
    { "label": "Scholarship Admin", "value": "scholarshipAdmin", "shortcut": "" },
  ],
  "defaultValue": { "student": false, "collegeAdmin": false, "scholarshipAdmin": false },
}
```

One action per persona, keyed `user:role<Persona>`, identical except for the `condition.conditions[0].value` and `settings.role`:

```jsonc
"user:roleAdmissions": {
  "title": "Role Assignment (College Admin)",
  "name": "role",
  "form": "user",
  "priority": 1,
  "method": ["create"],
  "handler": ["after"],
  "condition": {
    "conjunction": "all",
    "conditions": [
      { "component": "role", "operator": "isEqual", "value": "collegeAdmin" }
    ],
    "custom": ""
  },
  "settings": {
    "association": "new",
    "type": "add",
    "role": "collegeAdmin"   // role's machineName key from `roles`; resolves to the role id on import
  }
}
```

Rules:

- **Shared collection vs. resource-per-role is a deliberate choice.** Default to ONE `user` resource with personas as roles (one login form, one owner story) and use this selectboxes pattern. A resource per role is equally valid WHEN the requirements call for it (separate credential pools, separate registration flows, `settings.resources: ["user", "admin"]` on Login) — in that shape, skip the selectboxes and give each user-type resource its own unconditional Role Assignment instead. What is NOT valid is a shared user resource whose non-default personas have no assignment mechanism at all.
- The `condition` object uses the conjunction shape above (`conjunction` + `conditions[{ component, operator, value }]` + `custom: ""`). For a `selectboxes` component, `operator: "isEqual"` with the box's `value` string matches when that box is checked.
- Emit one conditional `user:role<Persona>` action for EVERY assignable role in the plan, including the self-register persona — the register form's own unconditional Role Assignment still covers self-registration, and the conditional set covers users created or edited on the resource directly (portal or API).
- Never plan a step that writes `submission.roles` directly (POST body, PUT, PATCH) — the API silently strips it, and a PUT that includes a `roles` key can wipe the existing roles.

### Group Assignment (Group Permissions) — has three parts

Group-based access is configured in **three places** that must be in sync. The first two are the mechanism; the third is the one every reader forgets, because it is a grant on the group resource rather than on the children:

**Part 1 — the action on the join resource.**

Attach Group Assignment to the join resource (e.g., `ProjectUser`, `CompanyUser`) whose two fields identify a group and a user. The action stores ACLs on the referenced group submissions at runtime.

```jsonc
"projectUser:group": {
  "title": "Group Assignment",
  "name": "group",
  "form": "projectUser",
  "priority": 5,
  "method": ["create", "update", "delete"],
  "handler": ["after"],
  "settings": {
    "group": "project",   // field key on the join resource that identifies the group
    "user":  "user"        // field key on the join resource that identifies the user
                           // omit entirely when the form IS the user (join-less shape);
                           // never set it to "_id" — it is resolved as data.<key>
    // optional: "role": "<field key>" — stores memberships as "<groupId>:<role>"
  }
}
```

All three methods are required, not a stylistic choice. The action computes membership by diffing the submitted row against the previous one, so `update` is what moves a membership and `delete` is what revokes it; with `method: ["create"]` a membership can be granted and then never moved or withdrawn. Two constraints the JSON cannot express, both silent when violated: the requester must hold **update access on the group record** for an assignment to verify (so self-serve joining does not work while the group is administrator-only — see `formio-auth/references/group-permissions.md` → "The assigner must have update access on the group"), and group-scoped **list** filtering requires a `team` / `commercial` / `trial` project plan.

Do not attach Group Assignment to non-join resources.

**Part 2 — field-based `submissionAccess` on every child's group-reference select.**

Every child resource that should inherit the group's access (e.g., `Task` inheriting from `Project`, `Contact`/`Deal` inheriting from `Company`) needs a `submissionAccess` block on its `select` component that points at the group resource. See "`select` — reference to a **group** resource" in the Component shapes section above for the exact shape. Each entry has an empty `roles` array, and on every write the server stamps those types onto the saved row's own `access`, keyed to the referenced group; a request is then resolved against that stamp by the caller's memberships. Choose the entry types deliberately — see "Choosing the types" — rather than emitting all four by reflex.

Without Part 2, a logged-in user with a ProjectUser membership can see the Project row but **cannot** see the Tasks attached to it — the child's access does not automatically propagate.

**What group-based create actually requires.**

Create is authorized by the block, not by a form-level grant: on a POST the server reads the group reference out of the **submitted payload** and grants `create_all` for that group id. Three preconditions, and a failure of any one produces `Unauthorized` on every create while reads keep working — the exact shape of a silent group-permissions bug:

1. **The block carries a create-conferring type** — `create`, `write`, or `admin`. A `read`-only block authorizes no creates.
2. **The payload carries the group reference as an object with an `_id`.** A bare-string value is skipped, which is one more reason a group-reference select must be `"reference": true` with no `valueProperty: "_id"`.
3. **The group field is actually populated in the submitted payload.** An empty value contributes nothing. This is the sharp edge for the transitive mirror, and it is sharper than it looks: the access check reads the mirrored key out of the request body, and `calculateValue` has NOT run at that point — server-side calculation happens later in submission processing. Sending the parent reference is not enough, even with the parent's nested group data included; only the mirrored field's own value counts. In a rendered form this works because Form.io evaluates `calculateValue` client-side and ships the result, so a browser submit carries it. Any other client — a script, an integration, a mobile app posting a bare parent reference — is refused with `Unauthorized` on create. Verified against a live deployment: bare parent reference → `401`; same request with the mirrored value present → `201`, correctly stamped.

Precondition 2 has a corollary that bites first in practice: populating that select requires read access on the group resource (next section). No read on the group means an empty select, which means no group reference in the payload, which means every create fails.

**Part 3 — the group resource needs its own read grant.**

Nothing stamps a group row's own `access` — the server builds a row's `access` from that row's components, and a group resource carries no reference to itself. Group membership does not help either: reference population and read checks consult `read_all` roles and ownership, never group ids. So the group resource needs `read_all` including the end-user role, both to render the group's name and to populate the `dataSrc: "resource"` select whose value authorizes group-based create. Note the trade-off explicitly in the plan: this makes every group row readable by every end user. There is no membership-scoped read of a group's own record.

**Transitive access — 2+ levels below the group.**

When a resource is not a direct child of the group but a grandchild (or deeper) — e.g., `Contact` under `Account`, with `Team` as the group on `Account` — Part 2 cannot point at the group directly because the sub-resource has no relationship with the group. Instead, add **both** a parent reference and a hidden, calculated mirror of the group field to the sub-resource. The mirror is invisible, auto-populated from the parent, uses `reference: true` like the parent select, and carries the same field-based `submissionAccess` block. What matters mechanically is that the calculated value is the referenced submission OBJECT: the stamping step skips any value without an `_id`.

See "`select` — transitive group-access mirror" in Component shapes for the exact shape and the `calculateValue` pattern. Every level of the hierarchy below the direct child repeats this mirror so access flows all the way down. Note the mirror is **client-supplied at create time**: the permission check reads the mirrored key from the request body before `calculateValue` is evaluated server-side, so a client that posts only the parent reference is refused. A rendered form satisfies this automatically (Form.io calculates client-side and submits the value); a non-browser client must send the mirrored value explicitly.

## Assembly checklist

Before emitting the Phase B JSON, walk through this list:

- [ ] Top-level has all eight keys in EXACTLY this order: `title`, `version`, `name`, `roles`, `forms`, `actions`, `resources`, `access`. `description` is optional; if included, it goes immediately after `title`. `access` is a non-empty array (see "Top-level `access`").
- [ ] `version` is `"2.0.0"`.
- [ ] `roles` contains `administrator`, `authenticated`, `anonymous` plus any custom roles from the plan; exactly one has `default: true`.
- [ ] Every resource has an `access` array. `read_all` to all three base roles is the default (form definitions are public metadata); tighten it only when the plan calls for a resource whose definition should not be world-readable.
- [ ] Every resource with user data has a meaningful `submissionAccess` reflecting the plan (owner, group, role-based, public).
- [ ] Every resource or form **meant to persist** has a Save Submission action in `actions` (a missing one there silently drops submissions). Forms/resources that don't persist — login forms, notification-only forms (email/webhook), client-only forms (e.g. an embedded Search form) — may have no Save, or no actions at all. That is valid.
- [ ] Every `select` with `dataSrc: "resource"` has a `data.resource` key that matches an actual `resources.<key>` machineName.
- [ ] Every `select` with `dataSrc: "resource"` has `"reference": true` and does **not** have `"valueProperty"`. Bare `valueProperty: "_id"` breaks multi-level resource hierarchies at read time.
- [ ] Every login-action `settings.resources` array equals `["user"]`. If the application requires "admins" to access the application, then `"admin"` can also be included in the resources array. In most cases, however, administrator tasks are performed via the Form.io project portal, not via the app login form.
- [ ] Every Role Assignment action references a role that exists in `roles`.
- [ ] **When `roles` declares 2+ assignable personas, the `user` resource has the `role` selectboxes component and one conditional `user:role<Persona>` action per persona** (see "Multi-role user systems"). Direct `roles` writes are stripped by the API, so without these actions the non-self-register personas cannot be assigned at all.
- [ ] Every Group Assignment action's `settings.group` and `settings.user` match field keys on the join resource it's attached to.
- [ ] **Every child resource whose access flows from a group has a field-based `submissionAccess` block (entries with `roles: []`) on the `select` component that references the group, and its entry types match that resource's Access Matrix row.** Missing the block silently breaks group permissions on the child; emitting all four entries (equivalently `admin`) when the matrix's `delete` column says `—` silently grants every member permanent delete. Use `write` when deletion stays with administrators — see "Choosing the types".
- [ ] **If end users create groups at runtime, the plan says who writes the creator's membership row.** Creating a group confers no membership in it, so without that write the creator holds no group role and every child operation under their own group is refused. The group resource also needs `create_all` + `read_all` + `update_own` for that role: the assignment is verified against the requester's update access on the group being assigned into, and `read_all` — not `read_own` — is what lets a member who did not create the group read its row and populate the reference select.
- [ ] **Every resource an end user creates at runtime can actually be created by that user.** For an owner-scoped resource that means `create_own` for their role in its own `submissionAccess`. For a group-scoped child it means the field-based block carries `create`, `write`, or `admin` AND the group reference is populated in the payload at submit time — do not also add `create_own`, which would authorize creating rows outside the group. Walk the app's primary flow and confirm every POST the user makes is covered by one of the two.
- [ ] **Every resource 2+ levels below the group has a hidden, calculated mirror of the group select** (`hidden: true`, `calculateValue: "value = data.<parent>.data.<group>;"`, `refreshOn: "<parent>"`, `reference: true`) carrying the same field-based `submissionAccess` block as the direct child's group-reference select — same entry types, same Access Matrix row. Without the mirror, group access stops at the direct child and grandchildren are invisible to group members.
- [ ] The `user` resource is present if the plan has any authentication.
- [ ] **No login form has a `save` action that sets `settings.resource`.** A login-form `save` pointing to any underlying resource is always wrong (it tries to create a new record in that resource on every login — e.g. a new user). A login form emits ONLY `<name>:login` by default; a plain `save` (empty `settings`, no `resource`) is allowed ONLY when the user asked for a login audit trail.
- [ ] **Every form/resource meant to be submitted from the UI ends its `components` array with a submit button** (`{ "type": "button", "key": "submit", "action": "submit", ... }`). Exceptions: a `display: "wizard"` form (the wizard renders its own submit — never add a manual one) and an embedded/client-only or programmatically-submitted form (no user-facing submit).
- [ ] `path` values are kebab-case; `name` and `key` values are camelCase; neither contains collision-avoidance integer suffixes (no `user-123`, no `Employee 775`).

## Verification

After writing, mentally trace one flow end-to-end: a user signs up on `userRegister` → Save action writes to `user` → Role Assignment adds `authenticated` → Login action issues a JWT → the user can now read EVERY `project` row (via `submissionAccess.read_all`, which is what the project select needs to populate — nothing stamps a group row's own `access`, so membership neither adds nor restricts anything here) → the user creates a Task, which succeeds because the field-based block on `task.project` carries a create-conferring type AND the payload names a project they belong to; the same block stamps the new row so their teammates can read it. If any link in that chain is missing, fix before emitting — and note that the create link is the one that fails without failing the import.
