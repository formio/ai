# Roles and permissions (RBAC)

## Overview

Form.io authorization is role-based. Every authenticated user object carries a `roles` array of MongoDB IDs; every project has its own set of Roles; and every Project, Form Definition, and Submission carries `access` / `submissionAccess` arrays that map permission types to roles. This reference covers the default roles, custom roles, the eight permission types, the three permission scopes (project / form-definition / submission-data), and the layered access models (Self Access, Field Match-Based Access, Field-Based Resource Access, Group Permissions).

## When to use this

Reach for this reference when the user wants to:

- Understand who can read / update / delete what.
- Tune `access` or `submissionAccess` on a Form or Resource.
- Add a custom role and decide what it can do.
- Reason about "own" vs "all" semantics.
- Pick between role-based, field-match-based, field-based-resource, and group-based access models.

Not for:

- Wiring the actual login flow → see [`resource-auth.md`](./resource-auth.md).
- Designing group joins → see [`group-permissions.md`](./group-permissions.md).
- Configuring SSO role mapping → see [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md).

## Configuration

### Default roles

Every new Form.io project is seeded with these roles, each with a unique MongoDB ID:

- **Anonymous** — for unauthenticated users. Cannot be deleted.
- **Everyone** — baseline applied to all users. Fixed ID `00000000000000000000000`. Cannot be deleted.
- **Administrator** — preconfigured with full CRUD across the project.
- **Authenticated** — preconfigured for logged-in workflows; assigned by the Role Assignment Action at signup.

In a planner-produced `template.json` the default roles are emitted as objects with `title`, `description`, `admin`, and `default` fields — see `plugin/skills/formio-resource-planner/references/template-json.md` lines 34–59 for the canonical shape.

### Custom roles

Add custom roles when the default trio is not enough — for example `salesRep`, `moderator`, `supportAgent`. A custom role:

- Has `admin: false` and `default: false`.
- Is referenced by MongoDB ID in `access` / `submissionAccess` arrays on the Forms and Resources you want it to reach.
- Can be mapped from an SSO provider's role claim via OAuth / SAML / LDAP Role Mapping.

### Assigning roles to users — Role Assignment actions only, never direct `roles` writes

A user's `roles` array lives on their submission, but the submissions API **strips the `roles` key from POST/PUT/PATCH bodies — even for the project owner**. Roles are assigned exclusively by the **Role Assignment action** (self-register forms assign the default persona unconditionally; SSO Role Mapping covers federated logins). For a multi-role application where all personas share ONE `user` resource (`student` / `collegeAdmin` / `scholarshipAdmin`) — the common default — the canonical pattern is a `role` selectboxes component on the user resource plus one CONDITIONAL Role Assignment action per persona (`condition.conditions: [{ component: "role", operator: "isEqual", value: "<persona>" }]`), so creating or editing a user in the portal (or via the API with `data.role.<persona> = true`) attaches the right role server-side. When the requirements instead call for a **resource per role** (e.g., a separate `admin` resource with the Login action's `settings.resources: ["user", "admin"]`), the selectboxes pattern is unnecessary — each user-type resource carries its own unconditional Role Assignment. Exact JSON shapes: `plugin/skills/formio-resource-planner/references/template-json.md` → "Multi-role user systems"; action mechanics: the `formio-actions` skill's `references/action-types.md` → "Role Assignment".

### The eight permission types

The same eight types appear across every scope:

| Type         | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `create_own` | Create an entity; the actor becomes the owner.                           |
| `create_all` | Create an entity; the actor may set `owner` to any user.                 |
| `read_own`   | Read entities the actor owns.                                            |
| `read_all`   | Read every entity, regardless of ownership.                              |
| `update_own` | Update entities the actor owns.                                          |
| `update_all` | Update every entity. On Submissions, also lets the actor change `owner`. |
| `delete_own` | Delete entities the actor owns.                                          |
| `delete_all` | Delete every entity.                                                     |

Key rules:

