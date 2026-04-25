---
name: formio-actions
description: >-
  Deep reference for configuring Form.io actions — the server-side behavior layer
  that powers email notifications, authentication, webhooks, role assignment, and
  form-to-form saves. Use this skill whenever the user wants to add, configure, or
  troubleshoot an action on a form, choose the right action type for a use case,
  understand the action execution lifecycle, set up conditions or handler/method
  combinations, or wire up authentication flows. Also use when the user mentions
  action settings, action priorities, action conditions, email actions, login actions,
  webhook actions, role actions, save actions, or reset password actions — even if
  they don't say "action" explicitly (e.g., "send an email when someone submits",
  "add login to this form", "assign a role after registration").
---

# Form.io Actions Reference

Actions are server-side behaviors attached to forms. When a submission is created, updated, read, or deleted, the server runs every action configured on that form whose handler and method match the current operation.

## MCP Tool Preference

When the user wants to manage actions on a live Form.io project, prefer the MCP server's first-party tools:

| Operation | MCP Tool |
|-----------|----------|
| List available action types | `action_types_list` |
| Get action type info + settings schema | `action_type_get` |
| Create an action on a form | `action_create` |
| List actions on a form | `action_list` |
| Get a single action | `action_get` |
| Update an action | `action_update` |
| Delete an action | `action_delete` |

**Workflow for creating an action:**
1. Call `action_type_get` with the action name to discover the required settings schema
2. Construct the action definition using the settings schema as a guide
3. Call `action_create` with the complete action definition

## Action Anatomy

Every action has these core fields:

```json
{
  "name": "email",
  "title": "Send Notification",
  "handler": ["after"],
  "method": ["create"],
  "priority": 0,
  "settings": { /* varies per action type */ },
  "condition": { /* optional, see Conditions section */ }
}
```

### Handler — When it runs relative to the save

| Handler | Timing | Use for |
|---------|--------|---------|
| `before` | Before the submission is saved to the database | Validation, authentication, data transformation, blocking operations |
| `after` | After the submission is saved | Notifications, webhooks, role assignment, anything that needs the saved submission |

### Method — Which operation triggers it

| Method | HTTP Verb | When |
|--------|-----------|------|
| `create` | POST | New submission |
| `update` | PUT/PATCH | Existing submission modified |
| `delete` | DELETE | Submission removed |
| `read` | GET | Single submission retrieved |
| `index` | GET | Submission list retrieved |
| `form` | GET | Form schema requested |

### Priority — Execution order

Actions run in descending priority order. Higher numbers run first.

| Action Type | Default Priority | Why |
|-------------|-----------------|-----|
| `oauth` | 20 | OAuth must intercept before anything else (enterprise) |
| `save` | 10 | Must save before other actions can reference the submission |
| `esign` | 6 | eSignature after save (enterprise) |
| `group` | 5 | Group assignment before notifications (enterprise) |
| `ldap` | 3 | LDAP auth early in pipeline (enterprise) |
| `login` / `twofalogin` / `twofarecoverylogin` | 2 | Authentication should happen early |
| `role` | 1 | Role assignment before notifications |
| `email` / `webhook` / `googlesheet` / `sqlconnector` | 0 | Side effects after everything else |

When multiple actions share the same priority, execution order is not guaranteed between them.

## Action Types

Form.io ships 6 action types in the open-source server. Enterprise servers add 7+ more. The action type catalog is dynamic — always call `action_type_get` or `action_types_list` to discover what's available on the connected server.

### Quick Reference — Open Source

| Type | Purpose | Default Handler | Default Method |
|------|---------|----------------|----------------|
| `save` | Persist submission to database | `before` | `create`, `update` |
| `login` | Authenticate users against a resource | `before` | `create` |
| `role` | Add or remove a role from a user | `after` | `create` |
| `email` | Send email notification | `after` | `create` |
| `webhook` | Call an external URL | `after` | `create`, `update`, `delete` |
| `resetpass` | Password reset flow | `before`+`after` | `form`, `create` |

### Quick Reference — Enterprise

| Type | Purpose | Default Handler | Default Method |
|------|---------|----------------|----------------|
| `oauth` | OAuth/SSO authentication (Google, GitHub, OpenID, etc.) | `after` | `form`, `create` |
| `group` | Assign users to groups for group-based permissions | `after` | `create`, `update`, `delete` |
| `ldap` | Authenticate against LDAP/Active Directory | `before` | `create` |
| `twofalogin` | Two-factor authentication login | `before` | `create` |
| `twofarecoverylogin` | 2FA recovery code login | `before` | `create` |
| `googlesheet` | Sync submission data to Google Sheets | `after` | `create`, `update`, `delete` |
| `sqlconnector` | Execute SQL queries via Resquel | `after` | `create`, `update`, `delete` |

For detailed settings and configuration for each action type, read `references/action-types.md`.

## Conditions

Conditions control whether an action executes for a given submission. If no condition is set, the action always runs (when handler/method match).

### Conjunction-based conditions (recommended)

```json
{
  "condition": {
    "conjunction": "all",
    "conditions": [
      { "component": "status", "operator": "isEqual", "value": "approved" },
      { "component": "priority", "operator": "isNotEmpty" }
    ]
  }
}
```

**Conjunction**: `"all"` (every condition must be true) or `"any"` (at least one must be true).

### Available operators

