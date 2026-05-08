---
name: formio-auth-permissions
description: >-
  Configure custom authentication (login form, register form, role assignment,
  custom user resources) and group-level permissions (Group Assignment action,
  field-based submission access, transitive hidden mirrors) on a Form.io
  project — new or existing. Use when the user wants to add login or
  registration to an app, assign roles on signup, restrict records to a
  user's team / project / company / tenant, debug "I can see the parent but
  not its children" group-permission bugs, set up the four-empty-roles
  field-based access block, or wire up transitive group access for resources
  two-or-more levels below the group. Also use when the user mentions
  Group Permissions, Group Assignment, group-based access, role-based access,
  owner-based access, the `user` resource, login resources array, hidden
  calculated mirror selects, or `data.<parent>.data.<group>` calculateValue
  expressions. Not for: planning the resource model from scratch (see
  `formio-resource-planner`). Not for: looking up a Form.io REST endpoint
  (see `formio-api`). Not for: generic action-anatomy questions —
  conditions, priority, handler/method (see `formio-actions`); this skill
  covers ONLY the auth-and-permissions subset and how those actions wire
  into resources and forms.
---

# Form.io Auth & Permissions

Reference for two interlocking subsystems that together make a Form.io project
multi-tenant-safe and login-aware:

1. **Custom authentication** — a user resource, a login form, a register form,
   and a role-assignment action that together let real users sign up, sign in,
   and carry a role.
2. **Group-level permissions** — a join resource, a Group Assignment action, a
   field-based `submissionAccess` block on every child reference, and (for
   deeper hierarchies) a hidden calculated mirror — that together restrict
   submissions to the user's team / project / company.

Both subsystems can be retrofitted into an existing Form.io project without
rewriting the data model. The patterns are mechanical: skip a half and the
feature silently fails open or fails closed.

## When to use this skill

- "Add login to my app" / "let people sign up" / "wire up registration"
- "Restrict records to the user's team" / "users only see their company's data"
- "Group permissions aren't propagating to child records"
- "I added a custom user resource — how do I make login work?"
- "How do I make a grandchild resource inherit group access?"
- "What's the difference between `access` and `submissionAccess`?"
- "Why is `settings.resources: ['admin']` rejected on import?"

If the user is starting from a blank slate and wants the full data model
designed end-to-end, route them through `formio-resource-planner` first — it
will produce a `template.md` + `template.json` pair that already bakes in the
patterns documented here.

## MCP Tool Preference

When the target is a live Form.io project, prefer the MCP server's first-party
tools to make changes. This skill is the reference for what to send; the
tools are the transport.

| Operation | MCP Tool |
| --- | --- |
| Create or update the user resource | `form_create` / `form_update` |
| Create login / register forms | `form_create` |
| List or modify roles | `role_list` / `role_create` / `role_update` |
| Discover an action's settings schema | `action_type_get` |
| Attach Login / Role / Group Assignment / Save | `action_create` |
| Inspect existing actions | `action_list` / `action_get` |

For a holistic project re-import (e.g., when retrofitting many resources at
once), use `project_import` with a hand-edited `template.json`.

## The two access arrays — keep them straight

Every resource and every form carries TWO independent access arrays. They
control different things, and the most common Form.io gotcha is conflating
them.

| Array | Controls | Default for resources |
| --- | --- | --- |
| `access` | Who can read the form/resource **definition** (component tree, metadata) | `read_all` granted to `administrator`, `authenticated`, `anonymous` — wide open |
| `submissionAccess` | Who can create / read / update / delete **submissions** (data rows) | Variable — depends on the access pattern |

