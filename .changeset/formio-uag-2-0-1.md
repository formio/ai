---
'@formio/ai': patch
---

Bring the `formio-uag` skill to UAG 2.0.1, audited against the UAG's source, its developer docs and its demo applications. Where the rc.7 notes in this release differ, these supersede them.

- Versions: UAG 2.0 is released, so every package and image resolves from `latest` (2.x) and is pinned to the exact version; the `rc` fallback is gone. `@formio/uag-extras` and `formio/uag-documents` take the UAG's major (`:2`; `:1` is the 1.0.0 built for the release candidates). `@formio/appserver` 2.26.4 or later. The documentation links point at the UAG repository and the public examples catalog instead of `ai.form.io`.
- AI Document: a new `references/ai-document.md` with the component JSON (its settings in a top-level `uag` object, with `files` and `result` children), the `extract`, `analyze` and `translate` processes and their settings, the target field, the browser events, the result, the process route, and filling a form from a scanned paper form.
- Applications: how `@formio/uag-js` recognises a save (a definition loaded through the SDK from the form's URL, saved through a `Formio` instance for the same URL; a `fetch` save skips every Run task), who the caller is and public forms through self-registration, React and Angular snippets for attaching Agent Input by hand, a draft generated from a form button, and the `/agent/capabilities` keys.
- Workflows: a chained Run task must run after the save; only `uag` reaches inside a container, so `uagAuthoritative` and the decision settings go on each field, never on a required field or one a person confirms; the hosted-service setup without an agent role; showing an after-save run's result; the `agent_identity` error.
- Open Source: this library's MCP tools cannot write to an Open Source server, so the skill writes files and names the routes that need no tool.
- Corrections: the Anthropic MCP connector takes a token, not OAuth; sign-in sessions last at most the Form.io login; the `401` "sign_in_required" message; `UAG.attach()` defaults to `blur` on wizards too; a chat confirmed by typing submits itself; engine settings, Claude model compatibility, the engine server, `AUTHORIZE_HTML`, `PORTAL_SECRET`, the AI Document deploy kit, and troubleshooting entries for rc.11's startup errors.