| Category | Operators |
|----------|-----------|
| General | `isEqual`, `isNotEqual`, `isEmpty`, `isNotEmpty` |
| Numeric | `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual` |
| String | `startsWith`, `endsWith`, `includes`, `notIncludes` |
| Date | `isDateEqual`, `isNotDateEqual`, `dateGreaterThan`, `dateGreaterThanOrEqual`, `dateLessThan`, `dateLessThanOrEqual` |

The `component` field is the form component's API key. For root-level submission properties, use `(submission).created`, `(submission).modified`, etc.

The `value` field can be omitted for operators that don't need it (`isEmpty`, `isNotEmpty`).

## Common Patterns

### User registration with role assignment

A registration form typically needs two actions:

1. **Save** (built-in, usually already present) — persists the user submission
2. **Role assignment** — assigns the "Authenticated" role to the new user

```json
{
  "name": "role",
  "title": "Assign Authenticated Role",
  "handler": ["after"],
  "method": ["create"],
  "settings": {
    "association": "new",
    "type": "add",
    "role": "<authenticated-role-id>"
  }
}
```

`association: "new"` means "the resource being created by this submission." Use `"existing"` when the form references another resource (e.g., an admin form that modifies another user's roles).

### Login form

A login form needs only the login action — no save action (login doesn't create a submission).

```json
{
  "name": "login",
  "title": "Login",
  "handler": ["before"],
  "method": ["create"],
  "settings": {
    "resources": ["<user-resource-id>"],
    "username": "email",
    "password": "password"
  }
}
```

The `username` and `password` fields reference component API keys on the login form. The `resources` array lists which resource forms contain the user submissions to authenticate against.

Login includes brute-force protection: after 5 failed attempts within 30 seconds, the account locks for 30 minutes (configurable via `allowedAttempts`, `attemptWindow`, `lockWait`).

### Email notification on submission

```json
{
  "name": "email",
  "title": "Notify Admin",
  "handler": ["after"],
  "method": ["create"],
  "settings": {
    "transport": "default",
    "from": "no-reply@example.com",
    "emails": ["admin@example.com"],
    "subject": "New submission for {{ form.title }}",
    "message": "{{ submission(data, form.components) }}"
  }
}
```

The `{{ submission(data, form.components) }}` template renders all form fields as a formatted table. You can also reference individual fields: `{{ data.firstName }}`, `{{ data.email }}`.

### Conditional email (only when status = approved)

```json
{
  "name": "email",
  "title": "Approval Notification",
  "handler": ["after"],
  "method": ["update"],
  "settings": {
    "transport": "default",
    "from": "no-reply@example.com",
    "emails": ["{{ data.applicantEmail }}"],
    "subject": "Your application has been approved",
    "message": "Congratulations {{ data.firstName }}, your application has been approved."
  },
  "condition": {
    "conjunction": "all",
    "conditions": [
      { "component": "status", "operator": "isEqual", "value": "approved" }
    ]
  }
}
```

### Webhook integration

```json
{
  "name": "webhook",
  "title": "Sync to CRM",
  "handler": ["after"],
  "method": ["create", "update"],
  "settings": {
    "url": "https://api.example.com/webhook/formio",
    "block": false
  }
}
```

Set `block: true` if you need the webhook response before the form submission completes (the response is stored in submission metadata). Leave `false` for fire-and-forget.

The webhook URL supports interpolation: `https://api.example.com/{{ data.type }}/submit`.

The webhook sends:
```json
{
  "request": { /* original submission body */ },
  "response": { /* response object */ },
  "submission": { /* current submission */ },
  "params": { /* URL parameters */ }
}
```

### Password reset flow

The reset password action is unique — it uses both `before` and `after` handlers and operates in two phases:

1. **Phase 1 (user submits email)**: Looks up user, generates a temporary JWT token, emails a reset link
2. **Phase 2 (user clicks link with token)**: Validates token, accepts new password, encrypts and saves

```json
{
  "name": "resetpass",
  "title": "Reset Password",
  "handler": ["before", "after"],
  "method": ["form", "create"],
  "settings": {
    "resources": ["<user-resource-id>"],
    "username": "email",
    "password": "password",
    "url": "https://myapp.com/reset-password",
    "transport": "default",
    "from": "no-reply@example.com",
    "subject": "Password Reset Request",
    "message": "<p>Click the link to reset your password: {{ resetlink }}</p>"
  }
}
```

The `{{ resetlink }}` template variable is replaced with the full URL including the temporary JWT token. The token expires in 5 minutes.

## Troubleshooting

**Action not firing:**
- Check handler matches the operation timing (before/after)
- Check method matches the HTTP verb (create/update/delete)
- Check condition logic — use `action_get` to inspect the saved condition
- Verify priority isn't causing another action to fail first and stop the pipeline

**Email not sending:**
- Verify transport is configured on the server
- Check `settings.emails` is not empty
- Template fetch failures fall back to the message field silently

**Webhook timing out:**
- Non-blocking mode (`block: false`) won't report errors to the user
- Blocking mode waits for the response — if the external service is slow, the submission will be slow

**Login returning 401:**
- Verify `resources` array contains the correct resource form ID
- Verify `username` and `password` keys match the login form's component API keys
- Check brute-force lockout: `allowedAttempts` (default 5), `lockWait` (default 1800s = 30 min)

**Role not being assigned:**
- For new registrations, use `association: "new"`
- For admin forms modifying existing users, use `association: "existing"` and ensure the form has a component that submits the target resource's submission ID
- Verify the role ID exists (use the project roles API)
