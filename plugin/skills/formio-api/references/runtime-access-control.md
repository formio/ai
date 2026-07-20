## Overview

This skill documents the runtime HTTP calls that demonstrate Form.io's two most common multi-tenant access patterns:

- **Own-access patterns** — a form whose `submissionAccess` is configured so that each end user can only read and modify submissions where they are the `owner`. The same `GET /:formPath/submission` endpoint transparently returns different results per caller.
- **Group-permission patterns** — a "join" resource plus a Group Assignment action grants users roles derived from resource membership (e.g., employees tied to companies), and per-submission `access` entries scope reads to members of the right group. This enables row-level security across a project.

All endpoints below are regular runtime Form/Submission/Action endpoints; the access behavior is produced by how the forms and actions are configured, not by special URLs. For the form and action definitions themselves see `project-forms.md` and `project-actions.md`.

## Root URL

All endpoints below are rooted at `${FORMIO_PROJECT_URL}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers this operation — use the HTTP endpoint directly.

## Endpoints

The endpoints below are grouped for readability; each `### METHOD PATH` subsection is independently usable.

### POST ${FORMIO_PROJECT_URL}/form

Create a form whose `submissionAccess` is configured so that each caller only sees their own submissions. The key pattern is an empty project-level `access: []` combined with `submissionAccess` entries that grant `create_own`/`read_own`/`update_own`/`delete_own` rather than `*_all`.

Request body (JSON):

```json
{
  "title": "Support",
  "display": "form",
  "type": "form",
  "name": "support",
  "path": "support",
  "components": [
    { "label": "First Name", "type": "textfield", "key": "firstName" },
    { "label": "Last Name", "type": "textfield", "key": "lastName" },
    { "label": "Email", "type": "email", "key": "email" },
    { "label": "Message", "type": "message", "key": "message" },
    { "type": "button", "label": "Submit", "key": "submit", "action": "submit" }
  ],
  "access": [],
  "submissionAccess": []
}
```

Response: the created form document with server-assigned `_id`, default project `access` entries, and the `submissionAccess` you supplied.

Errors: `400` for duplicate `name`/`path` or invalid components; `401`/`403` if the caller lacks form-create permission at the project level.

### POST ${FORMIO_PROJECT_URL}/:supportFormPath/submission

Create a submission as Employee 1. The server records the caller's user ID in the submission's `owner` field; this is what downstream "own" filters key on.

Request body:

```json
{
  "data": {
    "firstName": "Thora",
    "lastName": "Hills",
    "email": "employee1@example.com",
    "message": "This is a test"
  }
}
```

Response: submission document with `owner` set to the calling user's `_id`.

Errors: `401`/`403` if the caller cannot create submissions on this form.

### POST ${FORMIO_PROJECT_URL}/:supportFormPath/submission

Create a submission as Employee 2. Identical shape to the call above but with a different JWT; Form.io stamps the new caller as `owner`.

```json
{
  "data": {
    "firstName": "Cory",
    "lastName": "Hand",
    "email": "employee2@example.com",
    "message": "This is a test"
  }
}
```

Response: submission owned by Employee 2.

### GET ${FORMIO_PROJECT_URL}/:supportFormPath/submission

List submissions as Employee 1. Because the form grants `read_own` only, the server returns exclusively submissions whose `owner` matches Employee 1's user ID — Employee 2's submissions are silently excluded from the array.

Response: JSON array of submissions owned by the caller.

Errors: `401` missing JWT; `403` if the role lacks even `read_own`.

### GET ${FORMIO_PROJECT_URL}/:supportFormPath/submission

List submissions as Employee 2. Same endpoint, different JWT — returns only Employee 2's submissions. This demonstrates that no client-side filtering is required; the scoping is enforced server-side.

### POST ${FORMIO_PROJECT_URL}/form

Create a **Company** resource. Companies act as groups; later each employee gains a role tied to a company they belong to.

Request body:

```json
{
  "title": "Company",
  "display": "form",
  "type": "resource",
  "name": "company",
  "path": "company",
  "components": [
    { "label": "Name", "key": "name", "type": "textfield" },
    { "label": "Submit", "key": "submit", "action": "submit", "type": "button" }
  ],
  "access": [],
  "submissionAccess": [],
  "settings": {}
}
```

Response: the created Company resource document.

### POST ${FORMIO_PROJECT_URL}/:companyResourcePath/submission

Create a Company record.

```json
{ "data": { "name": "Stoltenberg Inc" } }
```

Response: submission document representing Company 1.

### POST ${FORMIO_PROJECT_URL}/:companyResourcePath/submission

Create a second Company record.

```json
{ "data": { "name": "Jenkins LLC" } }
```

Response: submission document representing Company 2.

### POST ${FORMIO_PROJECT_URL}/form

Create the **Employee Company** join resource. The `company` component sets `reference: true` and the resource participates in the Group Assignment action below. The `employee` component references the existing Employee resource.

Request body (abbreviated):

```json
{
  "title": "Employee Company",
  "display": "form",
  "type": "resource",
  "name": "employeeCompany",
  "path": "employeeCompany",
  "components": [
    {
      "label": "Employee",
      "key": "employee",
      "type": "select",
      "dataSrc": "resource",
      "data": { "resource": "${employeeResourceId}" },
      "template": "<span>{{ item.data.email }}</span>"
    },
    {
      "label": "Company",
      "key": "company",
      "type": "select",
      "dataSrc": "resource",
      "reference": true,
      "data": { "resource": "${companyResourceId}" },
      "template": "<span>{{ item.data.name }}</span>"
    },
    { "label": "Submit", "key": "submit", "action": "submit", "type": "button" }
  ]
}
```

