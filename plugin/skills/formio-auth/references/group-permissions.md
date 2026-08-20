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
3. **Attach a Group Assignment Action to the `user` Resource** — `name: "group"`, `priority: 5`, `method: ["create", "update", "delete"]`, `handler: ["after"]`. The Action's settings name the `user` Resource's own keys:
   - `settings.group` — the key of the group-reference field on the `user` Resource (e.g. `"team"`).
   - `settings.user` — **omit it entirely.** With the join-less shape the submission itself IS the user, and the Action selects that path by finding NO `user` setting at all (its settings form labels the field `self` and leaves it optional). Do not set it to `"_id"`: the Action resolves this setting as a data key (`data.<setting>`), so `"_id"` looks for `data._id`, finds nothing, and the Action fails with "Could not find the user resource for group assignment action."
4. **Add the field-based `submissionAccess` block** to every child Resource's group-reference `select` exactly as documented under "Single-level group access (two halves, plus a read grant on the group)" below. The platform's runtime resolver looks the same in either shape — it does not care whether the membership came from a join Resource or from a field on the `user`.

Update semantics for one-to-many:

- Changing the user's `team` field re-issues their group ACLs — but ONLY because the Action fires on `update`. The Action computes membership by diffing the submitted row against the previous one, so the old group is withdrawn and the new one granted in the same pass. With `method: ["create"]` the field can be changed freely and nothing happens.
- If the requirement is "user can be a member of multiple teams simultaneously," this shape will not work — switch to many-to-many.

### Many-to-many group access (user ↔ multiple groups via join)

Use when a user belongs to multiple teams / departments / tenants concurrently. Memberships are first-class rows in a join Resource so each (user, group) pairing can be created or revoked independently.

Setup steps:

1. **Create the group Resource** — same as the one-to-many case.
2. **Create a join Resource** — `UserTeam`, `UserDepartment`, `ProjectUser`, etc. One row per (user, group) membership. Carries at minimum two `select` components (both `reference: true`):
   - `user` — points at the `user` Resource.
   - A group-reference field (e.g. `team`) — points at the group Resource. Add metadata fields (`role`, `joinedAt`, `invitedBy`) on the join itself when needed.
3. **Attach a Group Assignment Action to the join Resource** — `name: "group"`, `priority: 5`, `method: ["create", "update", "delete"]`, `handler: ["after"]`. Settings name the join's own keys:
   - `settings.group` — the group-reference field on the join (e.g. `"team"`).
   - `settings.user` — the user-reference field on the join (e.g. `"user"`).
4. **Add the field-based `submissionAccess` block** to every child Resource's group-reference `select` (same shape as below).

Revocation semantics:

- Deleting a join row revokes the user's membership in that group — but ONLY because the Action fires on `delete`. Revocation is the diff of the removed row against nothing; with `method: ["create"]` the row disappears and the membership survives. Changing a join row's group field moves the membership the same way, via `update`.
- Add a Save-Submission filter or Delete Action to the join Resource if you need an audit log of membership changes.

For the canonical Group Assignment Action JSON shape and the join Resource shape, see `plugin/skills/formio-resource-planner/references/template-json.md` → "Group Assignment (Group Permissions)".

### Single-level group access (two halves, plus a read grant on the group)

**Half 1 — Group Assignment Action on the join Resource:**

- `name: "group"`, `priority: 5`, `method: ["create", "update", "delete"]`, `handler: ["after"]`.
- `settings.group` names the join field that holds the group reference (e.g. `"project"`).
- `settings.user` names the join field that holds the user reference (e.g. `"user"`).
- On every join submission the platform stores an ACL on the referenced group submission tying the user to the group.

For the canonical Group Assignment Action JSON shape, see `plugin/skills/formio-resource-planner/references/template-json.md` → "Group Assignment (Group Permissions)".

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

Empty `roles` is intentional. The entries declare **which permissions the server stamps onto the saved row's own `access` array**, keyed to the group submission this field references; a request is then resolved against that stamp by the caller's group memberships. The stamping happens on every write, and the row's `access` is rebuilt from the component block each time.

The type vocabulary is wider than the four CRUD names, and the choice is a real access decision:

| Entry type | Group member may                           | In list results?    |
| ---------- | ------------------------------------------ | ------------------- |
| `read`     | read                                       | yes                 |
| `create`   | create rows referencing this group         | authorizes the POST |
| `update`   | update                                     | no, on its own      |
| `delete`   | permanently delete any of the group's rows | no, on its own      |
| `write`    | read + create + update, NOT delete         | yes                 |
| `admin`    | all four                                   | yes                 |

So the four-entry block above is equivalent to `admin`, and it lets any member permanently delete any row belonging to their group — not only rows they created. Use `write` when deletion should remain with administrators. `defaultPermission: "<type>"` on the component is the legacy single-value spelling of the same thing.

Two boundaries worth stating plainly, because both produce silent failures:

- **Create is covered by this block** — the server reads the group reference out of the submitted payload and authorizes the create from it. A group-scoped child therefore needs no `create_own`, and adding one would additionally permit creating rows outside the group. What it does need is a create-conferring type (`create`, `write`, or `admin`) and a payload that actually carries the group reference as an object with an `_id`.
- **The group resource itself is not covered.** Nothing stamps a group row's own `access`, and membership does not confer read of the group record — read checks and reference population consult `read_all` roles and ownership only. The group resource needs `read_all` for the end-user role, which is also what lets the `dataSrc: "resource"` select populate; an empty select means no group reference in the payload, which means every group-scoped create fails with `Unauthorized` while reads keep working.

