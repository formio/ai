---
'@formio/ai': patch
---

Update the `formio-uag` skill for UAG 2.0.0-rc.7.

- Modules and plugins: how to mount a module or a plugins file, the module keys (settings, routes on every form, components, initialize and close), the module API, and `GET {project}/plugins` to check what a UAG loaded.
- Documents: a file component as a task's input, `read_document`, uploaded files described rather than inlined, rich text fields, and the AI Document component.
- `@formio/uag-js` loaded from the UAG (`/uag-js/uag.use.js`), its `manifest` option and the `client` API.
- Deployment: `AGENT_BODY_LIMIT` (the Agent API body limit is no longer a fixed 5 MB), `UAG_PLUGINS`, `MODULES_DISABLED`, `DOCUMENTS_MAX_FILE_BYTES`, `DOCUMENTS_MAX_IMAGE_PIXELS`, `CLAUDE_MAX_TOKENS`, proxy paths and timeouts, and a mounted module can `require('@formio/uag')`.
- Versions: `@formio/appserver-core` 2.26.0 or later; the UAG's packages are released at one version, `@formio/uag-extras` on its own.