When a user describes access ("only sales reps can read deals", "users see
their team's records"), they almost always mean `submissionAccess`. The
`access` array stays at the wide-open default unless there's a specific
reason to lock it down — restricting it is rarely what anyone wants.

Default `access` block to copy verbatim onto every resource:

```jsonc
"access": [
  { "type": "read_all", "roles": ["administrator", "anonymous", "authenticated"] }
]
```

## Custom authentication

A working auth setup is four pieces:

1. The **`user` resource** — holds credentials and any profile fields.
2. A **login form** — collects email + password, attaches a Login action, issues a JWT.
3. A **register form** — collects signup data, writes into the `user` resource via Save, attaches Role Assignment, then logs the user in via Login.
4. The project's **roles** — `administrator`, `authenticated`, `anonymous` (defaults) plus any custom roles your app needs.

### The canonical `user` resource

The default `user` resource ships with email + password. Extend it with extra
fields (firstName, lastName, profile photo) by inserting them BETWEEN
`password` and `submit` — order matters because `submit` must remain the last
component.

```jsonc
"user": {
  "title": "User",
  "type": "resource",
  "name": "user",
  "path": "user",
  "tags": [],
  "components": [
    { "type": "email",    "key": "email",    "label": "Email",
      "persistent": true, "unique": true, "protected": false,
      "inputType": "email", "placeholder": "Enter your email address",
      "input": true, "tableView": true },
    { "type": "password", "key": "password", "label": "Password",
      "persistent": true, "protected": true,
      "inputType": "password", "placeholder": "Enter your password.",
      "input": true, "tableView": false },
    /* extra profile fields go here */
    { "type": "button",   "key": "submit",   "label": "Submit",
      "action": "submit", "theme": "primary",
      "disableOnInvalid": true, "input": true }
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

### Custom user resources

When the app needs more than email/password (different login key, multiple
user types, a separate doctor/patient model), keep the default `user` resource
in place AND add custom resources alongside it. Do NOT rename `user` — the
platform looks for it by key. If you only have one user shape but need extra
fields, just add them to `user`.

If the app authenticates against a non-default user resource, the Login
action's `settings.resources` STILL emits as `["user"]` in standard
deployments. Adding a name the template does not declare (e.g., `"admin"`,
`"doctor"`) causes the project importer to reject the template.

### Login form

The login form has two actions: a Save Submission (the form does technically
submit) and the Login action that authenticates and issues the JWT.

```jsonc
"userLogin:save": {
  "title": "Save Submission",
  "name": "save",
  "form": "userLogin",
  "priority": 10,
  "method": ["create", "update"],
  "handler": ["before"]
},
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

`settings.username` and `settings.password` are the component keys on the
login form (NOT the user resource) that the action reads to look up
credentials. They almost always match the user-resource keys but they don't
have to.

`allowedAttempts` / `attemptWindow` / `lockWait` give brute-force protection.
Defaults: 5 attempts in 30 seconds, then a 30-minute lockout. Tune for the
threat model.

#### `settings.resources` — always `["user"]`

`settings.resources` is the array of user-type resource machine names the
login action authenticates against. Emit `["user"]` verbatim. **Do NOT add
`"admin"`** (or any other name the template doesn't itself declare) — the
Form.io project importer rejects the template.

Administrator responsibilities (seeding reference data, creating
group-membership rows, assigning roles, reviewing or moderating submissions)
are performed by an administrator signing in to the **Form.io project portal**,
not via the app's login form. Capture admin-only operations in your app's
documentation; do not design the in-app login surface around them.

### Register form

The register form is a thin form that COLLECTS signup fields and FORWARDS them
into the `user` resource. It carries three actions in this priority order:

1. **Save Submission** (priority 11) — writes the submitted fields into the
   `user` resource via the action's `settings.resource` + `settings.fields` map.
2. **Role Assignment** (priority 1, after-handler) — attaches the
   `authenticated` role to the new user.
3. **Login** (priority 2, before-handler) — issues a JWT so the user is
   signed in immediately.

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
},
"userRegister:role": {
  "title": "Role Assignment",
  "name": "role",
  "form": "userRegister",
  "priority": 1,
  "method": ["create"],
  "handler": ["after"],
  "settings": {
    "association": "new",
    "type": "add",
    "role": "authenticated"
  }
},
"userRegister:login": {
  "title": "Login",
  "name": "login",
  "form": "userRegister",
  "priority": 2,
  "method": ["create"],
  "handler": ["before"],
  "settings": {
    "resources": ["user"],
    "username": "email",
    "password": "password"
  }
}
```

`settings.fields` keys are the user-resource component keys; values are the
register-form component keys. They typically match but they do NOT have to —
the form can collect `signupEmail` and write it into `user.email`.

`association: "new"` means "the resource being created by this submission."
Use `"existing"` only on admin forms that target an already-existing user.

## Group-level permissions

The Group Assignment action (also called Group Permissions in older docs)
restricts who can read/write a submission based on group membership. Three
moving parts must all line up:

- A **group resource** (e.g., `Project`, `Team`, `Company`) — submissions are
  the groups themselves.
- A **join resource** (e.g., `ProjectUser`, `TeamUser`, `CompanyUser`) —
  M:N between users and groups; each row is a membership.
- The **Group Assignment action** on the join — when a membership is created,
  it writes ACL entries onto the referenced group submission so the user can
  read it.

That gets the user access to the GROUP. To make the group's access propagate
to its CHILD records, you need the second half (described below).

### Group-based access has two halves — both must land

When a child resource's access flows from a group, the configuration MUST
include both:

**Half 1 — the Group Assignment action on the join resource.**

```jsonc
"projectUser:group": {
  "title": "Group Assignment",
  "name": "group",
  "form": "projectUser",
  "priority": 5,
  "method": ["create"],
  "handler": ["after"],
  "settings": {
    "group": "project",
    "user":  "user"
  }
}
```

`settings.group` is the field key on the join resource whose `select` points
at the GROUP resource. `settings.user` is the field key whose `select` points
at the user resource. Both keys must exist on the join — the action looks
them up by name when the membership row is saved.

The join also needs a Save Submission action (priority 10) — Save and Group
Assignment co-exist on the join, they don't replace each other.

Only attach Group Assignment to join resources. Attaching it to a non-join
resource produces undefined behavior.

**Half 2 — field-based `submissionAccess` on every child's group-reference select.**

Every child resource that should inherit the group's access (e.g., `Task`
inheriting from `Project`, `Contact` inheriting from `Company`) needs a
four-entry `submissionAccess` block ON THE SELECT COMPONENT that points at
the group resource:

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
  "reference": true,
  "searchField": "data.name__regex",
  "validate": { "required": true },
  "input": true,
  "tableView": true,

  // The four empty-role entries are intentional — permissions are resolved
  // at runtime from the Group Assignment action's stored ACL on the
  // referenced group submission, not from static role lists.
  "submissionAccess": [
    { "type": "read",   "roles": [] },
    { "type": "create", "roles": [] },
    { "type": "update", "roles": [] },
    { "type": "delete", "roles": [] }
  ]
}
```

When to include the block: on **every** child-resource `select` whose target
acts as a group. Examples:

- `Task.project` where `Project` is the group (membership via `ProjectUser`)
- `Contact.company` where `Company` is the group (membership via `CompanyUser`)
- `Deal.company` where `Company` is the group

When NOT to include it: on selects that are not group references — e.g.,
`Task.assignee` (points at User as an attachment), `Deal.contacts` (points at
Contact as an attachment), a static-value status select, a country dropdown.

### The "missing half 2" silent bug

Skip half 2 and the failure mode is subtle: a logged-in user with a
`ProjectUser` membership can see the `Project` row they belong to, but they
canNOT see the `Task` rows attached to it. The `Task` resource's access
never inherits because nothing connects `Task` → `Project`'s ACL on the read
path.

Whenever a user reports "I can see the parent but not its children" or
"users only see records when they're admins", check half 2 first — every
group-reference select on every child resource needs the four-entry block.

### Reference selects — `reference: true`, never `valueProperty`

When a resource select uses `dataSrc: "resource"`, set `reference: true` and
**omit** `valueProperty`. With `reference: true`, Form.io stores the
submission as a resolvable reference — it can walk through it on read,
including transitively across multi-level hierarchies.

A bare `valueProperty: "_id"` only stores the raw ObjectId string. That
breaks two things:

- The runtime cannot resolve the linked submission, so any UI relying on
  `data.<select>.data.<field>` is broken.
- Transitive group access (next section) cannot calculate `data.parent.data.group`
  because `data.parent` is a string instead of a resolved submission.

Never add `valueProperty` to a `dataSrc: "resource"` select.

## Transitive group access — 2+ levels below the group

When a resource sits two or more levels below the group in the hierarchy
(e.g., `Contact`/`Deal`/`Activity` under `Account`, with `Team` as the group
on `Account`), the sub-resource has no direct relationship to the group.
The half-2 pattern from above cannot point at the group directly.

Solution: every sub-resource carries TWO reference selects.

1. A **normal parent reference** pointing at the immediate parent (e.g.,
   `account` on `Contact`). Standard shape — `reference: true`, no
   `submissionAccess`. This is the field the user actually fills.
2. A **hidden, calculated mirror of the group field** (e.g., `team` on
   `Contact`). Auto-populated from the parent's resolved group reference.
   Carries the same four-entry `submissionAccess` block as the direct
   group-reference select.

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
  "hidden": true,
  "calculateValue": "value = data.account.data.team;",
  "refreshOn": "account",

  "validate": { "required": true },
  "reference": true,
  "input": true,
  "tableView": true,

  "submissionAccess": [
    { "type": "read",   "roles": [] },
    { "type": "create", "roles": [] },
    { "type": "update", "roles": [] },
    { "type": "delete", "roles": [] }
  ]
}
```

### The `calculateValue` pattern

The expression always follows: `value = data.<parentKey>.data.<groupKey>;`

- `<parentKey>` — the key of the immediate parent's select on this form
  (e.g., `account` on `Contact`).
- `<groupKey>` — the key of the group-reference select on the parent
  resource (e.g., `team` on `Account`).

Because the parent's select uses `reference: true`, Form.io resolves the
parent into a full submission object on read, so `data.account.data.team`
walks the resolved account's data to fetch its team value. The mirror
itself also uses `reference: true` — it stores the same kind of resolvable
reference as the original.

### What makes the mirror different from a normal group-reference select

Only three properties:

- `hidden: true` — invisible to the user
- `calculateValue: "value = data.<parent>.data.<group>;"` — auto-populated
- `refreshOn: "<parent>"` — recalculate when the parent changes

Everything else (`reference: true`, the four-entry `submissionAccess`,
`validate.required`) is identical to a direct group-reference select.

### When to add a mirror

Walk the path from the resource to the group. If you have to traverse more
than one `select` to get there, add a mirror. A single-hop child
(`Account.team`) uses the direct group-reference select pattern — no mirror
needed. A two-hop grandchild (`Contact.team`, calculated from `Contact.account`)
needs a mirror. A three-hop great-grandchild
(`Activity.team`, calculated from `Activity.deal`) needs its own mirror,
sourced from `data.deal.data.team`.

Every level of the hierarchy below the direct child repeats this mirror so
group access flows all the way down. Put the mirrored field adjacent to the
parent reference (usually right after it) — the user won't see it because
of `hidden: true`, but it keeps the form definition readable for whoever
maintains the template.

## Role-based access — layering on top

Roles let you carve out admin-only operations on top of any owner / group
rule. Role-based access does NOT need a join resource — Form.io enforces it
directly via `submissionAccess` types like `read_all`, `update_all`,
`create_own`, `read_own`, etc.

Common combinations:

```jsonc
// Admin-only resource (joins, system records):
"submissionAccess": [
  { "type": "create_all", "roles": ["administrator"] },
  { "type": "read_all",   "roles": ["administrator"] },
  { "type": "update_all", "roles": ["administrator"] },
  { "type": "delete_all", "roles": ["administrator"] }
]

