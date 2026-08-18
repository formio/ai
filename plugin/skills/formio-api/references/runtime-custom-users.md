## Overview

This skill covers the end-user (runtime) flow for building custom user types beyond the default `user` resource: creating a custom user resource (e.g., `employee`), creating a custom role, attaching a Role Assignment action so newly registered users are granted that role automatically, building a matching custom login form, swapping the default `Save Submission` action for a `Login` action, and registering/logging in users against the custom resource. For the default `user`/`userLogin` flow, see `runtime-auth.md`.

## Root URL

All endpoints below are rooted at `${FORMIO_PROJECT_URL}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers these operations, and none should: they are **runtime** endpoints. The MCP tools exist for **build-time** work — creating and updating forms, actions, roles, and project settings while the application is being built. The endpoints below are called by the finished application, on behalf of the person using it, with that person's own token.

So this document is a specification for the code you write — how the application authenticates users held outside the default `user` resource, at runtime — not a set of calls to make now.

## Endpoints

### POST ${FORMIO_PROJECT_URL}/form

Create a custom user type as a Form.io resource. The resource components define the fields collected at registration — at minimum `email` and `password`.

Request body (JSON):

```json
{
  "title": "Employee",
  "display": "form",
  "type": "resource",
  "name": "employee",
  "path": "employee",
  "components": [
    {
      "type": "textfield",
      "label": "First Name",
      "key": "firstName",
      "validate": { "required": true }
    },
    {
      "type": "textfield",
      "label": "Last Name",
      "key": "lastName",
      "validate": { "required": true }
    },
    {
      "type": "password",
      "label": "Password",
      "key": "password",
      "validate": { "required": true }
    },
    { "type": "email", "label": "Email", "key": "email", "validate": { "required": true } }
  ]
}
```

Required fields: `title`, `type` (must be `resource` for a user type), `name`, `path`, `components` including at least an `email` textfield/email component and a `password` component.

Response: the created resource document with server-assigned `_id`, `machineName`, `owner`, `created`, and `modified`. Persist the `_id` as `employeeResourceId` and `path` as `employeeResourcePath` for later steps.

Errors: `400` for duplicate `name`/`path` or invalid component schema; `401`/`403` for insufficient access.

### POST ${FORMIO_PROJECT_URL}/role

Create a custom role to be assigned to the custom user type (e.g., `Employee`).

Request body (JSON):

```json
{
  "title": "Employee",
  "description": "A user who is an employee of a company."
}
```

Required fields: `title`. Optional: `description`, `default` (boolean), `admin` (boolean).

Response: the created role document: `_id`, `title`, `description`, `default`, `admin`, `project`, `created`, `modified`, `machineName`. Persist `_id` as `employeeRoleId`.

Errors: `400` for missing/duplicate `title`; `401`/`403` for insufficient access.

### POST ${FORMIO_PROJECT_URL}/form/:employeeResourceId/action

Attach a `Role Assignment` action to the custom user resource so that every new submission (registration) receives the custom role.

Request body (JSON):

```json
{
  "priority": 1,
  "name": "role",
  "title": "Role Assignment: Employee",
  "settings": {
    "association": "new",
    "type": "add",
    "role": "{{ employeeRoleId }}"
  },
  "handler": ["after"],
  "method": ["create"],
  "condition": { "conjunction": "", "conditions": [], "custom": "" }
}
```

Required fields: `name` (`role`), `settings.association` (`new` for registration), `settings.type` (`add`), `settings.role` (the custom role `_id`), `handler` (`["after"]`), `method` (`["create"]`).

Response: the created action document with `_id`, `form` (the resource ID), `machineName`, plus the fields from the request.

Errors: `400` for invalid `settings.role` or missing handler/method; `404` if the resource ID does not exist.

### POST ${FORMIO_PROJECT_URL}/:employeeResourcePath/submission

Register a new custom user by submitting to the custom resource's path. The `after/create` Role Assignment action adds the custom role automatically.

Request body (JSON):

```json
{
  "data": {
    "firstName": "Kraig",
    "lastName": "Schowalter",
    "email": "Samir.Schmeler92@yahoo.com",
    "password": "CHANGEME"
  }
}
```

Required fields: every component on the custom resource marked `validate.required: true`.

Response: the created submission document — `_id`, `form` (resource `_id`), `owner`, `roles` (now contains the custom role `_id`), `access`, `metadata`, `data` (password stripped).

Errors: `400` for missing required fields or duplicate email; `401`/`403` if anonymous create is not allowed on the resource.

Example:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d @employee.json \
  "${FORMIO_PROJECT_URL}/employee-112/submission"
```

### POST ${FORMIO_PROJECT_URL}/form (Employee Login Form)

Create the login form for the custom user type. This is a regular `form` (not a resource) with `email`, `password`, and typically a `verifyPassword` component for client-side confirmation.

