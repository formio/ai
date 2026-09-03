# Phase A — the Scaffolding Plan

Emit the plan as a single fenced markdown block. Terse: one line per file, one row per route. It is the artifact the user reviews before a byte is written.

## Template

```markdown
## Scaffolding Plan — <app or feature name>

**Workspace:** <absolute path>   **Branch:** greenfield | existing
**Project URL:** <from project_get>   **Base URL:** <from project_get>

frontend-design consulted: <yes — brief applied; which recommendations shaped the sketches>
                           <or: waived by the user, who chose to proceed without it>

### Resources

| Resource | routePath | param | form (template.json path) | Parent bindings | Guard |
| --- | --- | --- | --- | --- | --- |
| Customer | customer | customerId | customer | — | auth |
| Quote | quote | quoteId | quote | customer (filter + prefill) | auth |

### Route tree

/customer
/customer/:customerId            → item shell
/customer/:customerId/quote
/customer/:customerId/quote/new
/customer/:customerId/quote/:quoteId

### Files

src/formio/…                     kernel (new | already present)
src/resources/customer/config.ts
src/resources/customer/screens.tsx
…

### Screen sketches

Customer item — <what the view screen shows, drawn from the resource's own fields>
Quote list    — <columns, empty state, create affordance>

### Integration points (existing branch only)

- Router: <where the resource routes attach>
- Auth: <the app's existing mechanism the generated code uses>
- Design: <the app's established language the screens match>
```

## Rules the plan must satisfy

**Every resource row names both `routePath` and `param`, and `form` verbatim.** `form` is the form's `path` in `template.json`, copied exactly — never derived from the resource's display name. `param` is distinct across the whole tree and derived from the resource (`customerId`, never a bare `id`), because nested routes with colliding params cannot address their ancestors.

**Every child row names what filters its list and what is pre-filled on create.** A child whose bindings are unstated is a child whose list may render unfiltered.

**The route tree is shown in full, at whatever depth the hierarchy reaches.** A two-level example does not stand in for a three-level tree.

## `frontend-design consulted:` — required, no exceptions

The plan MUST carry the line. Two acceptable forms:

- `frontend-design consulted: yes — Bootstrap 5 brief applied; card-per-resource layout and the status-pill treatment came from it`
- `frontend-design consulted: waived — the user chose to proceed without it; screens follow the Bootstrap 5 brief inline and each generated UI file is flagged for review`

Do not emit Phase B until a real consultation has happened, or the user has knowingly waived it. A plan without the line is not a finished plan.

## The gate

After the plan, stop. Ask one question, one round:

> "Does this scaffolding plan look right? I can generate the files once you approve, or revise the plan based on your feedback."

Offer **Approve & generate files** and **Revise the plan**. If the user asks for revisions, incorporate, re-emit, re-ask — iterate until approved.