// Owner-level access (private notes, user-owned records):
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

// Login / register forms (data is forwarded into user, not stored here):
"submissionAccess": [
  { "type": "create_own", "roles": ["anonymous"] }
]
```

Group-based access is enforced at runtime by the Group Assignment action and
the field-based `submissionAccess` block on the child select — you do NOT
encode it in the resource-level `submissionAccess` on child resources. Leave
that array tuned for whatever role-level rules apply ON TOP of group access
(e.g., admin always sees all, role-X always sees all).

## Verification checklist

Before considering an auth-and-permissions configuration done, walk this list:

- [ ] The `user` resource exists and is named `user` (do not rename).
- [ ] The login form has both a Save action (priority 10) and a Login action (priority 2).
- [ ] Every Login action's `settings.resources` is exactly `["user"]`.
- [ ] The register form has Save (priority 11), Role Assignment (priority 1), and Login (priority 2) — three actions, that order.
- [ ] The Save action on the register form has `settings.resource: "user"` and a `settings.fields` map.
- [ ] Every join resource that governs group access has BOTH a Save action AND a Group Assignment action.
- [ ] Every Group Assignment action's `settings.group` and `settings.user` match field keys on the join resource it's attached to.
- [ ] **Every child resource whose access flows from a group has a four-entry `submissionAccess` block on the `select` component that references the group.**
- [ ] **Every resource 2+ levels below the group has a hidden, calculated mirror of the group select, with `calculateValue: "value = data.<parent>.data.<group>;"`, `refreshOn: "<parent>"`, `reference: true`, and the same four-entry `submissionAccess` block.**
- [ ] Every Role Assignment action references a role that exists in the project's `roles`.
- [ ] No resource select has `valueProperty` — all use `reference: true` instead.

## Tracing a flow end-to-end

When something is broken, trace one complete flow before changing anything:

1. User submits `userRegister` → Save writes an entry into `user` →
   Role Assignment adds `authenticated` → Login issues a JWT.
2. Admin (via the Form.io project portal) creates a `ProjectUser` row tying
   the new user to a `Project` → Group Assignment writes an ACL entry on
   that `Project` submission.
3. User navigates to the app, calls `GET /project/submission` with the JWT →
   Form.io returns the projects whose ACL matches the user's identity.
4. User opens a project, calls `GET /task/submission?data.project=<projectId>`
   → Form.io evaluates the Task's `project` select's field-based
   `submissionAccess`, walks the linked Project's ACL, and returns the Tasks
   the user has access to.
5. (Transitive case.) User opens an Account, calls `GET /contact/submission`
   → Form.io reads the Contact's hidden `team` mirror, evaluates its
   field-based `submissionAccess`, walks the linked Team's ACL, and returns
   the Contacts the user has access to.

Any link in that chain that is missing or misconfigured manifests as
"users can't see records." The verification checklist above catches each
of those links.

## Common pitfalls

- **Adding `"admin"` to a Login action's `settings.resources`.** Causes the
  project importer to reject the template. Always emit `["user"]` only.
- **Forgetting half 2.** Most common silent bug. Symptom: user sees the
  parent (`Project`, `Company`) but not its children (`Task`, `Contact`).
  Fix: add the four-entry `submissionAccess` block to every child's
  group-reference select.
- **Using `valueProperty: "_id"` on a resource select.** Breaks transitive
  group access because `data.<parent>.data.<group>` cannot resolve. Use
  `reference: true` and omit `valueProperty`.
- **Putting Group Assignment on a non-join resource.** It needs `settings.group`
  and `settings.user` field keys; non-join resources don't have both.
- **Skipping the mirror on grandchildren.** Symptom: direct children
  (`Account`) inherit group access fine, but grandchildren (`Contact`, `Deal`)
  are invisible to non-admin users. Add the hidden calculated mirror.
- **Conflating `access` and `submissionAccess`.** Locking `access` down
  prevents the form from rendering at all. The access-control story almost
  always lives in `submissionAccess`.

## When to look up more

- Roles and permissions: https://help.form.io/developers/roles-and-permissions
- Group Assignment action: https://help.form.io/userguide/forms/form-building/actions#group-assignment
- Login action: https://help.form.io/userguide/forms/form-building/actions#login
- Role Assignment action: https://help.form.io/userguide/forms/form-building/actions#role-assignment
- Action anatomy (handler, method, priority, conditions): see `formio-actions`
- Full project export schema (every resource shape, every action shape): see `formio-resource-planner/references/template-json.md`
- Multi-tenant isolation (platform tenants, separate from group permissions): see `formio-api/references/platform-tenants`

## What this skill does NOT do

- **Does not plan a resource model.** Designing entities, fields, and
  relationships is `formio-resource-planner`'s job. This skill is the
  reference for HOW to wire auth + permissions once the model is decided.
- **Does not cover every action type.** For email, webhook, reset password,
  conditional execution, priority math, or 2FA, see `formio-actions`.
- **Does not look up REST endpoints.** See `formio-api`.
- **Does not call the MCP server on its own.** The MCP Tool Preference table
  above tells you which tools to use; this skill is the reference for what
  to send.