Request body (JSON):

```json
{
  "title": "Employee Login",
  "path": "employee/login",
  "name": "employeeLogin",
  "type": "form",
  "components": [
    { "type": "email", "key": "email", "label": "Email", "validate": { "required": true } },
    {
      "type": "password",
      "key": "password",
      "label": "Password",
      "validate": { "required": true }
    },
    {
      "type": "password",
      "key": "verifyPassword",
      "label": "Verify Password",
      "validate": {
        "required": true,
        "custom": "valid = input === data.password ? true : 'Passwords must match'"
      }
    }
  ]
}
```

Response: the created form document. Persist `_id` as `employeeLoginFormId`, `name` as `employeeLoginFormName`, and `path` as `employeeLoginFormPath`.

Errors: `400` for duplicate path/name; `401`/`403` for insufficient access.

### PUT ${FORMIO_PROJECT_URL}/:employeeLoginFormPath

Update the custom login form to allow anonymous submissions so unauthenticated users can log in. Full-document PUT — send the complete form definition plus an `access` array that includes the `Anonymous` role for `create_own`/`read_all` as appropriate.

Request body: the full form document (as returned by the create call), plus an explicit `access` array granting the Anonymous role the permissions needed to submit.

Response: the updated form document with the expanded `access` list.

Errors: `400` for invalid access entries; `404` if the form path does not exist.

### GET ${FORMIO_PROJECT_URL}/:employeeLoginFormPath/action

List actions currently attached to the custom login form. On fresh forms this returns the default `Save Submission` action (`name: "save"`), which must be removed before attaching a `Login` action.

Response: JSON array of action documents: `_id`, `title`, `name`, `handler`, `method`, `priority`, `form`, `machineName`.

Errors: `404` if the form path does not exist.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "${FORMIO_PROJECT_URL}/employee/login-374/action"
```

### DELETE ${FORMIO_PROJECT_URL}/:employeeLoginFormPath/action/:employeeLoginSaveActionId

Remove the default `Save Submission` action from the custom login form — login submissions must NOT be persisted, so this action has to go before the `Login` action is added.

Response: plain text `OK`.

Errors: `404` if the action ID does not exist on that form.

### POST ${FORMIO_PROJECT_URL}/:employeeLoginFormPath/action

Attach the `Login` action to the custom login form. This action matches the submitted credentials against one or more user resources and issues a JWT on success.

Request body (JSON):

```json
{
  "priority": 2,
  "name": "login",
  "title": "Employee Login",
  "settings": {
    "resources": ["{{ employeeResourceId }}"],
    "username": "email",
    "password": "password",
    "allowedAttempts": "5",
    "attemptWindow": "30",
    "lockWait": "1800"
  },
  "handler": ["before"],
  "method": ["create"],
  "condition": { "conjunction": "", "conditions": [], "custom": "" }
}
```

Required fields: `name` (`login`), `settings.resources` (array of user-resource `_id`s to authenticate against), `settings.username`, `settings.password`, `handler` (`["before"]`), `method` (`["create"]`). Optional rate-limit fields: `allowedAttempts`, `attemptWindow`, `lockWait` (all stringified seconds/counts per Form.io convention).

Response: the created action document.

Errors: `400` for missing `resources` or invalid field references; `404` if the form path does not exist.

### POST ${FORMIO_PROJECT_URL}/:employeeLoginFormPath/submission

Log in a custom user by submitting to the custom login form. The `before/create` Login action validates the credentials against the configured `resources` and returns the authenticated user's submission document, setting the `x-jwt-token` response header.

Request body (JSON):

```json
{
  "data": {
    "email": "Samir.Schmeler92@yahoo.com",
    "password": "CHANGEME",
    "verifyPassword": "CHANGEME"
  }
}
```

Required fields: match the login form's required components — typically `email`, `password`, and `verifyPassword`.

Response: the matched user submission document — `_id`, `form` (the custom user resource `_id`), `owner`, `roles` (including the custom role), `access`, `metadata`, `data`. The JWT is in the `x-jwt-token` response header.

Errors: `401` for invalid credentials; `429`-style locked responses when `allowedAttempts` is exceeded within `attemptWindow`.

Example:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"data":{"email":"Samir.Schmeler92@yahoo.com","password":"CHANGEME","verifyPassword":"CHANGEME"}}' \
  "${FORMIO_PROJECT_URL}/employee/login-374/submission"
```

## Related Skills

- [runtime-auth](./runtime-auth.md) — default `user`/`userLogin` end-user auth flow
- [runtime-submissions](./runtime-submissions.md) — submitting form data as an authenticated custom user
- [project-actions](./project-actions.md) — full reference for form actions (Role Assignment, Login, Save, etc.)
- [project-roles](./project-roles.md) — managing the custom roles referenced by Role Assignment actions
