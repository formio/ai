## Overview

The Server API exposes a small set of unauthenticated, platform-wide endpoints intended for monitoring, liveness probes, and lightweight diagnostics. They return enough information to verify that the Form.io deployment is up and to identify its software/schema version — but nothing project- or tenant-specific. Use them from uptime monitors, CI smoke tests, or troubleshooting flows where attaching a JWT is inconvenient or impossible.

## Root URL

All endpoints below are rooted at `{baseUrl}` — the platform deployment endpoint, equivalent to bare `{{baseUrl}}/` in Postman.

## Authentication

The Server API endpoints (`health`, `status`) are unauthenticated. They do not accept or validate an `x-jwt-token` header — including one has no effect. All other endpoints in this library require a portal-login JWT; these do not. Do not rely on these endpoints for any access-controlled information; they exist solely for operational visibility.

## MCP Tool Preference

No MCP tool covers this operation — use the HTTP endpoint directly.

## Endpoints

### GET {baseUrl}/health

Liveness probe. Returns a plain-text `OK` body with HTTP `200` when the platform process is running and able to serve requests. Does not verify database connectivity — use `/status` for a deeper check.

Response: `text/plain`

```
OK
```

Errors: a non-`200` response (or no response) indicates the platform is down or unreachable. There are no structured error payloads.

Example:

```bash
curl -i "{baseUrl}/health"
```

### GET {baseUrl}/status

Version and schema diagnostics. Returns the deployed platform version, the database schema version currently in use, and the environment identifier — handy for confirming an upgrade landed or for pinning client behavior to a known server build.

Response (JSON):

```json
{
  "version": "9.7.1",
  "schema": "3.3.21",
  "environmentId": "64d7b40e81d6ad28758b767e"
}
```

| Field           | Type   | Description                                                   |
| --------------- | ------ | ------------------------------------------------------------- |
| `version`       | string | Semantic version of the Form.io platform binary.              |
| `schema`        | string | Semantic version of the database schema the platform expects. |
| `environmentId` | string | Opaque MongoDB ID identifying the deployment environment.     |

Errors: a non-`200` response indicates the platform is not fully initialized (for example, during a schema migration). There are no structured error payloads.

Example:

```bash
curl "{baseUrl}/status"
```

## Related Skills

- [project-forms](./project-forms.md) — authenticated form management at the project scope
- [pdf-api](./pdf-api.md) — PDF upload, listing, and download operations via the project's PDF proxy
- [runtime-submissions](./runtime-submissions.md) — authenticated submission CRUD at the project scope
