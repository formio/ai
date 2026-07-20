# Group permissions

## Overview

Group permissions are Form.io's mechanism for "users on the same team see the same records, users on other teams do not." They layer on top of role-based access using two pieces working in tandem: a Group Assignment Action on a join Resource (records the user's membership in a group), and a field-based `submissionAccess` block on each child Resource's group-reference `select` (resolves the membership at runtime). For multi-level hierarchies, a hidden calculated mirror on grandchild Resources propagates group membership transitively.

## When to use this

Reach for group permissions when the user wants:

- "Members of project X can read tasks belonging to project X."
- "Team members see only their team's customers."
- Multi-tenant data isolation inside a single Form.io project.
- Hierarchies where group membership cascades down two or more levels.

Not for:

- Owner-only patterns (use direct `submissionAccess: read_own`/`update_own`) → see [`roles-and-permissions.md`](./roles-and-permissions.md).
- Pure role-based access without group affinity → see [`roles-and-permissions.md`](./roles-and-permissions.md).
- Field-Match-Based Access (gates by literal field values, not group joins) → see Form.io docs at `/developers/roles-and-permissions/field-match-based-access.md`.

## Configuration

### The group model in three parts

1. **A "group" Resource** — the entity that owns records. Examples: `project`, `team`, `account`.
2. **A membership carrier** — the record that ties a user to a group. Two shapes, picked by cardinality:
   - **One-to-many** (user belongs to exactly one group): a group-reference `select` on the `user` Resource itself. No join Resource.
   - **Many-to-many** (user belongs to many groups): a separate join Resource (`UserTeam`, `UserDepartment`, etc.) with a `user` reference and a group reference, one row per membership.
3. **A "child" Resource** — the data owned by the group. Examples: `task` (owned by `project`), `customer` (owned by `team`). Holds a group-reference `select` component that points back to the group Resource.

The planner's `complex-crm-transitive` example walks through the many-to-many shape with multiple levels: see `plugin/skills/formio-resource-planner/references/examples/complex-crm-transitive/`.

### Picking the membership shape

Decide cardinality first, because it dictates where the Group Assignment Action lives:

| User belongs to … | Shape        | Group Assignment Action attaches to  |
| ----------------- | ------------ | ------------------------------------ |
| Exactly one group | One-to-many  | The `user` Resource                  |
| Many groups       | Many-to-many | The join Resource (`UserTeam`, etc.) |

If the requirement might evolve from one-to-many to many-to-many later, start with many-to-many — migrating from a `select` on `user` to a join Resource after data has been written is a non-trivial backfill.

### One-to-many group access (user → single group)

Use when a user belongs to exactly one team / department / tenant at a time. No join Resource is needed; the membership lives directly on the `user` Resource as a single group-reference field.

Setup steps:

1. **Create the group Resource** — `Team`, `Department`, `Tenant`, `Organization`, etc. Standard Form.io Resource with whatever profile fields the group itself needs.
2. **Add a group-reference `select` to the `user` Resource** — a `select` component (`reference: true`) keyed (for example) `team` that points at the group Resource. This is the field the platform reads to determine membership.
3. **Attach a Group Assignment Action to the `user` Resource** — `name: "group"`, `priority: 5`, `method: ["create"]`, `handler: ["after"]`. The Action's settings name the `user` Resource's own keys:
   - `settings.group` — the key of the group-reference field on the `user` Resource (e.g. `"team"`).
   - `settings.user` — `"_id"` (or whichever field on the user submission represents the user; with the join-less shape, the submission itself IS the user, so the user reference is the submission `_id`).
4. **Add the field-based `submissionAccess` block** to every child Resource's group-reference `select` exactly as documented under "Single-level group access (two halves)" below. The platform's runtime resolver looks the same in either shape — it does not care whether the membership came from a join Resource or from a field on the `user`.

Update semantics for one-to-many:

- Changing the user's `team` field re-issues their group ACLs on next login (or on next token refresh). Old-group rows fall out of read access immediately.
- If the requirement is "user can be a member of multiple teams simultaneously," this shape will not work — switch to many-to-many.

### Many-to-many group access (user ↔ multiple groups via join)

Use when a user belongs to multiple teams / departments / tenants concurrently. Memberships are first-class rows in a join Resource so each (user, group) pairing can be created or revoked independently.

Setup steps:

1. **Create the group Resource** — same as the one-to-many case.
2. **Create a join Resource** — `UserTeam`, `UserDepartment`, `ProjectUser`, etc. One row per (user, group) membership. Carries at minimum two `select` components (both `reference: true`):
   - `user` — points at the `user` Resource.
   - A group-reference field (e.g. `team`) — points at the group Resource. Add metadata fields (`role`, `joinedAt`, `invitedBy`) on the join itself when needed.
