# Planning rules — Resources vs. Forms, relationships, components, actions

The core modeling rules for `formio-resource-planner`. Read this while classifying entities (interview round 2) and while choosing components and actions for the Resource Map.

## Resources vs. Forms — the core modeling decision

Form.io has two kinds of entries — Resources and Forms. Decide the kind for every entity BEFORE modeling its fields. Resources are the right answer for most entities (and a perfectly valid app can be 100% Resources); the goal here is to recognize the cases that genuinely call for a Form, not to push entities into Forms unnecessarily.

### Resource — the data model (a "noun")

A **Resource** defines, displays, and stores a structured record. Resources are the nouns of the application — `Contact`, `Product`, `Project`, `Task`, `Applicant`. Each Resource auto-generates a REST API (`GET/POST/PUT/DELETE {projectUrl}/<path>`), so the set of Resources is effectively the application's database — a structured, queryable backend much like Firebase. Reach for a Resource when:

- The data is a persistent record other parts of the app read, reference, or report on.
- Other entities point at it (it is the target of a reference `select` — a foreign key).
- It needs its own CRUD management screens (list / create / edit / delete).
- The same shape recurs (every Contact has the same fields).

A Resource can also be **embedded as a form** in the UI when the app needs CRUD management of that data model — the generated list / create / edit screens are simply how users maintain the resource's rows. "Embedded as a form" here is a UI concern, not a reason to model the data as `type: form`.

### Form — bespoke data collection (a specific "ask")

A **Form** (`type: form`) collects data for one specific purpose. Forms are the interactions — a job application, an onboarding survey, a support request, an event RSVP, a contact-us page. A Form's submission is the captured response, not a reusable record other parts of the data model depend on. Reach for a Form when:

- The fields are specific to this one interaction and would not make sense as columns in a database table ("Why should we hire you?", "Rate your experience 1–5", "Any accessibility needs?").
- It is survey-like, one-off, or workflow-driven rather than a record other things reference.
- It references a structured record (a Resource established earlier) AND adds extra, context-specific questions on top.

A Form is not a second-class Resource. It frequently USES Resources two ways:

