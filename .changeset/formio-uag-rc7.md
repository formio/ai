---
'@formio/ai': patch
---

Update the `formio-uag` skill for UAG 2.0.0-rc.7 and the add-on folders of rc.8.

- Modules and plugins: how to mount a module, a plugins file or folder, and add-ons (each in a folder of its own under `/app/plugins`, merged at startup; `formio/uag` 2.0.0-rc.8 or later), the module keys (settings, routes on every form, components, initialize and close), the module API, and `GET {project}/plugins` to check what a UAG loaded.
- Documents: a file component as a task's input, `read_document`, uploaded files described rather than inlined, rich text fields, and the AI Document component, deployed as the add-on image `formio/uag-documents` beside `formio/uag`, its volume mounted at `/app/plugins/documents` (tagged with the `@formio/uag-extras` version, `:1` for the major).
- `@formio/uag-js` loaded from the UAG (`/uag-js/uag.use.js`), its `manifest` option and the `client` API.
- Deployment: `AGENT_BODY_LIMIT` (the Agent API body limit is no longer a fixed 5 MB), `UAG_PLUGINS` (a file, a folder, or `off`), `MODULES_DISABLED`, `PLUGINS_DISABLED`, `DOCUMENTS_MAX_FILE_BYTES`, `DOCUMENTS_MAX_IMAGE_PIXELS`, `CLAUDE_MAX_TOKENS`, proxy paths and timeouts, and a mounted module can `require('@formio/uag')`.
- Versions: `@formio/appserver-core` 2.26.0 or later; the UAG's packages are released at one version, `@formio/uag-extras` on its own.
