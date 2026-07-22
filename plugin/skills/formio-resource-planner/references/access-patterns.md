# Access patterns — owner, group, role, and the two access arrays

How `formio-resource-planner` maps access requirements onto Form.io constructs. Read this whenever the plan has any owner-, group-, or role-based access — especially group access, which has a silent-failure mode described below.

## Access patterns

| Pattern | Form.io construct |
| --- | --- |
| Owner-only ("my records") | Submission Access on the resource: `read/update/delete = Owner` |
| Group-based ("my team's records") | Two halves, both required: (a) a join resource (user ↔ group) with a Group Assignment action; (b) on every child resource that inherits the group's access, a four-entry `submissionAccess` block on the `select` component that points at the group |
| Role-based ("admins see all") | Project roles (`administrator`, `authenticated`, custom). Gate resource access with roles. Assign roles on signup with a Role Assignment action |
| Tenant-based ("strict customer isolation") | Platform tenants — out of scope for this skill; point the user at `formio-api/references/platform-tenants` |

## Group-based access has two halves — both must land

When a child resource's access flows from a group, the plan must include both:

1. **The Group Assignment action on the join resource** (e.g., `projectUser:group` with `settings: { group: "project", user: "user" }`). This registers user-to-group memberships.
2. **A field-based `submissionAccess` block on the child's group-reference select component** (e.g., on `Task.project`, on `Contact.company`). The block has four entries — `read`, `create`, `update`, `delete` — each with `roles: []`. The empty roles are intentional: permissions are resolved at runtime from the group submission's ACL, not from static role lists.

## Gotcha

Missing half 2 is a silent bug. The user can log in and see the Project they're a member of, but they cannot see the Tasks attached to it because Task's access never inherits. Always call out both halves in the Phase A map, and always emit both halves in Phase B.

See `template-json.md` for the exact JSON shape of the field-based submissionAccess block.

## Transitive group access — 2+ levels below the group

Half 2 above covers **direct children** of the group. When the hierarchy goes deeper — e.g., `Team` is the group on `Account`, and `Contact`, `Deal`, `Activity` sit under `Account` — the grandchildren have no direct relationship with the group, so a plain group-reference select won't work. Use this pattern instead:

Each sub-resource (grandchild or deeper) carries **two** reference selects:

1. A **normal parent reference** pointing at the immediate parent (e.g., `account` on `Contact`). Standard shape: `reference: true`, no `submissionAccess`. This is the field the user actually fills.
2. A **hidden, calculated mirror of the group field** (e.g., `team` on `Contact`). This is what actually propagates group access. Only three properties distinguish it from a normal group-reference select:
   - `hidden: true` — invisible to the user
   - `calculateValue: "value = data.<parent>.data.<group>;"` — auto-populated from the parent's resolved group reference (e.g., `value = data.account.data.team;`)
   - `refreshOn: "<parent>"` — recalculate when the parent selection changes
   - Everything else is the same: `reference: true`, `validate.required: true`, and the four-entry `submissionAccess` block

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
