---
name: formio-resource-planner
description: >-
  Plan the Resource structure, field configurations, and access/permission model for a Form.io application from a user's high-level requirements, then emit a ready-to-import Form.io project `template.json`. Use this skill whenever the user wants to design, architect, model, or plan a Form.io app, project, portal, or data model — phrases like "build a <kind> app in Form.io", "model <domain> in Form.io", "design the resources for...", "plan the schema for...", "I want to build a task manager / CRM / inventory / booking system in Form.io". Two-phase output — (Phase A) a human-readable Resource Map for the user to review and approve; (Phase B) after explicit approval, a full `template.json` containing roles, resources, forms, and actions that can be POSTed to `/{projectName}/import`, handed to `form_create`, or passed to the formio-api skill. Interview-driven — infers resources from the description and asks about relationships, auth, and access before committing. Not for looking up an endpoint (see the formio-api skill). Trigger even if the user does not say the word "Form.io" — if they describe an app and you are in a Form.io project, plan the resources.
---

# Form.io Resource Planner

Turn a natural-language application description into a concrete Form.io resource map — the minimum plan needed to actually build the app.

## Stance

You are a thinking partner that plans before it builds. Two distinct phases with a hard approval gate between them.

- **Curious, not prescriptive.** The user's domain words are signal; the Form.io vocabulary is yours to translate.
- **Batch your questions.** When multiple related questions come up (e.g., all relationship cardinalities), ask them together in one `AskUserQuestion` call. Peppering the user one question at a time burns trust.
- **Visualize twice, in two formats.** The map is visualised by two diagrams: an ER diagram (who relates to whom) AND an Access Flow diagram (how the runtime ACL reaches each resource). Phase A (chat approval gate) renders both as ASCII so the user can review them in the terminal. Phase B (file on disk) renders both as Mermaid (`erDiagram` + `flowchart TD`) so downstream skills and GitHub/IDE readers get semantic edges + native rendering. Both surfaces describe the same topology — generated from one internal model per run.
- **Ground in Form.io primitives.** Every output claim must map to a real Form.io construct: resource, form, component, action, role, field-based access, group permission.
- **Gate on approval.** Phase A (Resource Map) is for review. Do not emit `template.json` / `template.md` until the user has explicitly approved the map. See "The approval gate" below.
- **Phase B is a pair.** Every Phase B emission writes `template.md` AND `template.json` together — same basename, same timestamp on collision. `template.md` is the architectural-intent artifact downstream skills seed from; `template.json` is its structured companion. Never emit one without the other.
- **Actions are mandatory, not optional.** Every resource and form in `template.json` MUST have a corresponding entry in the top-level `actions` map — at minimum a Save Submission action so that submissions persist. Additional actions attach per semantics: Login on login forms, Role Assignment on register forms, Group Assignment on join resources. A `template.json` whose `actions` map lacks a `<formMachineName>:save` entry for any resource is **broken by definition** — the resource will accept submissions in the UI but never store them. Treat a missing action as a hard failure and regenerate. See "Actions emission — required per resource" near Phase B, and [`references/template-json.md`](references/template-json.md) for exact shapes.
- **Don't call the MCP server.** The skill produces plans plus the `template.md` / `template.json` artifact pair. It does not call `form_create` or any other MCP tool — importing is a separate, explicit user action.

## The interview

Work through these five rounds. Compress or expand as the user's description warrants — if they named every entity and relationship explicitly, skip ahead; if they said only a brief phrase like "I want a CRM" or "build me a booking app," start from zero.

### 1. Extract the named entities

Re-read the user's prompt and list the nouns that sound like resources. For "Task Manager with Projects, Tasks assigned to Projects, and Users" → candidates: `Project`, `Task`, `User`.

Confirm the list with the user in one question. They may add or drop entities.

### 2. Determine the relationships

