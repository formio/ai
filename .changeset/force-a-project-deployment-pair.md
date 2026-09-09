---
'@formio/mcp': minor
'@formio/ai': patch
---

Add `project set --force`, for a pair the domain rules cannot tell from a mistake.

A `*.form.io` project is served by `https://api.form.io` and by nothing else, so recording it against another deployment is refused — the failure it prevents is unexplained 404s and a portal login sent to a deployment the user does not have. One deployment shape is indistinguishable from that mistake: an internal, non-SaaS deployment served from a `*.form.io` domain, which QA tests. `project set --force --project-url <url> --base-url <url> --cwd <path>` records that pair as given, and the reader honours it — `project get` reports it as forced instead of refusing it, and every tool resolves it.

Two properties keep it narrow. `--force` requires BOTH halves in the same call, so the override applies to a pair stated in full rather than to one half completed from the record or by derivation. And it belongs to the pair rather than to the directory: a write that leaves both halves untouched keeps it — an agent re-stating the project it already resolved must not undo a developer's override — while a write that moves either half forms a pair nobody vouched for and is judged by the ordinary rules again.

Because an unforced write of the same pair therefore changes nothing, `project set --reset --cwd <path>` is added as the way back: it clears that directory's entry — nothing else — reports what it held and what the directory resolves to afterwards, and takes no URLs, so whatever is recorded next is judged by the ordinary rules. Every report of a forced pair names it, and both writers carry the override in what they report: `project_get` and `project_set` return `forced` and say what it means, so a pair the rules would refuse is never reported bare.

It is a shell-only flag. The `project_set` tool does not take one, and no environment variable and no committed `formio.json` grants it: a check is waived by a developer at a shell, not by an agent or a launch configuration.
