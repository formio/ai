# AI Document: content from uploaded files

The **AI Document** component (`uagdocument`) lets the person filling a form drop files and get AI-generated content from them — an exact extraction, a summary, an assessment, a translation — which they review, may edit, and submit. The form designer chooses a **process** (a document plugin) and writes the instructions; converters bring each file to what the engine reads (PDF or text). Files upload to the form's own storage, and the submission holds the file references and the result.

It is a module of `@formio/uag-extras`, not part of the UAG itself: run it as [deployment.md](./deployment.md#ai-document) describes. Processing is Agentic Formflow (a license that includes the UAG, or a project on the hosted service) and needs an agent engine that generates over documents — of the official engines, `claude`.

## Contents

- [The component](#the-component)
- [The processes](#the-processes)
- [The target field](#the-target-field)
- [Filling a form from a scanned paper form](#filling-a-form-from-a-scanned-paper-form)
- [In the application](#in-the-application)
- [The process route](#the-process-route)
- [The result is not checked on save](#the-result-is-not-checked-on-save)

## The component

The component's settings sit in a top-level `uag` object — not in `properties`, where task properties live — and it holds two children it always has: a `file` component keyed `files` and a `hidden` component keyed `result`. Write both, keyed exactly so.

```json
{
  "type": "uagdocument", "key": "contract", "label": "Upload the contract", "input": true, "tree": true, "tableView": false,
  "uag": {
    "plugin": "extract",
    "settings": { "minScore": 0.98, "repair": true, "allow": "" },
    "instructions": "Copy the termination clause and the renewal terms, word for word.",
    "instructionsComponent": "",
    "accept": [],
    "converters": {},
    "engine": "",
    "auto": true,
    "target": ""
  },
  "components": [
    { "type": "file", "key": "files", "label": "Contract", "input": true, "storage": "s3", "dir": "contracts", "multiple": false, "hideLabel": true, "filePattern": ".pdf,.docx", "fileMaxSize": "10MB", "tableView": false },
    { "type": "hidden", "key": "result", "input": true }
  ]
}
```

| `uag` key | Default | Meaning |
| --- | --- | --- |
| `plugin` | (required) | The process: a document plugin's name, `extract`, `analyze`, `translate`, or one of the user's own. |
| `settings` | `{}` | That plugin's settings ([The processes](#the-processes)). |
| `instructions` | `''` | What to produce, written for the model. Use this or `instructionsComponent`, not both. |
| `instructionsComponent` | `''` | The key of a content component of the form whose text is the instructions. |
| `accept` | `[]` (everything the converters can read for this plugin) | MIME types the component accepts; it also limits the file picker. |
| `converters` | `{}` | A MIME type to the converter that must read it, when several could. |
| `engine` | `''` (the UAG's `documents.engine`, else the first agent engine that reads what the files became) | An engine instance name. |
| `auto` | `true` | Process as soon as files are uploaded; `false` waits for the person to press the component's button. |
| `target` | `''` | The key of a textarea or text field of the same form that also receives the result ([The target field](#the-target-field)). |

The `files` child carries the upload settings — `storage` (`s3` or `azure` in production; `base64` keeps the bytes in the submission; Google Drive and Dropbox cannot be read by the UAG), `dir`, `multiple`, `filePattern`, `fileMaxSize`. With `multiple`, all of the component's files give one combined result. Inside a Data Grid each row has its own files and result.

Tag the form `uag`, as for any agent operation; the component itself needs no task. Instructions are part of the form definition, so anyone who can load the form can read them: put no secrets in them, as for criteria ([SKILL.md](../SKILL.md#security)). In the Enterprise portal the same component is built from the palette (**AI Document**, beside **File**) once the project loads the UAG's portal script ([deployment.md](./deployment.md#ai-document)); hand-written JSON like the above goes through `formio-form-builder`'s edit lane like any other component.

## The processes

The document plugins `@formio/uag-extras` brings, and their `uag.settings`:

| `plugin` | Does | Reads | `settings` |
| --- | --- | --- | --- |
| `extract` | Copies the parts of the documents the instructions ask for, in their exact wording, as Markdown, and checks the copy against the documents' text; a copy that differs is retried, then flagged. | A PDF's text layer, or text: a scan without one is returned `flagged`, "cannot be verified: the document has no text layer" | `minScore` (`0.98`: the share of the copy that must be the documents' exact wording), `repair` (`true`: put back exact punctuation and spacing), `allow` (one regular expression per line, for markers the instructions add on purpose) |
| `analyze` | Writes about the documents as the instructions ask: summaries, assessments, comparisons, transcriptions. | PDF (pages as images too) or text | `maxWords` (optional) |
| `translate` | Translates the documents into one language, keeping their structure. | PDF or text | `language` (default `es`) |

All three give Markdown the person may edit. Use `analyze` for scans and photos (the built-in `image-pdf` converter turns a PNG or JPEG into a PDF the engine reads as an image); `extract` is for documents with a text layer, where an exact copy can be checked. The `office-text` converter, in the same add-on, reads Word and Excel files. A plugin of the user's own is trusted code that runs inside the UAG ([SKILL.md](../SKILL.md#security)); its contract is on the UAG's Plugins page.

## The target field

With `target` set, the result is also written into that textarea or text field (in a Data Grid, the field of the same row): HTML for a textarea with a rich-text editor (CKEditor or Quill), Markdown otherwise. When the field already has a value the person is asked first. The submission still holds the result as the process produced it, in the component's `result`, beside what the person submitted in the field. Use a target to keep an application's existing data model: code that reads a rich-text field gets the content there, with no Markdown rendering.

## Filling a form from a scanned paper form

A target field can be a task's input, so a document fills the rest of the form: the AI Document reads the scan into a transcript, and Agent Input extracts the form's fields from it.

```json
[
  { "type": "uagdocument", "key": "scan", "label": "Upload the scanned paper form", "input": true, "tree": true, "tableView": false,
    "uag": { "plugin": "analyze", "settings": {}, "instructions": "Transcribe what the person wrote in every field, one line per field, as \"Section, Label: value\", with the form's printed section names and labels. Copy the handwriting exactly; write (blank) for an empty field and (unclear) for writing you cannot read. Write nothing else.", "instructionsComponent": "", "accept": [], "converters": {}, "engine": "", "auto": true, "target": "transcript" },
    "components": [
      { "type": "file", "key": "files", "label": "Scanned form", "input": true, "storage": "base64", "multiple": false, "hideLabel": true, "filePattern": ".pdf,.png,.jpg,.jpeg", "fileMaxSize": "3MB", "tableView": false },
      { "type": "hidden", "key": "result", "input": true }
    ] },
  { "type": "textarea", "key": "transcript", "label": "What the scan says", "input": true, "rows": 8,
    "description": "Read from the scan. Check it against the paper and correct it if needed: the fields below are filled in from it.",
    "properties": { "uag": "fill", "uagField": "input" } },
  { "type": "panel", "key": "yourDetails", "title": "Your details", "input": false, "properties": { "uag": "fill" },
    "components": [ { "type": "textfield", "key": "fullName", "label": "Full name", "input": true, "validate": { "required": true } } ] }
]
```

Then, in the page, extract once the transcript is in:

```js
const agent = UAG.attach(form, { trigger: 'button' });
form.on('uagDocumentResult', (event) => {
  if (event.path === 'scan' && form.submission.data.transcript) agent.extract();
});
```

The person can correct the transcript before the fields are filled from it, and Agent Input's rules hold: nothing the person entered is overwritten ([uag-js.md](./uag-js.md#rules-agent-input-keeps)). A task input on a file component reads only files with text ([tasks.md](./tasks.md#documents-as-input)); a scan goes through an AI Document like this one instead.

## In the application

The component's browser code comes from the UAG's modules, not from `@formio/uag-js` on npm:

- **Without a bundler**, load `{uagUrl}/uag-js/uag.use.js` and `{uagUrl}/uag-js/uag-js.css`: they carry the component of every module the UAG uses ([uag-js.md](./uag-js.md#loading-it-from-the-uag)).
- **With a bundler**, `npm install @formio/uag-extras@{extrasVersion}` beside `@formio/uag-js`, then register both:

  ```js
  import { Formio } from '@formio/js';
  import { UAG } from '@formio/uag-js';
  import aiDocument from '@formio/uag-extras/modules/ai-document/client';

  Formio.use(UAG(config.uagUrl));
  Formio.use(aiDocument);
  ```

Rendering a form with an AI Document then needs nothing else, except against UAG 2.0.1 and earlier in front of an Enterprise or hosted project: `UAG()` fetches the plugin list from `{uagUrl}/plugins`, which those versions answer only under the project's name, so the list comes back empty and the person cannot edit the result. There, load `{uagUrl}/uag-js/uag.use.js` instead, which carries the list, or upgrade the UAG once a release answers `/plugins` at its root. An application with its own form builder awaits `UAG.ready` before offering the component. The person needs create or update access to the form, as for the Agent API; on a `uagAnonymous` form, visitors who are not signed in may process documents too, under the anonymous limits.

The component emits events on its form, for a page that reacts to processing:

| Event | Payload |
| --- | --- |
| `uagDocumentStart` | `{ component, path, files }` |
| `uagDocumentProgress` | `{ component, path, progress, message? }` (`progress` from 0 to 1) |
| `uagDocumentResult` | `{ component, path, result }` |
| `uagDocumentError` | `{ component, path, error }` |

The stored `result` (the component's value is `{ files, result }`):

```json
{
  "content": "# Termination\n…", "format": "markdown", "status": "ok", "issues": [], "summary": "", "edited": false,
  "meta": { "plugin": "extract@1.0.0", "engine": "claude", "model": "…", "files": [{ "name": "contract.pdf", "route": ["pdf-text@2.0.0"], "pages": 12 }] }
}
```

`status` is `flagged` when the process found problems, listed in `issues` (`{ kind, message, output?, document?, page?, file? }`); the component shows a notice and the issues so the person checks before submitting. `edited` is `true` once the person changed the content.

## The process route

The component calls `POST {form}/document/process`; a backend can call it too, with the caller's credential:

```json
{ "path": "rows[2].contract", "files": [{ "storage": "s3", "key": "uploads/contract.pdf", "name": "contract.pdf", "originalName": "contract.pdf", "size": 482113, "type": "application/pdf" }], "data": {} }
```

`path` is the component's data path with row indices, `files` the value of its `files` child, and `data` the form's data, given to the plugin as context only. The plugin, its settings and the instructions always come from the stored form, never from the request.

- With `Accept: text/event-stream` the answer is `200` and server-sent events: `progress` (`{ "progress": 0.3, "message": "Processing" }`), then exactly one `done` (`{ "result": { … } }`) or `failed` (the error shape of [agent-api.md](./agent-api.md)), with a comment line every `documents.heartbeatMs` (15 seconds). A browser reads it with `fetch` and a stream reader, since `EventSource` cannot POST. With any other `Accept`, the answer is `200 { "result": { … } }` or the error shape.
- Problems found before processing answer with their status: `404` (no AI Document at `path`), `422` (`document_misconfigured`, or a file stored where the UAG cannot read it), `413` (too many files, too many bytes, a file over `maxFileBytes`), `415` (a file type the component does not accept, or that no converter brings to its plugin), `503` (`no_engine`), `403` (`license_required`), `429` (more than `documents.perUser`, 3, at once per caller, or the rate limits under the name `document`). Limits checked after conversion (`maxPages`, `maxTextChars`), the plugin's own failures and `documents.timeoutMs` fail the request afterwards, naming the limit.
- Closing the connection cancels the work, so nothing outlives the request and several UAG instances need no shared state. A proxy in front of the UAG must allow a response as long as `documents.timeoutMs` (10 minutes) and must not buffer `text/event-stream` ([deployment.md](./deployment.md#ai-document)).

## The result is not checked on save

The UAG neither signs AI Document results nor checks them when a submission is saved: a submission's `result` is whatever the client sent, so anyone who can submit the form can submit any `content`, `status`, `issues` or `meta`. The person's review before submitting is the control. A workflow that acts on a result with no person reviewing it — a Run task that reads it, an integration that files it — must not rely on `status`, `issues` or `meta`; re-derive what it needs on the server instead (a Run task whose input is the target field, for one).
