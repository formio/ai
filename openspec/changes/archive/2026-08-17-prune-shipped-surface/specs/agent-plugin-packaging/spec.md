## REMOVED Requirements

### Requirement: Hooks remain a Claude-only component

**Reason**: The hook is deleted, so there is nothing left to scope to one manifest.

This requirement's own rationale is what retires it. It reads: "Correctness for clients without hooks is carried by the server's actionable project-resolution error, not by a ported hook." That is now equally true of Claude Code. The `neutralize-skills-for-multi-agent` change deleted every skill reference to the hook — the plugin-mode branch in `DEPLOYMENT.md` that keyed on it is gone, and the enforcement suite added there bans `verify-project-url` from live skill documents — and added `SERVER_INSTRUCTIONS`, which states the project requirement at initialize for every client. So the hook now duplicates guidance the server gives natively, through a channel only one client has.

It is also actively harmful in one case. The gate denies a Form.io tool call whenever the working directory has no entry in `~/.formio/projects.json`, and it reads only `FORMIO_DEFAULT_PROJECT_URL`. A user who pins the server with `FORMIO_PROJECT_URL` in its environment — which takes precedence over the mapping and resolves fine — has calls denied anyway.

**Migration**: Nothing to port. The behaviour is carried by four things already shipped: the server's `instructions`, declared at initialize and naming both URLs; the actionable error raised when no project resolves, which names `project_set`; `formio-mcp-setup`'s project-configuration step; and `formio-application`'s Deployment step, which resolves an existing mapping before asking. Claude Code plugin users lose the `SessionStart` prompt that offered a configured default project URL, and configure the project through those paths instead.