- `update_all` on Submissions implicitly grants `create_all`.
- `read_all` at the Project scope controls index access for forms and roles.
- Submission access is disabled by default — every role that needs to see submissions (including Anonymous on a public form) must be granted explicit `submissionAccess`.
- Only the Project owner can delete the Project itself.

### The three permission scopes

| Scope | Where it lives | Controls |
| --- | --- | --- |
| Project | `access[]` on the Project object | Who can create, read, update, delete forms/resources/roles inside the project. |
| Form Definition | `access[]` on each Form/Resource | Who can read/update/delete the form's JSON definition. `read_all` is required for users to load the form's renderer. |
| Submission Data | `submissionAccess[]` on each Form/Resource | Who can create/read/update/delete actual submission rows. This is "the real access-control story". |

The planner reference at `plugin/skills/formio-resource-planner/references/template-json.md` lines 61–158 carries the canonical `access` and `submissionAccess` JSON shapes; common patterns (admin-only, owner-level, public-submit, group-based) are documented there.

### Layered access models

Beyond the role-keyed `access` / `submissionAccess` arrays, Form.io supports four overlay models:

1. **Self Access Permissions** — write the submission's own `_id` into its `owner` property. The submission becomes its own owner; useful for "users see only their own records" patterns without a separate user lookup.
2. **Field Match-Based Access** — submission access gated on field values. Configured at `/developers/roles-and-permissions/field-match-based-access.md`.
3. **Field-Based Resource Access** — permissions assigned via Resource references inside a form. Configured at `/developers/roles-and-permissions/field-based-resource-access.md`.
4. **Group Permissions** — an extension of Field-Based Resource Access where permissions derive from group associations. See [`group-permissions.md`](./group-permissions.md).

### Worked examples

**Admin-only resource:**

```json
"submissionAccess": [
  { "type": "create_all", "roles": ["<administrator-id>"] },
  { "type": "read_all",   "roles": ["<administrator-id>"] },
  { "type": "update_all", "roles": ["<administrator-id>"] },
  { "type": "delete_all", "roles": ["<administrator-id>"] }
]
```

**Owner-only resource (user sees only own records):**

```json
"submissionAccess": [
  { "type": "create_all", "roles": ["<administrator-id>"] },
  { "type": "read_all",   "roles": ["<administrator-id>"] },
  { "type": "update_all", "roles": ["<administrator-id>"] },
  { "type": "delete_all", "roles": ["<administrator-id>"] },
  { "type": "read_own",   "roles": ["<authenticated-id>"] },
  { "type": "update_own", "roles": ["<authenticated-id>"] }
]
```

**Public submit (anonymous feedback form):**

```json
"submissionAccess": [
  { "type": "create_own", "roles": ["<anonymous-id>"] },
  { "type": "read_all",   "roles": ["<administrator-id>"] },
  { "type": "update_all", "roles": ["<administrator-id>"] },
  { "type": "delete_all", "roles": ["<administrator-id>"] }
]
```

## MCP Tool Preference

- `role_list` — discover existing role IDs in the project (default trio plus any custom).
- `role_create` — add a custom role (`title`, `description`, `admin: false`, `default: false`).
- `role_update` — adjust an existing role's metadata.
- `form_get` — read the current `access` / `submissionAccess` on a form before editing it.
- `form_update` — write new `access` or `submissionAccess` arrays onto a Form or Resource.
- `project_export` / `project_import` — round-trip the entire role + permission graph in a `template.json`.

Use the Form.io project portal for direct Role and Permission edits when you are administering a single project interactively; prefer the MCP tools when scripting or driving multi-project changes from an agent.

## See also

- `formio-resource-planner` — owns the canonical role objects, `access` arrays, and `submissionAccess` arrays for `template.json`. Start there when designing a new project's permission matrix. See `plugin/skills/formio-resource-planner/references/template-json.md` lines 34–158.
- [`resource-auth.md`](./resource-auth.md) — how roles get attached to a user at login and signup.
- [`group-permissions.md`](./group-permissions.md) — group-based access overlay.
- [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md) — provider role mapping into Form.io roles.