For every meaningful pair of entities, pin down the cardinality: 1:1, 1:N, or N:N. Ask as a batch. Draw a small ASCII sketch after the user answers.

### 3. Determine the user / auth model

Ask (together):

- Is the user the built-in `user` resource, or a custom user type (different fields, different login form)?
- Self-register vs admin-invite-only?
- SSO (OIDC/SAML) or email/password?

If the user has no authentication, say so explicitly and skip access rules — not every app needs login.

### 4. Determine the access / permission model

Ask (together):

- Is access **owner-level** (users see only their own records)?
- **Group-level** (users see everything in their team / project / tenant)?
- **Role-level** (admins see all, members see some, viewers see read-only)?
- **Tenant-level** (strict multi-tenant isolation)?
- Or some combination — e.g., "admins see everything, members see only their group's data."

### 5. Produce the resource map, then gate on approval

Emit the Phase A Resource Map (see "Phase A — Resource Map for review" below) as a single artifact. Then stop and ask the user to approve or revise. Only after approval, produce the Phase B `template.json`.

## Form.io primitives you will use

### Relationship → construct

- **1:1 or 1:N with parent owning child** — child resource has a `select` component whose `data.resource` is the parent. That's the foreign key.
- **N:N** — create a **join resource** with two `select` components (one per side). If access flows across the join, add Group Permissions (see below).
- **User-to-resource group access** — join resource + a Group Permissions action where the "group" field points at the parent resource and the "user" field points at the user resource. The platform manages ACLs automatically.

### Access patterns

| Pattern                                    | Form.io construct                                                                                                                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner-only ("my records")                  | Submission Access on the resource: `read/update/delete = Owner`                                                                                                                                                                                      |
| Group-based ("my team's records")          | Two halves, both required: (a) a join resource (user ↔ group) with a Group Assignment action; (b) on every child resource that inherits the group's access, a four-entry `submissionAccess` block on the `select` component that points at the group |
| Role-based ("admins see all")              | Project roles (`administrator`, `authenticated`, custom). Gate resource access with roles. Assign roles on signup with a Role Assignment action                                                                                                      |
| Tenant-based ("strict customer isolation") | Platform tenants — out of scope for this skill; point the user at `formio-api/references/platform-tenants`                                                                                                                                                      |

### Group-based access has two halves — both must land

When a child resource's access flows from a group, the plan must include both:

1. **The Group Assignment action on the join resource** (e.g., `projectUser:group` with `settings: { group: "project", user: "user" }`). This registers user-to-group memberships.
2. **A field-based `submissionAccess` block on the child's group-reference select component** (e.g., on `Task.project`, on `Contact.company`). The block has four entries — `read`, `create`, `update`, `delete` — each with `roles: []`. The empty roles are intentional: permissions are resolved at runtime from the group submission's ACL, not from static role lists.

## Gotcha

Missing half 2 is a silent bug. The user can log in and see the Project they're a member of, but they cannot see the Tasks attached to it because Task's access never inherits. Always call out both halves in the Phase A map, and always emit both halves in Phase B.

See `references/template-json.md` for the exact JSON shape of the field-based submissionAccess block.

### Transitive group access — 2+ levels below the group

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

See `references/template-json.md` → "select — transitive group-access mirror" for the exact JSON. A complete worked example (`Team → Account → Contact/Deal/Activity`) is registered as eval-3 ("complex-crm-transitive") in `evals/evals.json`, with the Phase A map and importable Phase B template checked in at the eval workspace (`evals/iteration-1/eval-3-complex-crm-transitive/with_skill/outputs/`). When the user describes a hierarchy with a group at the top and grandchildren below, refer to this eval's output as the structural reference.

### Two different access arrays (don't conflate)

Every resource and form carries two access arrays. Keep them separate in your plan:

