## Overview

The Reports API lets a runtime caller run a MongoDB-style aggregation pipeline against the project's submissions collection and receive the shaped output. It is the right tool for cross-form joins (via `$lookup`), group-by counts (`$group`), and projections (`$project`) that would be awkward to express with simple `data.*` query filters on `GET /:formPath/submission`.

The server enforces the caller's access controls before returning pipeline results, so stages can only observe submissions the caller is allowed to read.

## Root URL

All endpoints below are rooted at `{projectUrl}` — the project endpoint, equivalent to `{{baseUrl}}/{{projectName}}` in Postman.

## Authentication

Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.

## MCP Tool Preference

No MCP tool covers these operations, and none should: they are **runtime** endpoints. The MCP tools exist for **build-time** work — creating and updating forms, actions, roles, and project settings while the application is being built. The endpoints below are called by the finished application, on behalf of the person using it, with that person's own token.

So this document is a specification for the code you write — the dashboards and aggregations the application runs at runtime — not a set of calls to make now. Do not run reports over live submission data yourself to see what the numbers look like: that data belongs to the application's end users and is no part of configuring a project.

## Endpoints

### POST {projectUrl}/report

Execute an aggregation pipeline and receive the shaped array of results.

Request body (JSON): an array of MongoDB aggregation stages. The collection is implicitly the project's `submissions` collection, so the first stage typically narrows by `form` ID via `$match`. `$lookup` stages reference `"from": "submissions"` to join across forms.

```json
[
  {
    "$match": {
      "form": { "$in": ["${companyResourceId}"] }
    }
  },
  {
    "$lookup": {
      "from": "submissions",
      "localField": "_id",
      "foreignField": "data.company._id",
      "as": "joins"
    }
  },
  {
    "$lookup": {
      "from": "submissions",
      "localField": "joins.data.employee._id",
      "foreignField": "_id",
      "as": "employees"
    }
  },
  {
    "$project": {
      "_id": 0,
      "name": "$data.name",
      "employees": "$employees.data.email"
    }
  }
]
```

Response: JSON array of documents shaped by the pipeline's final stage. In the example above, one row per company with its assigned employee emails:

```json
[
  { "name": "Donnelly, Mraz and Connelly", "employees": ["zack69@hotmail.com"] },
  { "name": "Gorczany, O'Reilly and Schmitt", "employees": ["sigrid29@hotmail.com"] }
]
```

Errors: `400` if the pipeline contains unsupported or malformed stages; `401` if the JWT is missing/expired; `403` if the caller lacks access to any form referenced by the pipeline. Note that access filtering is applied before the pipeline runs, so some rows may be silently excluded rather than trigger a `403`.

Example:

```bash
curl -X POST -H "x-jwt-token: $FORMIO_JWT" -H "Content-Type: application/json" \
  -d @pipeline.json \
  "{projectUrl}/report"
```

## Related Skills

- [runtime-submissions](./runtime-submissions.md) — simpler single-form submission queries when an aggregation is overkill
- [runtime-access-control](./runtime-access-control.md) — how owner/role filtering shapes what the pipeline can observe
- [project-forms](./project-forms.md) — form IDs referenced by `$match` stages