3. **Attach a Group Assignment Action to the join Resource** — `name: "group"`, `priority: 5`, `method: ["create"]`, `handler: ["after"]`. Settings name the join's own keys:
   - `settings.group` — the group-reference field on the join (e.g. `"team"`).
   - `settings.user` — the user-reference field on the join (e.g. `"user"`).
4. **Add the field-based `submissionAccess` block** to every child Resource's group-reference `select` (same shape as below).

Revocation semantics:

- Deleting a join row revokes the user's membership in that group; their ACL on the group's records drops on next token refresh.
- Add a Save-Submission filter or Delete Action to the join Resource if you need an audit log of membership changes.

For the canonical Group Assignment Action JSON shape and the join Resource shape, see `plugin/skills/formio-resource-planner/references/template-json.md` lines 555–590.

### Single-level group access (two halves)

**Half 1 — Group Assignment Action on the join Resource:**

- `name: "group"`, `priority: 5`, `method: ["create"]`, `handler: ["after"]`.
- `settings.group` names the join field that holds the group reference (e.g. `"project"`).
- `settings.user` names the join field that holds the user reference (e.g. `"user"`).
- On every join submission the platform stores an ACL on the referenced group submission tying the user to the group.

For the canonical Group Assignment Action JSON shape, see `plugin/skills/formio-resource-planner/references/template-json.md` lines 555–576.

**Half 2 — Field-based `submissionAccess` on the child Resource's group-reference select:**

The `select` component on the child Resource that references the group must carry a four-entry `submissionAccess` block with empty `roles` arrays:

```json
{
  "type": "select",
  "key": "project",
  "reference": true,
  "submissionAccess": [
    { "type": "read", "roles": [] },
    { "type": "create", "roles": [] },
    { "type": "update", "roles": [] },
    { "type": "delete", "roles": [] }
  ]
}
```

Empty `roles` is intentional. The platform resolves permissions at runtime from the group's ACL — the user has `read` / `create` / `update` / `delete` on a child submission if and only if they are a member of the group named by this field. The platform's resolver fills in the effective roles per-request; you do not enumerate them statically.

For the canonical group-reference select shape, see `plugin/skills/formio-resource-planner/references/template-json.md` lines 297–327.

### Transitive group access (three levels)

When a Resource is a grandchild of the group (e.g. `lineItem` belongs to `order` belongs to `account`), the child carries the group reference but the grandchild does not. Without help, the grandchild has no way to inherit the account's ACL.

The fix is a **hidden calculated mirror**: a hidden `select` on the grandchild that mirrors the child's group reference, with the same four-entry `submissionAccess` block. The platform resolves the grandchild's permissions against the mirrored group exactly as if the grandchild had its own group field:

```json
{
  "label": "Team",
  "key": "team",
  "type": "select",
  "hidden": true,
  "calculateValue": "value = data.account.data.team;",
  "refreshOn": "account",
  "reference": true,
  "submissionAccess": [
    { "type": "read", "roles": [] },
    { "type": "create", "roles": [] },
    { "type": "update", "roles": [] },
    { "type": "delete", "roles": [] }
  ]
}
```

For the canonical transitive-mirror shape, see `plugin/skills/formio-resource-planner/references/template-json.md` lines 297–376.

### Resource Map vocabulary

The planner annotates group-based access in its Resource Map with tokens like:

- `group(<joinName>)` — submission access via a specific join.
- `group` — submission access via the canonical join for that child.

Use those tokens when planning the project; once the resources are deployed, this skill takes over for any tuning beyond what the planner emits.

## MCP Tool Preference

- `form_get` — inspect the existing group-reference `select` on a child Resource before editing.
- `form_update` — add or modify the four-entry field-based `submissionAccess` block on a group-reference select, or add the hidden calculated mirror on a grandchild.
- `action_create` — attach the Group Assignment Action to the join Resource.
- `action_list`, `action_get`, `action_update` — inspect or change an existing Group Assignment Action's `settings.group` / `settings.user` keys.
- `project_export` / `project_import` — round-trip the full group graph (join Resource + Group Assignment Action + child group-reference selects + grandchild mirrors) in a `template.json`.

`action_type_get` for the `group` action type is also useful to confirm the `settings` schema before you create the action.

## See also

- `formio-resource-planner` — owns the canonical Group Assignment Action JSON shape, group-reference select shape, and transitive mirror shape. Run the planner first if your data model does not yet include a join Resource or a group-reference select. See `plugin/skills/formio-resource-planner/references/template-json.md` lines 297–376 and 555–590, and the `complex-crm-transitive` example.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — how the eight permission types interact with group ACLs.
- [`resource-auth.md`](./resource-auth.md) — how a user's roles + group memberships combine into the effective access set the JWT carries.