- **`access`** — who can _load the form/resource definition itself_ (the metadata, component tree). Default for every resource: `read_all` granted to **all three base roles** (`administrator`, `anonymous`, `authenticated`). The form definition is public metadata — locking it down here is rarely what the user wants.
- **`submissionAccess`** — who can _create/read/update/delete submissions_ (the actual data rows). This is where the real access-control story lives: `create_all`/`read_all`/... for administrators, `read_own`/`update_own` for owner-level access, and so on.

When the user describes access ("reps only see their company's deals"), they almost always mean `submissionAccess`. Say so explicitly in the output. The `access` default stays wide-open on every resource.

### Component cheat sheet

| Intent                             | Component                                                | Notes                               |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| Short text (name, title)           | `textfield`                                              | Set `validate.required` when needed |
| Long text (description, notes)     | `textarea`                                               |                                     |
| Number                             | `number`                                                 |                                     |
| Date / datetime                    | `datetime`                                               |                                     |
| Boolean flag                       | `checkbox`                                               |                                     |
| Choice from a static list          | `select` (static values)                                 |                                     |
| Reference to another resource      | `select` with `data.resource` set to the parent resource | This is the Form.io foreign key     |
| Multiple references (1:N embedded) | `select` with `multiple: true` and `data.resource`       |                                     |
| File attachment                    | `file`                                                   | Requires a storage provider         |
| Email (for user login)             | `email`                                                  | Always on the `user` resource       |

Full component reference: see the `formio-form` skill when you need exact JSON shapes. This cheat sheet is for planning, not generation.

### Action cheat sheet

- **Login** — on a form collecting email/password; issues a JWT on submit. The action's `settings.resources` lists which user-type resources the form authenticates against. Always emit `["user"]`. Do NOT add `"admin"` — it breaks project import. Admin-only work (seeding reference data, assigning groups, inviting users, reviewing submissions) is performed by the administrator signing in to the Form.io portal for the project; see "Admin operations" in the emitted `template.md`.
- **Role Assignment** — on a resource form (typically a signup form); assigns a role to the submitter.
- **Group Permissions** — on a join resource; names which field identifies the group and which names the user. Platform then enforces ACLs.
- **Save Submission** — on by default; turn off for pure-trigger forms.
- **Email / Webhook** — side effects; call them out when the user mentions notifications or integrations.

## Phase A — Resource Map for review

When the interview has enough signal, emit the resource map as a single fenced markdown block for the user to review in the terminal. Use this exact template — the sections here are the same sections Phase B writes to `template.md`, with ONE substantive difference: Phase A uses **ASCII diagrams** (readable in a terminal) for `## ER Diagram` and `## Access Flow Diagram`, while Phase B writes **Mermaid diagrams** into the file (see [`references/template-md.md`](references/template-md.md)). Same topology, two renderings — the planner generates both from a single internal model in one run. Keep the map terse; one sentence per resource purpose, one clause per field. This is the artifact the user reviews before anything else happens.

