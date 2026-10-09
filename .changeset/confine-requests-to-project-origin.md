---
'@formio/mcp': patch
---

Keep every request on the project the working directory resolves to, carrying only the credential that project's deployment issued.

- Tool arguments that become part of a request path — `formIdOrPath`, `formId` on the action tools, `actionId`, `actionName`, `version` — are checked before any request is made. A form path keeps its `/` separators (`user/login`); a value carrying a URL scheme, a leading `/`, a backslash, or a `.`, `..` or empty segment is refused with an error naming the argument and the shape it takes, and arguments naming one resource accept a single segment.
- `formioFetch` refuses any request whose URL is not under the Project URL's origin and path.
- `FORMIO_API_KEY` now applies only to the project on `FORMIO_PROJECT_URL`'s origin. A project resolved from a committed `formio.json` or a directory mapping on another origin, or any project when `FORMIO_PROJECT_URL` is unset, authenticates through the portal login, and `project_get` names the reason in its notes. Set `FORMIO_PROJECT_URL` beside the key.
- A project URL with no path on a customer domain pairs only with a deployment on the same registrable domain (`https://myproject.mysite.com` with `https://api.mysite.com`), compared against the public suffix list. `project set` and `project_set` refuse an unrelated deployment; one already recorded is set aside with a note, leaving the deployment to be supplied. `project set --force` still records such a pair.