Response: the join resource document.

### POST ${FORMIO_PROJECT_URL}/form/:employeeCompanyResourceId/action

Attach the **Group Assignment** action to the join resource. On each submission the action grants the `employee` user a role matching the `company` submission — this is what makes group membership functional.

Request body:

```json
{
  "data": {
    "priority": 5,
    "name": "group",
    "title": "Group Assignment",
    "settings": { "group": "company", "user": "employee" },
    "handler": ["after"],
    "method": ["create"],
    "condition": {},
    "submit": true
  },
  "state": "submitted"
}
```

Response: the installed action document with `_id`, `form`, and `machineName`.

Errors: `400` if `settings.group`/`settings.user` do not match component keys on the form; `401`/`403` for insufficient project permissions.

### POST ${FORMIO_PROJECT_URL}/:customerCompanyResourcePath/submission

Assign Employee 1 to Company 1 by creating a join submission. Because the Group Assignment action fires `after create`, Employee 1 gains a role for Company 1 as a side effect.

```json
{
  "data": {
    "employee": { "_id": "${employee1Id}", "data": { "email": "${employee1Email}" } },
    "company": { "_id": "${company1Id}", "data": { "name": "${company1Name}" } }
  }
}
```

Response: the join submission document.

### POST ${FORMIO_PROJECT_URL}/:customerCompanyResourcePath/submission

Assign Employee 2 to Company 2 with the same shape:

```json
{
  "data": {
    "employee": { "_id": "${employee2Id}", "data": { "email": "${employee2Email}" } },
    "company": { "_id": "${company2Id}", "data": { "name": "${company2Name}" } }
  }
}
```

Response: join submission for Employee 2 / Company 2.

### GET ${FORMIO_PROJECT_URL}/:employeeResourcePath/submission/:employee1Id

Verify that Employee 1's submission now lists the Company 1 role in its `roles` array — confirming the Group Assignment action took effect.

Response: employee submission with a populated `roles: ["<company1-role-id>"]`.

### GET ${FORMIO_PROJECT_URL}/:employeeResourcePath/submission/:employee2Id

Same verification for Employee 2 / Company 2.

Response: employee submission with Company 2's role in `roles`.

### GET ${FORMIO_PROJECT_URL}/:customerCompanyResourcePath/submission

List join submissions filtered by company ID to retrieve the members of a group.

| Query parameter    | Type   | Description                            |
| ------------------ | ------ | -------------------------------------- |
| `data.company._id` | string | Company submission `_id` to filter on. |

Response: JSON array of join submissions for the specified company.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/employee-company/submission?data.company._id=${company1Id}"
```

### POST ${FORMIO_PROJECT_URL}/form

Create a **Company Report** form whose `company` component has per-component `submissionAccess` of type `read` with an empty `roles` array. On each submission the server will stamp the report's `access` with the referenced company's resource ID, so only users holding that company role can read it.

Request body (abbreviated):

```json
{
  "title": "Company Report",
  "display": "form",
  "type": "form",
  "components": [
    {
      "label": "Company",
      "key": "company",
      "type": "select",
      "dataSrc": "resource",
      "reference": true,
      "submissionAccess": [{ "type": "read", "roles": [] }],
      "data": { "resource": "${companyResourceId}" },
      "template": "<span>{{ item.data.name }}</span>"
    },
    { "label": "Notes", "key": "notes", "type": "textarea" },
    { "label": "Submit", "key": "submit", "action": "submit", "type": "button" }
  ]
}
```

Response: the Company Report form document.

### POST ${FORMIO_PROJECT_URL}/:companyReportFormPath/submission

Create a Company 1 report. The server automatically adds an entry to the submission's top-level `access` with `type: "read"` and `resources: ["<company1-id>"]`, scoping the row to Company 1 members.

```json
{
  "data": {
    "company": { "_id": "${company1Id}", "data": { "name": "${company1Name}" } },
    "notes": "This is only for the Company 1!"
  }
}
```

Response: submission document with `access: [{ "type": "read", "resources": ["${company1Id}"] }]`.

### POST ${FORMIO_PROJECT_URL}/:companyReportFormPath/submission

Create a Company 2 report with the same shape:

```json
{
  "data": {
    "company": { "_id": "${company2Id}", "data": { "name": "${company2Name}" } },
    "notes": "This is only for the Company 2!"
  }
}
```

Response: submission scoped to Company 2.

### GET ${FORMIO_PROJECT_URL}/:companyReportFormPath/submission

List reports as an Employee 1 caller. The server applies the `access[].resources` filter against the caller's roles and returns only Company 1 reports.

Response: JSON array of Company 1 reports.

Errors: `401`/`403` on missing/invalid JWT.

### GET ${FORMIO_PROJECT_URL}/:companyReportFormPath/submission

List reports as an Employee 2 caller — same endpoint, different JWT — returns only Company 2 reports, demonstrating that group-scoped row-level security is enforced entirely server-side.

## Related Skills

- [runtime-submissions](./runtime-submissions.md) — the CRUD endpoints these access patterns filter
- [project-forms](./project-forms.md) — creating forms and resources with the `access` / `submissionAccess` arrays used above
- [project-actions](./project-actions.md) — the Group Assignment and related actions that produce role membership
- [project-roles](./project-roles.md) — defining the project roles that pair with group permissions