For the canonical group-reference select shape, see `plugin/skills/formio-resource-planner/references/template-json.md` → "select — reference to a **group** resource".

### The assigner must have update access on the group

The Action does not grant memberships blindly. Every group it is about to add or remove is first passed through an internal permission check that asks whether **the user making this request** could `PUT` the group submission — i.e. holds update access on the group record itself. Groups that fail are silently dropped from the assignment, and the request still succeeds: the membership row saves, the Action reports no error, and the user ends up with no membership at all.

`update_own` on the group resource is enough, and it is the right answer rather than a loophole: whoever created the group owns that row, so they can assign into groups **they own** and into no others. The check is what makes membership assignment self-policing.

Three workable shapes follow:

- **Administrator-mediated** — the admin holds `update_all`, so every assignment verifies. Put `create` on the join at `administrator` only. This is what both planner examples do.
- **Owner-mediated self-serve** — the group resource grants the end-user role `create_all` (anyone may create a group) plus `read_own` and `update_own` (you manage the groups you created), and the join grants that role `create`. The group's creator can then join themselves and invite others into their own group, with no administrator involved. Verified end to end against a live project.
- **Broader update** — granting the end-user role `update_all` on the group makes anyone able to assign anyone into any group, and to edit every group record. Rarely what anyone wants; prefer one of the two above.

The asymmetry in the owner-mediated shape is worth stating in the plan, because it is silent: a member who does **not** own the group cannot add anybody to it. Their membership row saves and confers nothing. "Any member can invite a teammate" therefore requires either an admin-mediated invite or update access on the group for members, not merely `create` on the join.

### A group's creator is not automatically a member of it

Creating a group grants no membership in it. The Group Assignment Action fires on the **join** resource, so until a join row exists linking the creator to the group they just made, they hold no group role — and every group-scoped read, create, update, and delete on that group's children is refused. Nothing errors along the way: the group saves, the UI navigates to it, and the first child list is empty and the first child create returns `Unauthorized`.

So any app where end users create groups at runtime must create the creator's membership row as part of that flow — immediately after the group is saved, in the same code path, using the creator's own credentials (which verify, because they own the new group). An app that only offers a members list to _read_ leaves every self-created group permanently inert. This is the single most common way a correctly-structured group model still fails in practice, because every piece of it is individually right.

### Group permissions require a paid plan

The group-scoped list filter is gated on the project's plan: outside `team`, `commercial`, and `trial` it is skipped, and index requests fall back to own-plus-public rows. On a basic or expired project a group member's list silently returns only their own submissions, while single-record access still resolves. Confirm the plan before diagnosing a group-permissions bug from list behavior alone.

### Assigning a role within the group

The Action has a third, optional setting — `role` — naming a field on the same form that carries a role value. When it is set, memberships are stored as composite `"<groupSubmissionId>:<role>"` entries rather than bare group ids, and the field-based block's `roles` array is what selects among them: a non-empty `roles` on a block entry stamps `"<groupId>:<role>"` pairs, so only members holding that role within the group match. Leave `role` unset and the block's `roles` empty — the common case — and membership is uniform across the group.

### Transitive group access (three levels)

When a Resource is a grandchild of the group (e.g. `lineItem` belongs to `order` belongs to `account`), the child carries the group reference but the grandchild does not. Without help, the grandchild has no way to inherit the account's ACL.

The fix is a **hidden calculated mirror**: a hidden `select` on the grandchild that mirrors the child's group reference, with the same four-entry `submissionAccess` block. The platform resolves the grandchild's permissions against the mirrored group exactly as if the grandchild had its own group field:

The mirror carries one non-obvious constraint at create time: the access check reads the mirrored key straight out of the request body, and `calculateValue` has not been evaluated yet, so the value must already be in the payload. A rendered form supplies it (Form.io calculates client-side before submit); a client that posts only the parent reference — even with the parent's nested group data included — is refused with `Unauthorized`. Verified live: bare parent reference `401`, mirrored value present `201`.

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

For the canonical transitive-mirror shape, see `plugin/skills/formio-resource-planner/references/template-json.md` → "select — reference to a **group** resource" and "select — transitive group-access mirror".

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

- `formio-resource-planner` — owns the canonical Group Assignment Action JSON shape, group-reference select shape, and transitive mirror shape. Run the planner first if your data model does not yet include a join Resource or a group-reference select. See `plugin/skills/formio-resource-planner/references/template-json.md` → "select — reference to a **group** resource", "select — transitive group-access mirror", and "Group Assignment (Group Permissions)", and the `complex-crm-transitive` example.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — how the eight permission types interact with group ACLs.
- [`resource-auth.md`](./resource-auth.md) — how a user's roles + group memberships combine into the effective access set the JWT carries.
- [`../../formio-api/references/runtime-access-control.md`](../../formio-api/references/runtime-access-control.md) — the authoritative runtime description, endpoint by endpoint: the Group Assignment Action grants the user a role tied to the group submission, and the field-based block makes the server stamp the new row's `access` with that group id. Read it when the mechanism itself is in question rather than the shape of the JSON.