```
# Resource Map — <App Name>

<1–2 sentence app summary>

## Resources

- <ResourceName> (type: resource)
  Purpose: <1 sentence>
  Fields:
    - <key>: <component> — <description>
    - ...
  Access: <owner / group-via-<join> / role(<roles>) / public>
  Actions:
    - <action name>: <key settings>
    - ...

- <JoinResourceName> (type: resource, join)
  Purpose: <which N:N relationship this implements>
  Fields:
    - <leftKey>: select (resource=<Left>)
    - <rightKey>: select (resource=<Right>)
  Access: <who can read/write the join rows>
  Actions:
    - Group Assignment: group=<leftKey>, user=<rightKey>   ← only when the join governs user access
  ...

## Users & Auth

- User resource: <default `user` | custom `<name>`>
- Login form: <form name> (Login action)
- Login resources: `user`
- Admin operations: <if any admin-only workflow in this plan, list each one in one line — e.g., "Seed initial Project rows; create ProjectUser membership rows; assign `administrator` role to specific users." — and note they are performed via the Form.io portal for this project, not via the app's login form.>
- Registration: <self-register via form `<name>` with Role Assignment action | admin-invite only>
- SSO: <none | OIDC | SAML>

## Roles

- <roleName>: <capability summary>
- ...

## Access Matrix

| Resource | Actor          | create | read  | update | delete | Notes                   |
| -------- | -------------- | ------ | ----- | ------ | ------ | ----------------------- |
| <R>      | administrator  | all    | all   | all    | all    |                         |
| <R>      | authenticated  | —      | group | group  | —      | group-via-<Join>        |
| ...      | ...            | ...    | ...   | ...    | ...    |                         |

(Actors are roles and groups. Cell tokens: `all`, `own`, `group`, `group(<j>)`, `role(<r>)`, `—`. One row per (resource, actor) pair with a non-trivial rule.)

## ER Diagram

<ASCII diagram — every resource is a box, relationships labelled with cardinality, join resources sit on the line between the two sides. Keep text-editor friendly.>

## Access Flow Diagram

<ASCII diagram — how ACL propagates at runtime. Show the roles users can hold, every group-assignment join with its `group=` / `user=` settings, arrows from each join onto the group-owning resource's ACL, arrows from group-owning resources onto direct children via field-based submissionAccess, arrows from direct children onto grandchildren via hidden calculated mirrors, and any owner-based rules annotated inline. When the app is anonymous, this collapses to one line.>

## Companion artifact

`template.json` in this directory is the structured Form.io project-export
companion to this document. Use this `.md` for architectural intent; use the
`.json` for exact field shapes, component JSON, and action settings.
```

The full shape rules, vocabulary, and more ASCII examples live in [`references/template-md.md`](references/template-md.md). Read it before your first Phase B write — the section headings and the Access Matrix token vocabulary are load-bearing for downstream skills.

## The approval gate

After emitting the Resource Map, stop. Ask the user one question with `AskUserQuestion`:

> "Does this map look right? I can write `template.md` + `template.json` once you approve it, or revise the map based on your feedback."

Offer two options: **Approve & write template.md + template.json** and **Revise the map** (with free-text "Other" always available for specific tweaks).

**Do not skip this gate**. Even if the user's original prompt sounds decisive ("build me a task manager and give me the JSON"), always produce the map first, then ask. The gate exists because the JSON is 200–600 lines and a single wrong field propagates everywhere — cheaper to catch mistakes in the ~50-line map than the 500-line export.

If the user says "revise" or flags specific issues: update the map, re-show it, re-ask. Iterate until they approve.

## Phase B — template.md + template.json after approval

Only when the user has approved the map, emit the artifact PAIR — always both, always together:

1. **`template.md`** — the approved Resource Map, saved to disk as the architectural-intent document. Same structure as the Phase A map (Resources, Users & Auth, Roles, Access Matrix, ER Diagram, Access Flow Diagram, Companion artifact). See [`references/template-md.md`](references/template-md.md) for the complete spec.
2. **`template.json`** — the Form.io project-export JSON. Same shape you get from `GET /{projectName}/export` and can POST to `/{projectName}/import`.

Each file is emitted in TWO forms at the same time:

