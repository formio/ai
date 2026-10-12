---
'@formio/ai': patch
---

Route every request to one skill that can finish it, and give the skills one contract between them.

- A new app that names a framework ("build me a CRM in React") goes to `formio-application`, which plans, imports, and hands off to that framework without asking which; `formio-angular` and `formio-react` keep work on an already-planned project or an existing workspace, and hand a request with no plan to `formio-application` themselves.
- Descriptions name only registered skills, and `formio-mcp-setup` no longer sends Form.io login to `formio-auth`: the login opens in the browser on the first tool call.
- `FRAMEWORK.md` holds the one handoff contract. No handoff carries a URL; each receiving skill resolves the project with `project_get`. After scaffolding, `formio-angular` checks the new workspace still resolves its project and records it with `project_set` when a new `.git` has cut it off.
- `formio-auth` runs once, after import.
- Registration built through `formio-form-builder` saves users to the user resource, so they can sign in; a login form drops the Save action `form_create` adds, so login attempts are not stored as submissions.
- Changes to a saved form go through `formio-form-builder`'s edit lane.
- Every path a skill tells the agent to load is relative to that file, so it resolves once installed.
- `formio-angular-resources` asks for no URL and never creates a workspace; `formio-react` stops before offering a router migration to a Next.js or framework-mode app.
- `FRAMEWORK.md`'s contributor checklist moves to `CONTRIBUTING.md`.
