# Access patterns — owner, group, role, and the two access arrays

How `formio-resource-planner` maps access requirements onto Form.io constructs. Read this whenever the plan has any owner-, group-, or role-based access — especially group access, which has a silent-failure mode described below.

## Access patterns

| Pattern | Form.io construct |
| --- | --- |
| Owner-only ("my records") | Submission Access on the resource: `read/update/delete = Owner` |
| Group-based ("my team's records") | Three parts, all required: (a) a join resource (user ↔ group) with a Group Assignment action; (b) on every child resource that inherits the group's access, a field-based `submissionAccess` block on the `select` that points at the group, with types chosen deliberately; (c) `read_all` for the end-user role on the group resource itself, without which the group select cannot populate and group-scoped creates fail |
| Role-based ("admins see all") | Project roles (`administrator`, `authenticated`, custom). Gate resource access with roles. Assign roles on signup with a Role Assignment action |
| Tenant-based ("strict customer isolation") | Platform tenants — out of scope for this skill; point the user at `formio-api/references/platform-tenants` |

## Group-based access has three parts — all must land

When a child resource's access flows from a group, the plan must include all three:

1. **The Group Assignment action on the join resource** (e.g., `projectUser:group` with `settings: { group: "project", user: "user" }`). It writes the group submission's id into the member's `roles`, which is what every later check resolves against.
2. **A field-based `submissionAccess` block on the child's group-reference select component** (e.g., on `Task.project`, on `Contact.company`), with `roles: []` on each entry. On every write the server rebuilds that row's own `access` from this block, keyed to the referenced group. The entry types decide what members may do — `read`, `create`, `update`, `delete`, or the shorthands `write` (read + create + update, no delete) and `admin` (all four). This block is the whole mechanism, create included; a group-scoped child needs no `create_own`, and adding one would authorize creating rows outside the group.
3. **A `read_all` grant for the end-user role on the group resource itself.** Nothing stamps a group row's own `access`, and group membership does not confer read of the group record. Without this the group's name cannot render and — more damagingly — the `dataSrc: "resource"` select cannot populate, so no group reference reaches the payload and every group-scoped create fails. The cost is that every end user can read every group row; the group model offers no membership-scoped alternative here.

## Four silent failure modes

**Missing part 2.** The user logs in and sees the Project they're a member of, but not the Tasks attached to it — the child's access never inherits.

**Missing part 3.** Reads of existing rows work, and every create returns `Unauthorized`, because the group select was empty and the payload carried no group reference. Nothing fails loudly on the way there: the import succeeds, the front-end builds, unit tests pass, and the defect surfaces the first time a human clicks "New task".

**No membership row for the group's creator.** When end users create groups at runtime, creating the group grants no membership in it — the Group Assignment action fires on the join, so until a join row links the creator to their new group they hold no group role, and every child read and create under it is refused. The group saves, the UI navigates to it, the first list is empty, the first create returns `Unauthorized`. Plan the membership write as part of the group-creation flow, and say so in the Resource Map so the framework skill wires it. Self-serve group creation additionally needs `create_all` plus `read_all` and `update_own` for the end-user role on the group resource — `update_own` because the assignment is verified against the requester's update access on the group record they are assigning into, and `read_all` because nothing stamps a group row's own `access`, so a member who did not create the group can read it no other way.

**A block whose types don't match the Access Matrix.** The four-entry CRUD block confers delete on every group member. If the matrix's `delete` column says `—`, the template contradicts the plan and the template wins at runtime — any member can permanently delete any of their group's rows. Choose `write` when deletion should stay with administrators.

Call out all three parts in the Phase A map and emit all three in Phase B. `template-md.md` → "Token → `template.json` mapping" gives the per-cell mapping, and `packages/skill-tests/src/formio-resource-planner/example-access-consistency.test.ts` enforces it over the checked-in examples.

See `template-json.md` → "Choosing the types" for the full type menu and the delete decision, and [`../../formio-api/references/runtime-access-control.md`](../../formio-api/references/runtime-access-control.md) for the runtime description.

## Transitive group access — 2+ levels below the group

Part 2 above covers **direct children** of the group. When the hierarchy goes deeper — e.g., `Team` is the group on `Account`, and `Contact`, `Deal`, `Activity` sit under `Account` — the grandchildren have no direct relationship with the group, so a plain group-reference select won't work. Use this pattern instead:

Each sub-resource (grandchild or deeper) carries **two** reference selects:

1. A **normal parent reference** pointing at the immediate parent (e.g., `account` on `Contact`). Standard shape: `reference: true`, no `submissionAccess`. This is the field the user actually fills.
2. A **hidden, calculated mirror of the group field** (e.g., `team` on `Contact`). This is what actually propagates group access. Only three properties distinguish it from a normal group-reference select:
   - `hidden: true` — invisible to the user
   - `calculateValue: "value = data.<parent>?.data?.<group> || value;"` — auto-populated from the parent's resolved group reference (e.g., `value = data.account?.data?.team || value;`). Emit the guard verbatim: without `?.` the expression throws on every load where the parent reference is not expanded, and without `|| value` a nil result is replaced by the component's `emptyValue`, clearing the group reference and stripping access. See `template-json.md` → "select — transitive group-access mirror".
   - `refreshOn: "<parent>"` — recalculate when the parent selection changes
   - Everything else is the same: `reference: true`, `validate.required: true`, and the same field-based `submissionAccess` block as the direct child's group-reference select — same entry types

Every level of the hierarchy below the direct child repeats this mirror, so group access flows all the way down. A Contact, a Deal, an Activity-under-Deal — each one gets its own `team` mirror on the form.

In the Phase A Resource Map, call out the mirror explicitly on every sub-resource. Example annotation:

```
- Contact (type: resource)
  Purpose: an individual person belonging to one Account.
  Fields:
    - firstName, lastName, email, phone, notes: standard
    - account: select (resource=Account) — parent account (user-visible)
    - team: select (resource=Team, hidden, calculated from account.team) —
            invisible mirror that propagates group access from Account's team
  Access: group-via-TeamUser, inherited transitively through account.team
```

See `template-json.md` → "select — transitive group-access mirror" for the exact JSON. A complete worked example (`Team → Account → Contact/Deal/Activity`) is checked in at [`examples/complex-crm-transitive/`](./examples/complex-crm-transitive/) (Phase A map in `template.md`, importable Phase B template in `template.json`). When the user describes a hierarchy with a group at the top and grandchildren below, refer to that example as the structural reference.

## Two different access arrays (don't conflate)

Every resource and form carries two access arrays. Keep them separate in your plan:

- **`access`** — who can _load the form/resource definition itself_ (the metadata, component tree). Default for every resource: `read_all` granted to **all three base roles** (`administrator`, `anonymous`, `authenticated`). The form definition is public metadata — locking it down here is rarely what the user wants.
- **`submissionAccess`** — who can _create/read/update/delete submissions_ (the actual data rows). This is where the real access-control story lives: `create_all`/`read_all`/... for administrators, `read_own`/`update_own` for owner-level access, and so on.

When the user describes access ("reps only see their company's deals"), they almost always mean `submissionAccess`. Say so explicitly in the output. Leave the `access` default wide-open unless the plan specifically needs a resource whose definition is not world-readable.