- **As a fenced block in the chat transcript** (`markdown` for `template.md`, `json` for `template.json`) — so the user sees both ASCII diagrams and the structure inline.
- **As files on disk using the `Write` tool** — so downstream skills (like `formio-application`'s Import step, or `formio-angular/resources`) can pass real file paths.

### File-write rules

- **Default filenames:** `./template.md` and `./template.json` in the user's current working directory (cwd — the directory the user was in when they invoked the flow). Use the `Write` tool; local filesystem writes do NOT count as "calling the MCP server", so the skill's "does not call the MCP server" stance is preserved.
- **Paired collision handling:** if EITHER `./template.md` or `./template.json` already exists in cwd, append the SAME sortable UTC timestamp to BOTH filenames so the pair stays matched: `./template-<timestamp>.md` + `./template-<timestamp>.json`, where `<timestamp>` is e.g. `20260420T153000Z`. Even if only one of the two collided, use the suffix on both — the pair must share a basename for downstream skills to find them. Report both chosen filenames in the Phase B confirmation message.
- **Both standalone and orchestrated runs:** write both files in every Phase B emission — whether the planner is running standalone (user invoked the planner directly) or invoked from `formio-application` (which will then pass the paths to its Import step and the framework handoff). Do not make this conditional.
- **Never emit one without the other.** If for any reason you can only emit one, stop and explain the problem — the pair is the contract downstream skills rely on.

### Transcript requirements

The markdown block MUST follow the section order in [`references/template-md.md`](references/template-md.md) exactly: `# Resource Map — <App Name>` → `## Resources` → `## Users & Auth` → `## Roles` → `## Access Matrix` → `## ER Diagram` → `## Access Flow Diagram` → `## Companion artifact`. Downstream graders and consumer skills key on these exact headings.

The `## ER Diagram` and `## Access Flow Diagram` sections in `template.md` MUST contain **Mermaid** fenced blocks (` ```mermaid\nerDiagram\n...``` ` and ` ```mermaid\nflowchart TD\n...``` ` respectively) — not ASCII. ASCII is for Phase A's chat-approval gate only. Every resource and join named in `## Resources` must appear as a node in both Mermaid blocks. See [`references/template-md.md`](references/template-md.md) → "ER Diagram section" and "Access Flow Diagram section" for the exact shapes, cardinality vocabulary, and worked examples for the three canonical patterns (owner-only, direct-child group, transitive group).

The JSON block MUST be a valid, importable Form.io template. Read [`references/template-json.md`](references/template-json.md) for the full schema, component shapes, action shapes, and access-array rules before writing. Do not improvise structure. The top-level keys are always, in **exactly** this order: `title`, `version`, `name`, `roles`, `forms`, `actions`, `resources`, `access`. Include all eight keys — `forms`, `actions`, and `resources` may be empty objects when the map has no entries, but the keys themselves are not optional, and `access` must be a non-empty project-level access array (see the "Top-level `access`" section in the reference). An optional `description` key may be placed immediately after `title`; omit it entirely otherwise.

#### Actions emission — required per resource, no exceptions

The top-level `actions` map is where a template.json most commonly comes out broken: the resources and forms are correct, but `actions` is empty or only contains Login. Treat this section as the hard rule — **every entry in `resources` AND every entry in `forms` contributes at least one action to the top-level `actions` map**. Skipping it produces a project whose forms silently drop every submission on the floor.

Emission algorithm (run this exactly once per template.json, right before writing the file):

1. **Walk every `resources` entry.** For each resource `<name>`, add an action keyed `"<name>:save"` of type `save` writing to resource `<name>`. This is the Save Submission action — it persists the submission to MongoDB. No resource is exempt. Join resources (`ProjectUser`, `TeamUser`) need Save too — Group Assignment does not replace Save; they co-exist.
2. **Walk every `forms` entry.** For each form `<name>`, add an action keyed `"<name>:save"`. Pure-trigger forms (no storage) are the only exception — and they are vanishingly rare; if you think you have one, ask the user first. When a form writes into a different resource than itself (e.g., a `userRegister` form writes into the `user` resource), set the Save action's `settings.resource` to the target resource's machine name. See [`references/template-json.md`](references/template-json.md) → "Save Submission (on a register form — writes into `user` resource)" for the exact shape.
3. **Auth-form actions.** For the login form, add a Login action (`"<form>:login"`). For the register form, add a Role Assignment action (`"<form>:role"`) that assigns the default authenticated role, AND a Login action so the user is signed in immediately on successful registration. Order: Save → Role Assignment → Login — all three live under the same register form's action keys.

   **Login action `settings.resources` — always `["user"]`.** The Login action's `settings.resources` is an array of user-type resource machine names the login form will authenticate against. Emit `["user"]` verbatim and do NOT add any other resource names (notably NOT `"admin"`) — the Form.io project importer rejects the template when the array references a built-in user-type resource that the template does not itself declare, and the single-resource form is what every default Form.io project expects.

   **Admin-only work goes through the Form.io portal, not the app login form.** If the plan has administrator-only responsibilities (seeding reference data, creating group-membership rows, assigning roles to users, reviewing submissions, moderating content), those are performed by an administrator signing in to the Form.io **project portal** for this project — the same portal URL the developer uses to manage the project's forms, resources, and submissions. Do NOT design the app's in-app login surface around administrator access. Instead, capture the admin-only operations in `template.md`'s `## Users & Auth → Admin operations` line so downstream skills and the end user see which tasks need the portal.
4. **Join resources with group-based access.** Every join resource that implements group-level access (e.g., `ProjectUser`, `TeamUser`, `CompanyUser`) needs a Group Assignment action keyed `"<join>:group"`. The action's `settings.group` MUST match the field key on the join whose `select` points at the group resource; `settings.user` MUST match the field key whose `select` points at the user resource. A join without Group Assignment stores rows but never grants access — the whole group-access model is dead.
5. **Side-effect actions (email, webhook).** Add these only when the user's description explicitly mentions the behavior (e.g., "email the assignee when a task is created"). Do not invent side effects.

Minimum viable action set per resource type:

| Resource / form type                          | Required action keys in `actions`                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Plain resource (`Project`, `Task`, etc.)      | `<name>:save`                                                                               |
| `user` resource                               | `user:save`                                                                                 |
| Login form (e.g., `userLogin`)                | `userLogin:save`, `userLogin:login`                                                         |
| Register form (e.g., `userRegister`)          | `userRegister:save`, `userRegister:role`, `userRegister:login`                              |
| Join resource with group access (`ProjectUser`)| `projectUser:save`, `projectUser:group`                                                      |
| Join resource WITHOUT group access            | `<join>:save`                                                                               |
| Any form mentioned as sending email / webhook  | the required set above PLUS `<name>:email` / `<name>:webhook`                               |

Priority ordering inside `actions`: Save always has the lowest priority number relative to the others on the same form (runs first — persist before downstream actions read the submission). Role Assignment runs after Save (needs the submission `_id`). Login runs last on register forms (issues the JWT once the role is attached). Use the priority values shown in [`references/template-json.md`](references/template-json.md); do not invent new numbers.

**Self-check before emit — actions block.** Count `resources` + `forms` entries, count keys in `actions` that end in `:save`. The second count MUST be ≥ the first (side-effect-only forms are the only exception, and they are almost never real). If the count is short, stop — you have missed a Save action on some resource. Re-run the walk above before writing the file.

The generic-self-check section at the bottom of [`references/template-json.md`](references/template-json.md) already includes the existing "Every resource and form has a Save Submission action in `actions`" line; this section restates why that line is load-bearing and how to satisfy it mechanically so the model cannot skip it.

### Order in the transcript

Render the markdown block first, then the JSON block — so a user reading the transcript top-to-bottom sees the narrative (with both ASCII diagrams) before the wall of JSON. The ASCII diagrams are already inside the markdown block; no need to re-print them separately.

After both blocks, tell the user the filenames that were written to disk (using the paired collision-aware names from above). One line:

```
Wrote ./template.md and ./template.json.
```

Then finish with a short "Next steps" section:

```
### Next steps

- **Import directly**: `curl -X POST -H "x-jwt-token: $JWT" -H "Content-Type: application/json" -d "{\"template\": $(cat template.json)}" $FORMIO_PROJECT_URL/import`
- **Or pass the pair to another skill / tool**:
  - `form_create` (MCP tool) for each entry under `resources` and `forms` in `template.json`
  - `formio-api/references/project-actions` for each entry under `actions`
  - `formio-api/references/project-roles` to create the non-default roles listed under `roles`
  - Framework scaffolders (`formio-angular/resources`, future `formio-react`, …) — hand them BOTH `template.md` (architectural intent) and `template.json` (structured reference). The `.md` is the seed they reason from; the `.json` is the structured companion they consult for field-level shapes.
```

## Worked example

**User**: "I would like to build a Task Manager application. Projects have Tasks assigned to them. I want to assign users to projects, where the users only have access to Tasks within their Project."

**Interview** (abbreviated — in practice you'd ask, not assume):

- Entities: `Project`, `Task`, `User` ✓
- Relationships: `Project 1:N Task`, `Project N:N User` (many users per project, each user on many projects)
- Auth: default `user` resource, self-register, email/password
- Access: users see `Task` only for projects they belong to → group-based access via a `ProjectUser` join

**Phase A output** (shown to user for approval in the terminal — same content and section order that Phase B writes to `template.md`, but with ASCII diagrams. Phase B's file replaces these ASCII blocks with Mermaid `erDiagram` + `flowchart TD` equivalents):

```
# Resource Map — Task Manager

A multi-user task manager where each Project has a set of Tasks and a team of Users, and users only see Tasks inside Projects they belong to.

## Resources

- Project (type: resource)
  Purpose: container for tasks assigned to a team of users.
  Fields:
    - name: textfield — human-readable project name
  Access: read/update limited to members (group-via-ProjectUser)
  Actions:
    - (save only)

- Task (type: resource)
  Purpose: a unit of work within a Project.
  Fields:
    - description: textfield — what needs doing
    - project: select (resource=Project, reference=true, field-based access) — parent project; carries the group ACL
  Access: read/update limited to members of the task's project (inherited via Task.project)
  Actions:
    - (save only)

- ProjectUser (type: resource, join)
  Purpose: many-to-many between Project and User; registers project memberships.
  Fields:
    - project: select (resource=Project)
    - user: select (resource=User)
  Access: admins only (managing membership is an admin operation)
  Actions:
    - Group Assignment: group=project, user=user

## Users & Auth

- User resource: default `user`
- Login form: `userLogin` (Login action)
- Login resources: `user`
- Admin operations: Seed initial `Project` rows; create `ProjectUser` membership rows to grant a user access to a project; manage `administrator` role assignments. Performed via the Form.io project portal, NOT the app login form.
- Registration: self-register via `userRegister` (Role Assignment action → role=`authenticated`)
- SSO: none

## Roles

- administrator: full access to all resources and memberships
- authenticated: default role on registration; access gated by ProjectUser memberships
- anonymous: default unauthenticated role; no submission access

## Access Matrix

| Resource    | Actor          | create | read  | update | delete | Notes                             |
| ----------- | -------------- | ------ | ----- | ------ | ------ | --------------------------------- |
| Project     | administrator  | all    | all   | all    | all    | full admin                        |
| Project     | authenticated  | —      | group | group  | —      | group-via-ProjectUser             |
| Task        | administrator  | all    | all   | all    | all    |                                   |
| Task        | authenticated  | group  | group | group  | —      | inherits via Task.project         |
| ProjectUser | administrator  | all    | all   | all    | all    | admin-managed membership          |
| ProjectUser | authenticated  | —      | own   | —      | —      | user sees their own memberships   |

## ER Diagram

    User ◄──────── ProjectUser ────────► Project
                        │                    │
          Group Assignment                   │ 1:N
          group=project,user=user            ▼
                                            Task

## Access Flow Diagram

  [ administrator ] ── sees all ──► every resource

  [ authenticated ]
       │
       │ (membership row)
       ▼
  ┌─────────────┐  Group Assignment   ┌─────────┐
  │ ProjectUser │ ── group=project ──►│ Project │   (ACL written on Project submission)
  └─────────────┘    user=user        └────┬────┘
                                           │ field-based submissionAccess
                                           │ on Task.project
                                           ▼
                                         Task   (inherits Project's ACL)

## Companion artifact

`template.json` in this directory is the structured Form.io project-export
companion to this document. Use this `.md` for architectural intent; use the
`.json` for exact field shapes, component JSON, and action settings.
```

(Ask the user to approve or revise. If approved, continue to Phase B — which writes the same Resource Map content to `./template.md` alongside `./template.json`, with the two ASCII diagrams above replaced by their Mermaid equivalents. See [`references/template-md.md`](references/template-md.md) and the `references/examples/task-manager/template.md` canonical example for the Mermaid shape.)

**Phase B output** (emitted only after the user approves): writes BOTH `./template.md` and `./template.json` to disk, then renders both in the transcript (markdown first, JSON second), then prints `Wrote ./template.md and ./template.json.`, then the Next steps block.

See [`references/template-md.md`](references/template-md.md) for the full `template.md` spec and [`references/template-json.md`](references/template-json.md) for the JSON schema. Canonical paired examples are checked in under `references/examples/`:

- **Task Manager** — simple group with direct-child access: `references/examples/task-manager/template.md` + `template.json`
- **Complex CRM (transitive)** — group with hidden calculated mirrors on grandchildren: `references/examples/complex-crm-transitive/template.md` + `template.json`

Use these as structural references when deciding how to shape a new app's output.

## Interview heuristics

- **When the user names 3+ entities and never mentions users**, stop and ask whether the app has authenticated users. Don't assume.
- **When a relationship could be 1:N or N:N**, prefer N:N with a join resource if the relationship carries data (assigned-at, role-within-group, etc.). A join is cheap and backward-compatible; an embedded 1:N is not.
- **When the user says "only see their team's / project's / tenant's data"**, that's group-based access. Reach for the join + Group Permissions pattern automatically and confirm.
- **When the user says "only see their own data"**, that's owner-based access. Submission Access owner rules alone are enough — no join needed.
- **When the user says "admins see everything"**, call out role-based layering on top of whichever group/owner rule is primary.
- **When the user skips auth entirely**, say so explicitly in the output (`Users & Auth: none`). Not every plan needs a user resource.

## When to look up more

- Form.io Resources overview: https://help.form.io/userguide/resources
- Roles and permissions: https://help.form.io/developers/roles-and-permissions
- Application development guide: https://help.form.io/dev/application-development
- Login action: https://help.form.io/userguide/forms/form-building/actions#login
- Role Assignment action: https://help.form.io/userguide/forms/form-building/actions#role-assignment
- Group Permissions action: https://help.form.io/userguide/forms/form-building/actions#group-assignment

Consult these when the user's requirements touch an edge case this skill doesn't cover (e.g., conditional access, multi-level tenancy, federated SSO).

## What this skill does NOT do

- **Does not call the MCP server.** The skill produces a Resource Map (Phase A) and the `template.md` + `template.json` artifact pair (Phase B). It does not call `form_create` or any other MCP tool — importing the template is a separate, explicit user action.
- **Does not skip the approval gate.** Even if the user's prompt sounds decisive, always emit the map first, ask for approval, and only then produce the `template.md` + `template.json` pair.
- **Does not emit one artifact without the other.** Phase B ALWAYS writes both `template.md` and `template.json`. If something prevents both, stop and explain.
- **Does not look up endpoints.** The `formio-api` skill handle endpoint reference.
- **Does not deep-dive a single form's component schema.** For exhaustive component options (conditional logic, calculated values, custom validation), see `formio-form`. This skill's template.json uses the minimum viable component shape for each field.
- **Does not make the plan "complete" beyond what the user described.** If they didn't mention reporting, don't add a report resource.
