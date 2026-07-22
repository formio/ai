# Project Definition Reference

Top-level shape of a Form.io project — the JSON object the platform creates when a user provisions a new project, stage, or tenant and the object the platform-projects endpoint returns. Load this file when interpreting a project payload returned by `/project/{projectId}`, when constructing one to `POST` / `PUT`, or when importing/exporting a project template envelope.

A project is the top-level container for forms, resources, roles, submissions, and actions. Every form belongs to exactly one project. Stages and tenants are themselves project documents — see `project-type-and-framework.md` for the discriminator details.

## Project object

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `_id` | `string` | **Yes** | MongoDB ObjectId assigned by the server. |
| `title` | `string` (≤63 chars) | **Yes** | Human-readable project title. Indexed. |
| `name` | `string` (≤63 chars) | **Yes** | Machine name / subdomain segment. Must match `^[0-9a-zA-Z-]+$` (letters, digits, hyphens), cannot start or end with `-`, cannot be a reserved subdomain. Must be unique. |
| `type` | `'project' \| 'stage' \| 'tenant'` | No | Project kind. See `project-type-and-framework.md` for the discriminator and the Stage/Tenant creation patterns. Default `'project'`. |
| `description` | `string` (≤512 chars) | No | Free-text description of the project. |
| `tag` | `string` (≤32 chars) | No | Last-deployed tag of the project. Default `"0.0.0"`. |
| `owner` | `string` (submission ID) | No | User-submission ID of the project owner. Server stores as ObjectId; API returns as string. |
| `externalOwner` | `{ sub, iss, customIdClaim? }` | No | OIDC SSO external owner — `sub` (subject) and `iss` (issuer) of the external identity, with optional `customIdClaim: { key, value }` for the `idPath` resolution. Server-only — not in the upstream TypeScript declaration. |
| `project` | `string` (project ObjectId) | No | Parent project ID. Set on Stages to reference the parent (typically portal) project. Indexed. |
| `remote` | `object` | No | Remote project definition for stage-to-remote-environment connections. Server stores only `{ url, project: { _id, name, title } }`. |
| `plan` | `string` | No | Project plan. **For deployed projects this is always `'commercial'`.** SaaS tier values exist but are not covered by this skill — see your Form.io plan dashboard for SaaS billing. |
| `billing` | `object` | No | Server-managed billing data. See your Form.io plan dashboard, not documented as schema. |
| `apiCalls` | `object` | No | Server-managed API-call counter snapshot (limit / used / reset). See your Form.io plan dashboard, not documented as schema. |
| `steps` | `string[]` | No | Ordered list of onboarding / setup step identifiers the project has completed. |
| `framework` | `string` | No | Target client framework. Default `'angular'`. See `project-type-and-framework.md` for the enumeration. |
| `primary` | `boolean` | No | `true` if this project is the primary (portal) project of the deployment. Default `false`. |
| `access` | `Access[]` | No | Project-level access-control entries — who can see / modify the project itself. See `project-access.md` for the entry shape and how it layers with form-level / submission-level access. |
| `trial` | `Date \| string` | No | Start date of the trial period. Server-managed; `__readonly` on the server. See your Form.io plan dashboard, not documented as schema. |
| `lastDeploy` | `Date \| string` | No | Timestamp of the last deploy. Server-managed; `__readonly`. See your Form.io plan dashboard, not documented as schema. |
| `stageTitle` | `string` (≤63 chars) | No | Display title for a Stage project (e.g., "Dev", "Staging"). Used by Stages only. |
| `machineName` | `string` | No | Globally unique machine-readable name. Derived from `name` by the server's machine-name plugin. |
| `config` | `Record<string, string>` | No | Public configuration key-value pairs. Surfaced to forms when `settings.allowConfigToForms` is set. See `project-settings.md`. |
| `protect` | `boolean` | No | `true` to prevent destructive operations on the project. Default `false`. |
| `settings` | `ProjectSettings` | No | All project-level settings (API keys, CORS, integrations, authorization, custom JS/CSS, etc.). See `project-settings.md`. **Encrypted at rest.** |
| `builderConfig` | `object` | No | Form-builder UI configuration for the project. |
| `formDefaults` | `{ revisions?: 'current' \| 'original' }` | No | Default behavior applied to forms created in this project — currently just the default revision mode. |
| `public` | `{ custom?: { css?, js? }, formModule? }` | No | Public-facing custom CSS / JS / form-module bundle exposed to unauthenticated form renderers. |
| `created` | `Date \| string` | No | Server-assigned creation timestamp. |
| `modified` | `Date \| string` | No | Server-assigned timestamp of the most recent update. |
| `deleted` | `Date \| string \| number \| null` | No | Soft-delete timestamp. Non-null indicates the project has been deleted but is still recoverable; `null` indicates active. (Server stores as `Number`; upstream TypeScript declares as `Date \| string`.) |

## Worked example

```json
{
  "_id": "5f8d0c4e9b1e8a0017a10000",
  "title": "Acme Portal",
  "name": "acme-portal",
  "type": "project",
  "tag": "1.4.2",
  "owner": "5f8d0c4e9b1e8a0017a1aaaa",
  "plan": "commercial",
  "framework": "angular",
  "primary": true,
  "access": [
    { "type": "create_all", "roles": ["5f8d0c4e9b1e8a0017a10001"] },
    { "type": "read_all", "roles": ["5f8d0c4e9b1e8a0017a10002"] }
  ],
  "settings": {
    "appOrigin": "https://acme.example.com",
    "cors": "*"
  },
  "config": { "supportEmail": "support@acme.example.com" },
  "formDefaults": { "revisions": "current" },
  "machineName": "acme-portal",
  "created": "2026-04-01T12:00:00.000Z",
  "modified": "2026-05-26T18:04:11.000Z"
}
```

## Related references

- `project-type-and-framework.md` — `type` and `framework` discriminators plus the Stage/Tenant creation patterns.
- `project-settings.md` — every `ProjectSettings` key and the encryption-at-rest contract.
- `project-access.md` — project-level `access` array, `ProjectRole`, `ProjectFormAccess`, `ProjectAccessInfo`.
