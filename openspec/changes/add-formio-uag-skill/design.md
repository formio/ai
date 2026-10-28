## Context

The source of truth is the UAG 2.0 repository (`formio/uag`, branch `uag-2.0`): `demo/content/developers/*.md`, `README.md`, `MIGRATING-2.0.md` and `packages/uag-js`. The skill restates what an application team needs and points at `https://ai.onform.io/developers` for the Engine SDK, the engine server and the Node.js API in full.

## Decisions

- **One skill, four surfaces.** The UAG's surfaces share forms, tasks, credentials and deployment, and most requests combine two (Agent Input in the browser plus a Run task that re-decides on the server). One router skill with references per surface keeps the shared rules in one place.
- **The UAG URL is a third value.** The Form.io MCP tools target the Form.io project; the UAG URL is supplied by the user and held in the application's own configuration. Recording it with `project_set` would point every later tool call at the UAG.
- **Route form writes.** Form JSON changes go through `formio-form-builder`'s edit lane, as `formio-form` and `formio-schema` already do, so the library keeps one approval gate for saved forms.
- **`agentRunTask` is not added with `action_create`.** That tool reads `form/{formId}/actions` from Form.io, which does not list the UAG's action, and refuses unknown names. The documented routes are a template imported with `project_import` (first builds only, since it replaces each named form's actions), a portal stage connected to the UAG, a UAG module template (installs actions the project lacks at boot; the UAG posts templates to Form.io's `/import`), and Form.io's action API run by the user.
- **Probing a live UAG is the user's.** The build-time ban on hand-rolled HTTP extends to the UAG: verification commands are handed to the user.
- **`formio-actions`' description** gains one `Not for:` entry (1004 characters, within budget); `formio-form`'s is at 1018 and is unchanged, its handoff is in the body.

- **Descriptions are cut, not their routing.** Each keeps its capability sentence, every trigger phrase a test or spec pins, and every `Not for:` handoff a past routing failure added; inventories and meta-prose ("Claims ONLY…", "Invoked as the handoff from…") go to the body. Reaching 8,000 characters would mean dropping pinned triggers, so the cap sits at 9,600: the library cannot fit the listing alone anyway, since every installed skill shares it.

## Routing eval

| Run | Descriptions | Pass rate |
| --- | --- | --- |
| Base | `origin/main` | 33/33 |
| Change | this change, before shortening | 41/41 (33 existing + 8 new) |
| Shortened (3 graders: 2 Sonnet, 1 Opus) | every description shortened | 41/41, 41/41, 41/41 |

No prompt that passed on the base fails on the change.
