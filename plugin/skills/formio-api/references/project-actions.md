## Overview

Form Actions are server-side hooks (email, webhook, save, login, role, etc.) that run before or after submission events on a form. This skill covers everything a project admin does with actions: discovering the action types available in the project, inspecting a specific action's settings form, attaching an action to a form, listing and retrieving the actions configured on a form, updating an action's settings, and removing an action. These operations apply per-form — every action is scoped to exactly one form.

## Root URL

All endpoints below are rooted at `{projectUrl}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers this operation — use the HTTP endpoint directly.

## Endpoints

### GET {projectUrl}/form/:formId/actions

List every action type available in the project — a catalog of what can be attached to a form. This does NOT return the actions currently configured on the form; see `GET .../action` for that.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form whose available action types are being listed. The form context allows the server to filter out action types that do not apply to the form's type (e.g., `login` only applies to resources). |

Response: JSON array of action-type descriptors. Each entry includes `name`, `title`, `description`, `priority`, and a `defaults` object describing the default `handler`, `method`, `priority`, `name`, and `title` for newly-attached instances.

```json
[
  {
    "name": "email",
    "title": "Email",
    "description": "Allows you to email people on submission.",
    "priority": 0,
    "defaults": {
      "handler": ["after"],
      "method": ["create"],
      "priority": 0,
      "name": "email",
      "title": "Email"
    }
  }
]
```

Errors: `401` if the JWT is missing/expired; `403` if the caller lacks read access to the form; `404` if the form does not exist.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/form/69d68907040fa2cea2572b71/actions"
```

### GET {projectUrl}/form/:formId/actions/:actionName

Retrieve detailed information about one action type, including the `settingsForm` that defines which fields the admin must fill in when attaching this action. Use this to drive a UI that configures the action.

| Path parameter | Type | Description |
| --- | --- | --- |
| `formId` | string | The MongoDB `_id` of the form. |
| `actionName` | string | The action-type name (e.g., `email`, `login`, `role`, `webhook`, `save`). |

Response: action-type descriptor with an added `settingsForm` object. `settingsForm.components` is an array of Form.io components describing the fields required to configure the action (for example, the `email` action exposes `emails`, `from`, `subject`, `message`, `transport`).

Errors: `404` if the action type is unknown for this form; `401`/`403` as above.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/form/69d68907040fa2cea2572b71/actions/email"
```

### POST {projectUrl}/form/:formId/action

Attach an action instance to a form.

| Path parameter | Type   | Description                                            |
| -------------- | ------ | ------------------------------------------------------ |
| `formId`       | string | The MongoDB `_id` of the form to attach the action to. |

Request body (JSON):

```json
{
  "name": "email",
  "title": "Email",
  "method": ["create"],
  "handler": ["after"],
  "priority": 0,
  "settings": {
    "emails": ["test@example.com"],
    "from": "no-reply@form.io",
    "message": "{{ submission(data, form.components) }}",
    "subject": "New submission for {{ form.title }}.",
    "transport": "default"
  }
}
```

Required fields: `name` (action type), `title`, `method` (array of `create`/`update`/`delete`/`read`), `handler` (array of `before`/`after`), `priority`, `settings` (shape depends on the action type — consult `GET .../actions/:actionName` for the `settingsForm`).

Response: the created action document, with server-assigned `_id` and `form` (the form ID it was attached to).

Errors: `400` for validation errors (unknown action name, invalid `handler`/`method` values, settings that fail the action's `settingsForm` validation); `404` if the form does not exist; `401`/`403` as above.

Example:

```bash
curl -X POST -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d @email-action.json \
  "{projectUrl}/form/69d68907040fa2cea2572b71/action"
```

### GET {projectUrl}/form/:formId/action

List all actions currently attached to a form, in priority order.

| Path parameter | Type   | Description                    |
| -------------- | ------ | ------------------------------ |
| `formId`       | string | The MongoDB `_id` of the form. |

Response: JSON array of action documents. Each entry includes `_id`, `title`, `name`, `handler`, `method`, `priority`, `form`, and `machineName`. Note that `settings` may be omitted from the list response for brevity — fetch a single action for its full settings.

```json
[
  {
    "_id": "69d68907040fa2cea2572b79",
    "title": "Save Submission",
    "name": "save",
    "handler": ["before"],
    "method": ["create", "update"],
    "priority": 10,
    "form": "69d68907040fa2cea2572b71",
    "machineName": "example:example:save"
  }
]
```

Errors: `404` if the form does not exist; `401`/`403` as above.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/form/69d68907040fa2cea2572b71/action"
```

### GET {projectUrl}/form/:formId/action/:actionId

Retrieve a single configured action, including its full `settings`.

| Path parameter | Type   | Description                               |
| -------------- | ------ | ----------------------------------------- |
| `formId`       | string | The MongoDB `_id` of the form.            |
| `actionId`     | string | The MongoDB `_id` of the action instance. |

Response: the full action document — `_id`, `title`, `name`, `handler`, `method`, `priority`, `settings`, `form`, `machineName`.

Errors: `404` if no action with that ID exists on the form; `401`/`403` as above.

Example:

```bash
curl -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/form/69d68907040fa2cea2572b71/action/69d6a7f7040fa2cea2572eec"
```

### PUT {projectUrl}/form/:formId/action/:actionId

Update a configured action. This is a full replacement of the action's editable fields — include every field you want to preserve.

| Path parameter | Type   | Description                                         |
| -------------- | ------ | --------------------------------------------------- |
| `formId`       | string | The MongoDB `_id` of the form.                      |
| `actionId`     | string | The MongoDB `_id` of the action instance to update. |

Request body (JSON): same shape as the create body.

```json
{
  "name": "email",
  "title": "Email",
  "method": ["create"],
  "handler": ["after"],
  "priority": 0,
  "settings": {
    "emails": ["test@example.com", "another@example.com"],
    "from": "no-reply@form.io",
    "message": "{{ submission(data, form.components) }}",
    "subject": "New submission for {{ form.title }}.",
    "transport": "default"
  }
}
```

Response: the updated action document.

Errors: `400` for validation errors; `404` if the action does not exist on the form; `401`/`403` as above.

Example:

```bash
curl -X PUT -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d @email-action.json \
  "{projectUrl}/form/69d68907040fa2cea2572b71/action/69d6a7f7040fa2cea2572eec"
```

### DELETE {projectUrl}/form/:formId/action/:actionId

Remove an action from a form. Irreversible — the action stops running immediately.

| Path parameter | Type   | Description                                         |
| -------------- | ------ | --------------------------------------------------- |
| `formId`       | string | The MongoDB `_id` of the form.                      |
| `actionId`     | string | The MongoDB `_id` of the action instance to delete. |

Response: `200 OK` with plain text body `OK`.

Errors: `404` if the action does not exist on the form; `401`/`403` as above.

Example:

```bash
curl -X DELETE -H "x-jwt-token: $FORMIO_JWT" \
  "{projectUrl}/form/69d68907040fa2cea2572b71/action/69d6a7f7040fa2cea2572eec"
```

## Related Skills

- [project-forms](./project-forms.md) — managing the forms that actions are attached to
- [project-form-revisions](./project-form-revisions.md) — form revisioning (actions themselves are not revisioned)
- [project-roles](./project-roles.md) — roles manipulated by the `role` and `login` actions
- [project-auth](./project-auth.md) — the admin login action pattern (a `login` action attached to the admin login form)
