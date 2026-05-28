# Form Definition Reference

Top-level form properties, settings, and access control. Load this file when working with form metadata — creating/updating a form, configuring display mode, setting permissions, or interpreting the envelope around `components`.

## Form object

The top-level object representing a form or resource. Only `components` is required.

| Property              | Type                     | Required | Description                                                                                     |
| --------------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `_id`                 | `string`                 | No       | MongoDB ObjectId. Assigned by the server.                                                       |
| `_vid`                | `number`                 | No       | Version ID for form revisions.                                                                  |
| `title`               | `string`                 | No       | Human-readable form title (e.g., "User Registration").                                          |
| `name`                | `string`                 | No       | Machine name used for API references (e.g., "userRegister").                                    |
| `path`                | `string`                 | No       | URL path segment for the form (e.g., "user/register").                                          |
| `type`                | `FormType`               | No       | Either `"form"` or `"resource"`. Resources are reusable data models; forms collect submissions. |
| `display`             | `FormDisplay`            | No       | Rendering mode: `"form"` (single page), `"wizard"` (multi-step), or `"pdf"`.                    |
| `action`              | `string`                 | No       | URL to submit the form to. Defaults to the Form.io API.                                         |
| `tags`                | `string[]`               | No       | Arbitrary tags for categorization and filtering.                                                |
| `access`              | `Access[]`               | No       | Form-level access permissions (who can read/write the form definition).                         |
| `submissionAccess`    | `Access[]`               | No       | Submission-level access permissions (who can create/read/update/delete submissions).            |
| `fieldMatchAccess`    | `object`                 | No       | Field-level access control rules.                                                               |
| `owner`               | `string`                 | No       | Submission ID of the form owner.                                                                |
| `externalOwner`  | `{ sub, iss, customIdClaim? }` | No    | OIDC SSO external owner — `sub` (subject) and `iss` (issuer) of the external identity, with optional `customIdClaim: { key, value }` for the `idPath` resolution. Server-only — not in the upstream TypeScript declaration. |
| `machineName`         | `string`                 | No       | Globally unique machine name across projects.                                                   |
| `components`          | `Component[]`            | **Yes**  | Array of form components defining the form's fields and layout.                                 |
| `settings`            | `FormSettings`           | No       | Form-level display and behavior settings.                                                       |
| `properties`          | `Record<string, string>` | No       | Custom key-value properties attached to the form.                                               |
| `project`             | `string`                 | No       | Project ID this form belongs to.                                                                |
| `revisions`           | `string`                 | No       | Revision mode: `"current"`, `"original"`, or `""`.                                              |
| `submissionRevisions` | `string`                 | No       | Whether submission revisions are enabled: `"true"` or `""`.                                     |
| `controller`          | `string`                 | No       | Custom controller logic (server-side JavaScript).                                               |
| `builder`             | `boolean`                | No       | Whether to show this form in the form builder.                                                  |
| `page`                | `number`                 | No       | Current wizard page index.                                                                      |
| `created`             | `string`                 | No       | ISO date when the form was created.                                                             |
| `modified`            | `string`                 | No       | ISO date when the form was last modified.                                                       |
| `deleted`             | `string`                 | No       | ISO date when the form was soft-deleted (null if active).                                       |

## FormType

- `"form"` — A standard form that collects submissions.
- `"resource"` — A reusable data model (like a database table) that other forms can reference via `select` components with `dataSrc: "resource"`.

## FormDisplay

- `"form"` — Renders all components on a single page.
- `"wizard"` — Multi-step form with navigation between pages. Each top-level `panel` component becomes a step.
- `"pdf"` — PDF-based form rendering.

## FormSettings

| Property                 | Type      | Description                                               |
| ------------------------ | --------- | --------------------------------------------------------- |
| `collection`             | `string`  | Custom MongoDB collection name for submissions.           |
| `condensedMode`          | `boolean` | Render in condensed/compact mode.                         |
| `disableAutocomplete`    | `boolean` | Disable browser autocomplete on all fields.               |
| `fontSize`               | `number`  | Base font size for PDF rendering.                         |
| `hideTitle`              | `boolean` | Hide the form title when rendered.                        |
| `layout`                 | `string`  | Layout template name.                                     |
| `margins`                | `string`  | Page margins for PDF rendering.                           |
| `showCheckboxBackground` | `boolean` | Show background color on checkbox components.             |
| `theme`                  | `string`  | CSS theme name to apply.                                  |
| `viewAsHtml`             | `boolean` | Render submissions as static HTML instead of form fields. |
| `viewer`                 | `string`  | Viewer type for rendering.                                |
| `wizardHeaderType`       | `string`  | Wizard header style (e.g., breadcrumb).                   |
| `pdf`                    | `object`  | PDF source configuration: `{ src: string, id: string }`.  |

## Access

Each entry in `access` or `submissionAccess` is one role-to-permission mapping.

| Property | Type       | Description                                                                                                                                                                         |
| -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`   | `string`   | Access type: `"read_all"`, `"create_own"`, `"create_all"`, `"update_own"`, `"update_all"`, `"delete_own"`, `"delete_all"`, `"self"`, `"team_read"`, `"team_write"`, `"team_admin"`. |
| `roles`  | `string[]` | Array of role IDs that have this access type.                                                                                                                                       |

Form-level `access` governs who can see/modify the form definition itself. Submission-level `submissionAccess` governs who can create, read, update, or delete submissions against the form.
