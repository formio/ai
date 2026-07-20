# Action Types — Detailed Settings Reference

## Table of Contents

### Open Source

1. [Save Submission](#save-submission)
2. [Login](#login)
3. [Role Assignment](#role-assignment)
4. [Email](#email)
5. [Webhook](#webhook)
6. [Reset Password](#reset-password)

### Enterprise

7. [OAuth](#oauth)
8. [Group Assignment](#group-assignment)
9. [LDAP Login](#ldap-login)
10. [2FA Login](#2fa-login)
11. [2FA Recovery Login](#2fa-recovery-login)
12. [Google Sheets](#google-sheets)
13. [SQL Connector](#sql-connector)

---

## Save Submission

**Name:** `save` | **Priority:** 10 | **Handler:** `before` | **Method:** `create`, `update`

The save action persists the submission to the database. Add it to any form or resource meant to store its submissions — most are. Omit it when the form is not meant to persist: a login form (auth only), a notification-only form (fires an Email or Webhook on submit but stores nothing), or a client-only form whose data the app reads in the browser and never sends to the submission API. It runs at priority 10 so other actions can depend on the saved submission.

### Settings

| Field | Key | Type | Description |
| --- | --- | --- | --- |
| Save to Resource | `resource` | resource select | Optional. Maps submission data to a different resource form |

### Field Mapping (when saving to another resource)

When `resource` is set, use `settings.fields` to map fields:

```json
{
  "settings": {
    "resource": "<target-resource-id>",
    "fields": {
      "<target-field-key>": "<source-field-key>"
    }
  }
}
```

Use the special value `"data"` to map the entire data object.

### Transform

The save action supports a `transform` setting — a JavaScript string executed in an isolated VM that can modify `submission.data` before saving to the target resource. The transform has access to `submission` and `data` variables.

### External IDs

When saving to a resource, the server creates a back-reference in the source submission's `externalIds` array:

```json
{
  "externalIds": [
    { "type": "resource", "resource": "<resource-id>", "id": "<created-submission-id>" }
  ]
}
```

---

## Login

**Name:** `login` | **Priority:** 2 | **Handler:** `before` | **Method:** `create`

Authenticates a user against one or more resource forms. Does not create a submission — it intercepts the POST and performs authentication instead.

### Settings

| Field | Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Resources | `resources` | string[] | Yes | — | Resource form IDs to authenticate against |
| Username Field | `username` | string | Yes | — | Component API key for the username/email field |
| Password Field | `password` | string | Yes | — | Component API key for the password field |
| Max Login Attempts | `allowedAttempts` | number | No | 5 | 0 = unlimited. Failed attempts before lockout |
| Attempt Time Window | `attemptWindow` | number | No | 30 | Seconds. Window for counting failed attempts |
| Locked Wait Time | `lockWait` | number | No | 1800 | Seconds (30 min). How long the account stays locked |

### Authentication Flow

1. User submits login form with username + password
2. Server queries each resource in `resources` for a submission matching the username field
3. Password is compared using bcrypt
4. On success: JWT token set in `x-jwt-token` response header
5. On failure: 401 response

### Brute-Force Protection

Failed attempts are tracked in `user.metadata.login`:

- After `allowedAttempts` failures within `attemptWindow` seconds, the account locks
- Locked accounts must wait `lockWait` seconds before retrying
- Setting `allowedAttempts: 0` disables lockout (not recommended)

---

## Role Assignment

**Name:** `role` | **Priority:** 1 | **Handler:** `after` | **Method:** `create`

Adds or removes a role from a user's submission. The target user is determined by the `association` setting.

### Settings

| Field | Key | Type | Options | Required | Description |
| --- | --- | --- | --- | --- | --- |
| Resource Association | `association` | string | `new`, `existing` | Yes | Which resource to modify |
| Action Type | `type` | string | `add`, `remove` | Yes | Whether to add or remove the role |
| Role | `role` | string | — | Yes | The role ID to assign/remove |

### Association Types

**`new`** — The submission being created IS the resource. Use this for registration forms where the new user should receive a role.

**`existing`** — The form references an existing resource submission. The form must contain a component whose value is the target resource's submission ID (typically a hidden field or select resource). Use this for admin panels where one user modifies another user's roles.

### How It Works

- Loads the target submission's `roles` array
- `add`: Appends the role ID (deduplicates)
- `remove`: Filters the role ID out
- Saves directly via MongoDB update (bypasses the normal submission pipeline)

---

## Email

**Name:** `email` | **Priority:** 0 | **Handler:** `after` | **Method:** `create`

Sends an email notification when a submission event occurs.

### Settings

| Field | Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Transport | `transport` | string | Yes | — | Email transport name (e.g., `"default"`) |
| From | `from` | string | No | `no-reply@example.com` | Sender email address — see "From address" below |
| Reply-To | `replyTo` | string | No | — | Reply-to address |
| To Emails | `emails` | string[] | Yes | — | Recipient addresses |
| Send Each | `sendEach` | boolean | No | false | Send individual email per recipient |
| Cc | `cc` | string[] | No | — | Carbon copy |
| Bcc | `bcc` | string[] | No | — | Blind carbon copy |
| Subject | `subject` | string | No | `New submission for {{ form.title }}.` | Subject line |
| Template URL | `template` | string | No | `https://pro.formview.io/assets/email.html` | External HTML template |
| Message | `message` | string | No | `{{ submission(data, form.components) }}` | Email body |
| Rendering Method | `renderingMethod` | string | No | `dynamic` | `dynamic` (formio.js) or `static` (legacy) |

### Template Variables

| Variable | Description |
| --- | --- |
| `{{ data.fieldKey }}` | Individual submission field value |
| `{{ id }}` | The current submission's `_id` |
| `{{ submission(data, form.components) }}` | Formatted table of all submission fields |
| `{{ form.title }}` | Form title |
| `{{ form._id }}` | Form ID |
| `{{ owner.data.email }}` | Submission owner's email (if available) |
| `{{ config.<key> }}` | A value from the project's public configuration — see "config tokens" below |

Email addresses in `emails`, `cc`, `bcc` also support template variables, allowing dynamic recipients: `{{ data.managerEmail }}`.

### From address

`from` addresses at the `@form.io` domain (e.g. `no-reply@form.io`) are **blocked by the platform and silently fail to send** — never use them. When an Email action is needed, **ask the user which "from" address they want** before emitting the action. If they don't provide one, default to `no-reply@example.com` — never `no-reply@form.io`.

### `submission._id` is not a token

`{{ submission._id }}` does NOT work — `submission` is not a template variable, so it renders empty. To inject the current submission's id, use **`{{ id }}`**.

### config tokens — require project public configuration

Any `{{ config.<key> }}` token (e.g. `{{ config.appUrl }}` for a link back to the app) reads from the **project's public configuration**. If that key is not present in the project config, the token renders as an empty string and the email ships with a blank link. Whenever a template or subject references `{{ config.<something> }}`, that `<something>` MUST be added to the project's public config first.

Set it with a `PUT` to the project endpoint, passing a `config` object:

```jsonc
// PUT /project/{projectId}   (or PUT {projectUrl})
{
  ...,
  "config": {
    ...,
    "appUrl": "https://myapp.example.com"
  }
}
```

### External Templates

If `template` is set to a URL, the server fetches that HTML and uses it as the email wrapper. The `message` content is injected into the template. If the fetch fails, the message is sent directly without a template wrapper.

---

## Webhook

**Name:** `webhook` | **Priority:** 0 | **Handler:** `after` | **Method:** `create`, `update`, `delete`

Makes an HTTP request to an external URL when a submission event occurs.

### Settings

| Field | Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Webhook URL | `url` | string | Yes | — | Target URL (supports `{{ data.field }}` interpolation) |
| Block Request | `block` | boolean | No | false | Wait for webhook response before completing submission |
| Username | `username` | string | No | — | HTTP Basic Auth username |
| Password | `password` | string | No | — | HTTP Basic Auth password |

### Request Payload

The webhook sends a JSON POST/PUT/DELETE (matching the submission's HTTP method):

```json
{
  "request": {
    /* original request body */
  },
  "response": {
    /* response object */
  },
  "submission": {
    /* current submission as plain object */
  },
  "params": {
    /* URL route parameters */
  }
}
```

### Blocking vs Non-Blocking

**Non-blocking** (`block: false`, default): The webhook fires in the background. The form submission completes immediately regardless of webhook success/failure. Errors are logged but not surfaced to the user.

**Blocking** (`block: true`): The submission waits for the webhook response. If the webhook returns a non-2xx status, the submission fails with an error. The webhook response is stored in `submission.metadata[action.title]`.

### URL Interpolation

The URL supports template variables: `https://api.example.com/{{ data.type }}/{{ data._id }}`

---

## Reset Password

**Name:** `resetpass` | **Handler:** `before`+`after` | **Method:** `form`, `create`

Implements a two-phase password reset flow using temporary JWT tokens.

### Settings

| Field | Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Resources | `resources` | string[] | Yes | — | Resource forms containing user submissions |
| Username Field | `username` | string | Yes | — | Component API key for username/email |
| Password Field | `password` | string | Yes | — | Component API key for password |
| Reset Link URL | `url` | string | Yes | — | Base URL for the reset page |
| Transport | `transport` | string | Yes | — | Email transport |
| From | `from` | string | No | Server default | Sender email |
| Subject | `subject` | string | No | `You requested a password reset` | Email subject |
| Message | `message` | string | No | Default template | Email body with `{{ resetlink }}` |
| Button Label | `label` | string | No | `Email Reset Password Link` | Submit button text shown on the form |

### Two-Phase Flow

**Phase 1 — Request reset (user submits email):**

1. The `before` + `form` handler modifies the form display: hides password field, shows only username, changes submit button label
2. User submits their email/username
3. Server looks up the user across configured resources
4. Generates a temporary JWT (5-minute expiry) with `type: "resetpass"`
5. Sends email with `{{ resetlink }}` expanded to `{url}?x-jwt-token={token}`

**Phase 2 — Set new password (user clicks link):**

1. The `before` + `form` handler modifies the form: hides username, shows password field
2. User enters new password and submits
3. Server validates the JWT token type is `"resetpass"`
4. Encrypts the new password with bcrypt and saves
5. Maximum password length: 200 characters (configurable)

### Template Variables

| Variable          | Description                                         |
| ----------------- | --------------------------------------------------- |
| `{{ resetlink }}` | Full URL with JWT token appended as query parameter |

---

# Enterprise Action Types

The following actions are available on enterprise Form.io servers.

---

## OAuth

**Name:** `oauth` | **Priority:** 20 | **Handler:** `after` | **Method:** `form`, `create`

Provides OAuth/SSO authentication. Supports multiple providers (Google, GitHub, OpenID Connect, etc.) and can authenticate remotely, log in existing resources, register new resources, or link to the current user.

### Settings

| Field | Key | Type | Required | Description |
| --- | --- | --- | --- | --- |
| OAuth Provider | `provider` | select | Yes | The configured OAuth provider |
| Action | `association` | select | Yes | What to do after OAuth completes (see below) |
| Resource | `resource` | select | Yes\* | Target resource form (\*required for `existing` and `new`) |
| Role | `role` | select | No | Role to assign (only for `new` association) |
| Sign-in Button | `button` | select | Yes | Form button component with `action: "oauth"` |
| Assign Roles | `roles` | datagrid | No | Map OAuth claims to roles (only for `remote` association) |
| OAuth Callback URL | `redirectURI` | string | No | Defaults to `window.location.origin` |

### Association Types

| Value | Label | Behavior |
| --- | --- | --- |
| `remote` | Remote Authentication | Authenticates via OAuth provider only; no local resource lookup |
| `existing` | Login Existing Resource | Matches OAuth identity to an existing resource submission |
| `new` | Register New Resource | Creates a new resource submission from OAuth profile |
| `link` | Link Current User | Associates OAuth identity with the currently logged-in user |

### Field Mapping

When `association` is `new`, a field mapping section appears to map OAuth profile fields to resource fields. For OpenID providers, this uses a claim-to-field datagrid. For other providers, per-field dropdowns are generated automatically.

---

## Group Assignment

**Name:** `group` | **Priority:** 5 | **Handler:** `after` | **Method:** `create`, `update`, `delete`

Assigns users to groups for group-based access control. This is a premium feature that enables row-level permissions based on group membership.

### Settings

| Field | Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Group Resource | `group` | select | Yes | — | Select component on the form that references the group resource |
| User Resource | `user` | select | No | `self` | Select component referencing the user resource (defaults to current user) |
| User Role | `role` | select | No | — | Select component referencing the role to assign within the group |

### How It Works

- Reads the group ID(s) from the group selector component on the submission
- Determines the target user (current user if `self`, or from a user reference field)
- Applies role changes based on the group's access configuration
- Runs on create, update, and delete to keep group membership in sync

---

## LDAP Login

**Name:** `ldap` | **Priority:** 3 | **Handler:** `before` | **Method:** `create`

Authenticates users against an LDAP or Active Directory server. Requires LDAP to be configured in the project settings.

### Settings

| Field | Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Username Field | `usernameField` | select | Yes | — | Form component key (textfield or email) |
| Password Field | `passwordField` | select | Yes | — | Form component key (password type) |
| Passthrough | `passthrough` | boolean | No | false | If true, failed LDAP auth passes through to the next action (incorrect passwords still fail) |
| Assign Roles | `roles` | datagrid | No | — | Map LDAP properties to roles: property, value, role |

### Role Mapping

The `roles` datagrid lets you assign Form.io roles based on LDAP attributes:

```json
{
  "roles": [
    { "property": "memberOf", "value": "CN=Admins,DC=example,DC=com", "role": "<admin-role-id>" },
    { "property": "", "value": "", "role": "<default-role-id>" }
  ]
}
```

If both `property` and `value` are empty, the role is assigned to all LDAP-authenticated users.

### Available LDAP Properties

The following LDAP attributes are available for role mapping: `dn`, `cn`, `givenName`, `sn`, `mail`, `memberOf`, `displayName`, `userPrincipalName`, `sAMAccountName`, `objectClass`, `distinguishedName`.

---

## 2FA Login

**Name:** `twofalogin` | **Priority:** 2 | **Handler:** `before` | **Method:** `create`

Handles two-factor authentication login. Requires the user to have 2FA enabled on their account.

### Settings

| Field       | Key     | Type   | Required | Description                       |
| ----------- | ------- | ------ | -------- | --------------------------------- |
| Token Field | `token` | select | No       | Form component for the TOTP token |

### How It Works

1. Requires an active session (user must be logged in first via standard login)
2. Checks 2FA rate limiting (`twoFactorLockedUntil`)
3. Validates user has `data.twoFactorAuthenticationEnabled` set to true
4. Verifies the TOTP token from the token field
5. On success, completes the authentication session

---

## 2FA Recovery Login

**Name:** `twofarecoverylogin` | **Priority:** 2 | **Handler:** `before` | **Method:** `create`

Handles login with a 2FA recovery code when the user has lost access to their authenticator app.

### Settings

| Field               | Key     | Type   | Required | Description                          |
| ------------------- | ------- | ------ | -------- | ------------------------------------ |
| Recovery Code Field | `token` | select | No       | Form component for the recovery code |

### How It Works

1. Validates user has 2FA enabled
2. Verifies the recovery code from the token field
3. On success, completes the authentication session
4. No rate limiting (unlike standard 2FA login)

---

## Google Sheets

**Name:** `googlesheet` | **Priority:** 0 | **Handler:** `after` | **Method:** `create`, `update`, `delete`

Syncs submission data to a Google Sheets spreadsheet. Requires Google Sheets integration to be configured on the server.

### Settings

| Field | Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Sheet ID | `sheetID` | string | Yes | — | The Google Sheets spreadsheet ID |
| Worksheet Name | `worksheetName` | string | Yes | — | The worksheet tab name (e.g., `"Sheet1"`) |
| Start Row | `spreadSheetStartRow` | string | No | `"2"` | First data row (row 1 is typically headers) |
| Field Mappings | (dynamic) | textfield | No | — | One field per form component; enter the column letter (e.g., `"A"`, `"B"`, `"C"`) |
| External ID Type | `externalIdType` | string | No | — | Name for the external ID reference stored on the submission |

### How It Works

- **Create**: Appends a new row to the spreadsheet, stores the row ID in `submission.externalIds`
- **Update**: Updates the existing row using the stored external ID
- **Delete**: Removes the row from the spreadsheet
- Handles Google Drive file references by extracting the original URL
- Runs asynchronously (non-blocking)

---

## SQL Connector

**Name:** `sqlconnector` | **Priority:** 0 | **Handler:** `after` | **Method:** `create`, `update`, `delete`

Executes SQL operations against a remote database via Resquel. Only available when the server is not in hosted mode.

### Settings

| Field | Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| Block Request | `block` | boolean | No | false | Wait for SQL response before completing submission |
| Table Name | `table` | string | Yes | — | Target database table |
| Primary Key | `primary` | string | Yes | `"id"` | Must be auto-incrementing |
| Fields | `fields` | datagrid | No | — | Map form component keys to database column names |

### How It Works

- **Create**: INSERTs a new row, stores the remote ID in `submission.externalIds` (type: `sqlconnector`)
- **Update**: UPDATEs the row using the stored primary key
- **Delete**: DELETEs the row using the stored primary key
- **Blocking mode**: Waits for the SQL response; if it fails, soft-deletes the submission
- **Non-blocking mode**: Fires the SQL query asynchronously and continues immediately
- Strips protected fields before sending to the external database
- Supports basic auth if user/password are configured in project SQL settings