1. **To populate choices** — a `select` with `dataSrc: resource` fills a dropdown / typeahead from a Resource (pick a Product, pick an Applicant).
2. **To reference an already-established record** — the Form points at a Resource record that was created earlier in the application flow (onboarding / profile / CRUD), then adds its own bespoke fields. Wire the reference one of two ways: a **disabled, pre-selected Select** (dataSrc=resource, defaulted to the user's record, `disabled: true`) or the submission **`owner`** (when the record is 1:1 with the authenticated user). See `template-json.md` → "select — reference an established Resource".

> **Anti-pattern — do NOT create the Resource from inside the Form.** Never embed a Resource via a nested `form` component to create it inline, and never give a bespoke Form a Save action that creates the referenced Resource. Establishing the record and collecting the bespoke response are two separate flow steps. The data model is established first (its own onboarding / CRUD concern); the Form references it. See `formio-application` → "Using Resources within Forms — the right flow (and the anti-pattern to avoid)".

### The litmus test

Ask: _"Is this a record the app stores and reuses, or a response to a specific ask?"_

- A record the app stores and reuses → **Resource**.
- A response to a specific ask, possibly wrapping a record → **Form**.

When bespoke, survey-like fields are mixed with structured record fields, that is the tell for a **Form that references a Resource** — NOT a Resource with survey fields bolted on. Survey fields do not belong in the canonical data model; they are a supplemental, per-interaction extension of a base record that already exists.

### Worked example — Job Application

A recruiting app needs to capture job applications.

- **`Applicant` (Resource)** — the reusable person record: `firstName`, `lastName`, `email`, `phone`, `resume` (file). A noun the app stores, lists, and references from other resources (`Interview`, `Offer`). It is established FIRST, by its own flow (the applicant onboards / creates a profile), and gets CRUD screens.
- **`JobApplication` (Form)** — the bespoke intake the applicant fills AFTER onboarding. It **references** the already-established `Applicant` record — via a disabled, pre-selected `applicant` Select (locked to their own record) or via the submission `owner` — and adds interaction-specific questions: "Why should we hire you?", "Earliest start date", "Salary expectation", "How did you hear about us?". These answers are meaningful only for this one application — they are not columns on the canonical `Applicant` record, so they live on the Form's submission, not the Resource.

Two mistakes this guidance prevents:

1. **Modeling both as resources** — pollutes the `Applicant` data model with one-off survey fields and loses the distinction between "a person we track" and "one application they submitted."
2. **Creating the `Applicant` from inside the `JobApplication` form** (e.g., a nested form, or a Save action that writes a new Applicant) — the anti-pattern. The form's first job becomes bootstrapping a person rather than collecting an application, producing duplicate Applicant records and breaking owner-based access. Establish the Applicant first; reference it from the form. See `formio-application` → "Using Resources within Forms".

### Quick classification table

| Entity / intent | Kind | Why |
| --- | --- | --- |
| Contact, Company, Product, Project, Task, User | Resource | Persistent nouns; referenced by others; need CRUD |
| Order with line items | Resource | Stored record other things reference (invoices, reports) |
| Contact-us / feedback / support request | Form | One-off interaction; not referenced; survey-like |
| Event RSVP / registration | Form | Captures a response; may reference an established Attendee resource + bespoke Q's |
| Onboarding / intake questionnaire | Form | Survey-like; supplemental to a base record |
| Job application (over an Applicant resource) | Form | References an established Applicant (disabled Select / owner) + bespoke survey fields |
| Customer satisfaction survey | Form | Pure bespoke collection; no reusable record |

When in doubt during the interview, ASK — present the entity and the two readings ("a record you manage" vs "a form people fill out") and let the user decide. Do not silently default to Resource.

## Form.io primitives you will use

(Access patterns — owner/group/role/tenant, the two-halves rule, transitive mirrors, and `access` vs `submissionAccess` — live in [access-patterns.md](access-patterns.md).)

### Relationship → construct

- **1:1 or 1:N with parent owning child** — child resource has a `select` component whose `data.resource` is the parent. That's the foreign key.
- **N:N** — create a **join resource** with two `select` components (one per side). If access flows across the join, add Group Permissions (see [access-patterns.md](access-patterns.md)).
- **User-to-resource group access** — join resource + a Group Permissions action where the "group" field points at the parent resource and the "user" field points at the user resource. The platform manages ACLs automatically.

### Component cheat sheet

| Intent | Component | Notes |
| --- | --- | --- |
| Short text (name, title) | `textfield` | Set `validate.required` when needed |
| Long text (description, notes) | `textarea` |  |
| Number | `number` |  |
| Date / datetime | `datetime` |  |
| Boolean flag | `checkbox` |  |
| Choice from a static list | `select` (static values) |  |
| Reference to another resource | `select` with `data.resource` set to the parent resource | This is the Form.io foreign key |
| Multiple references (1:N embedded) | `select` with `multiple: true` and `data.resource` |  |
| File attachment | `file` | Requires a storage provider |
| Login identifier | `email` (or `textfield`/`phone` for username, User ID, etc.) | Identifier on the credential resource; `email` is the common default, not required |
| Reference an established Resource record from a Form | `select` (dataSrc=resource), often `disabled: true` + pre-selected | Links the form to a record created earlier in the flow; do NOT use a nested `form` to create the record inline (anti-pattern) |

Full component reference: see the `formio-schema` skill when you need exact JSON shapes. This cheat sheet is for planning, not generation.

> **Credential fields are always `persistent: true`.** Emit `persistent: true` on the identifier (`email`, `username`, `userId`) and the secret (`password`) on the user Resource AND on every login and registration form — never `persistent: false`. `persistent: false` strips the field from the submission body server-side, so a user row saved through a form carrying that flag has no credentials and the user can never log in. A login form stores nothing because it carries no Save Submission Action (only a Login Action), not because of `persistent`. Use `protected: true` on `password` to keep it out of API reads.

### Action cheat sheet

- **Login** — on a form collecting an identifier + secret (email/password by default, but any pair such as userId/pin); issues a JWT on submit. `settings.username`/`settings.password` point at those two component keys. The action's `settings.resources` lists which user-type resources the form authenticates against. For most cases, emit `["user"]`, unless the prompt specifically indicates that "admins" will use the application, in which case you emit `["admin"]` for ONLY admins, and `["user", "admin"]` if both can login. In most applications, admin-only work (seeding reference data, assigning groups, inviting users, reviewing submissions) is performed by the administrator signing in to the Form.io portal for the project; see "Admin operations" in the emitted `template.md`.
- **Role Assignment** — on a resource form (typically a signup form); assigns a role to the submitter. **Multi-role apps (2+ assignable personas on ONE shared user resource):** a submission's `roles` array cannot be written directly via the API (the server strips it, even for the project owner), so the user resource needs a `role` selectboxes component plus one CONDITIONAL Role Assignment action per persona — see [template-json.md](template-json.md) → "Multi-role user systems". Planning "assign staff roles via the portal/API" without those actions is a dead end. Not needed when the requirements call for a resource per role (e.g., separate `admin` resource) — there each user-type resource assigns its single role unconditionally.
- **Group Permissions** — on a join resource; names which field identifies the group and which names the user. Platform then enforces ACLs.
- **Save Submission** — on by default; turn off for pure-trigger forms.
- **Email / Webhook** — side effects; call them out when the user mentions notifications or integrations.
