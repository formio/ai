# Project Type & Framework Reference

Two discriminators sit on the `Project` envelope: `type` distinguishes a regular project from a stage or tenant, and `framework` declares which client framework the project targets. The third discriminator (`plan`) is intentionally not documented in depth — for deployed projects it is always `'commercial'`, and the SaaS tier values are out of scope for this skill.

## ProjectType

| Value       | Meaning                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `'project'` | A regular standalone project. Default value. Used for any project that isn't a derived environment.                                                                     |
| `'stage'`   | A Stage of a parent project — a deployment environment (Dev / Staging / etc.) that branches from the parent project. Requires `project` to be set to the parent project's ObjectId. |
| `'tenant'`  | A tenant of the deployment — a multi-tenant child project that inherits its parent's plan at runtime. Tenants are server-keyed differently from stages.                  |

### Stage creation pattern

A Stage is a project document with `type: 'stage'` and a `project` field pointing at its parent. `project` refers to the parent project the stage was created in.

```json
{
  "type": "stage",
  "project": "<parent project ObjectId>",
  "title": "Staging",
  "name": "acme-portal-staging",
  "stageTitle": "Staging"
}
```

Required minimum for a Stage:

- `type: 'stage'`
- `project: <parent project ObjectId>` — the `_id` of the parent project
- `title` and `name` (inherited from the standard Project envelope)

`stageTitle` is the human-readable label shown in the Stage selector UI.

### Tenant creation pattern

A Tenant is a project document with `type: 'tenant'`. Tenants do not require a `project` parent reference because the multi-tenant model is keyed differently from stages — the server walks tenants on `findOne` to inherit the parent's `plan` automatically.

```json
{
  "type": "tenant",
  "title": "Acme Customer A",
  "name": "acme-tenant-a"
}
```

Required minimum for a Tenant:

- `type: 'tenant'`
- `title` and `name` (inherited from the standard Project envelope)

A tenant inherits the `plan` of its parent project at read time — the server's `findOne` hook on the project model replaces the tenant's `plan` with the parent's `plan` whenever a tenant document is fetched. This is invisible to the consumer; just be aware that the `plan` value returned for a tenant reflects its parent's billing tier, not anything you set on the tenant itself.

## ProjectFramework

Declares the target client framework for the project — used by the portal UI to pick the right SDK / starter template suggestions.

| Value         | Meaning                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `'angular'`   | Modern Angular (the default).                                                                          |
| `'angular2'`  | Angular 2.x — historical alias retained for backward compatibility with older project documents.       |
| `'react'`     | React.                                                                                                 |
| `'vue'`       | Vue.                                                                                                   |
| `'html5'`     | Plain HTML5 / vanilla JS.                                                                              |
| `'simple'`    | "Simple" template — minimal UI, suitable for embedded or non-SPA use cases.                            |
| `'custom'`    | Custom integration — the framework is unspecified or out-of-band.                                      |
| `'aurelia'`   | Aurelia.                                                                                               |
| `'javascript'`| Generic JavaScript SDK without a specific framework wrapper.                                           |

The server's Mongoose schema enforces this enum and defaults to `'angular'`.

## See also

- `project-definition.md` — full Project envelope.
- `project-settings.md` — project-level settings.
- `project-access.md` — project-level access control.
