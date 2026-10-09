---
'@formio/mcp': minor
'@formio/ai': minor
---

Keep every request on the project the working directory resolves to, carrying only the credential that project's deployment issued.

- Tool arguments that become part of a request path — `formIdOrPath`, `formId` on the action tools, `actionId`, `actionName`, and `version` on `form_revision_get` and `form_update` — are checked before any request is made. Each `/`-separated segment holds only letters, digits, `-` and `_` (the characters Form.io accepts in a form path), so `user/login` stays valid; anything else is refused with an error naming the argument and the shape it takes, and arguments naming one resource accept a single segment.
- `formioFetch` refuses any request whose URL is not under the Project URL's origin and path, and does not follow redirects: a 3xx response is reported with the location it pointed to.
- **Behaviour change:** `FORMIO_API_KEY` now applies only to the project `FORMIO_PROJECT_URL` names. Any other project a committed `formio.json` or a directory mapping resolves — including a sibling project on the same sub-directory deployment — and every project when `FORMIO_PROJECT_URL` is unset, authenticates through the portal login. `project_get` names the reason in its notes, and a browserless login failure states it instead of asking for a key. Set `FORMIO_PROJECT_URL` beside the key.
- A project URL with no path on a customer domain pairs only with a deployment on the same registrable domain (`https://myproject.mysite.com` with `https://api.mysite.com`), compared against the public suffix list; under a suffix the list does not carry (`localhost`, a private TLD) sibling hosts are compared directly. `project set` and `project_set` refuse an unrelated deployment; one already recorded is set aside with a note, leaving the deployment to be supplied. `project set --force` still records such a pair.
