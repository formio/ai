# Reading the planner pair, and what to ask

## Read `template.md` first

It is the architectural-intent seed. Reversing the order — starting from `template.json` — makes you reason about the wrong thing, because the JSON is flat and easy to misread.

| Section | What it decides |
| --- | --- |
| `## Resources` | Which resources are browsable, which are joins, which is the user resource |
| `## Users & Auth` | Whether auth is resource-backed, and whether anything exceeds login + role assignment |
| `## Roles` | The role machine names generated code may reference |
| `## Access Matrix` | Two separate guard decisions per resource — see below |
| `## ER Diagram` | The relationships; trust `## Resources` over the diagram when they disagree, and flag the inconsistency |

Consult `template.json` when the markdown leaves a shape ambiguous: exact `select` field JSON for reference components, `actions`, and `roles`.

If you are handed a `template.json` only, reverse-extract an implicit map, proceed, and say you did.

## The two guard decisions, never collapsed

For each resource the Access Matrix implies:

1. **Authentication** — can an anonymous visitor reach this route at all? Almost always no, so almost every route wraps its loader with `requireUser`.
2. **Authorization** — which authenticated users may see or change which records? **Default: no client-side check.** The deployment enforces this through `submissionAccess`, and a client-side role test is presentation, not a boundary.

Generate a role or group check only when the user explicitly asks. Collapsing the two produces either an app that leaks routes or one that reimplements server access rules in the browser and drifts from them.

## Classifying resources

- **Browsable resource** → its own route subtree.
- **Join resource** (tagged `join`) → never a root subtree; it mounts under each side it joins.
- **The user resource** → usually not browsable as CRUD; it backs login and the current-user binding.

Batch-confirm grey areas in one round rather than asking per resource.

## What to ask, and when not to

In handoff mode most of this is already answered — the map plus `newResourceNames` settles it. Compress hard: confirm in one batch, or skip when unambiguous.

Ask only when the map is genuinely ambiguous:

1. **Child route names on each side of a join.** Default: the pluralized opposite side. User-side mounts of access-granting joins are opt-in.
2. **Which resources are browsable**, when `## Resources` and the diagrams disagree.
3. **Design language**, only on the greenfield branch and only when nothing is established. On the existing branch, read the app and match it.

Never interview for the Project URL or Base URL. `project_get` reports them.
