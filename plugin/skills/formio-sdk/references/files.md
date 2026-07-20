## Overview

File upload, download, and delete via the renderer-extended SDK. The renderer (`packages/formio.js/src/Formio.js`) adds three instance methods on top of the core SDK that dispatch to a registered storage provider (S3, Azure, GCS, URL, Base64, etc.). Sourced from `packages/formio.js/src/Formio.js` and `packages/formio.js/src/providers/storage/` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

## URL Configuration

### Hosted

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');
```

### SaaS

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');
```

File uploads are scoped to the form (or submission) the `Formio` instance points at. The form's File component declares which storage provider to use; the SDK reads that and dispatches to `Formio.Providers.providers.storage[<provider>]`.

## API

Instance methods (renderer-only, attached in `formio.js/src/Formio.js`):

- `uploadFile(storage, file, fileName, dir?, progressCallback?, url?, options?, fileKey?, groupPermissions?, groupId?, uploadStartCallback?, abortCallback?, multipartOptions?): Promise<File>` — dispatch to the storage provider, return the `{ storage, name, originalName, url, size, type, ... }` metadata that the SDK persists on the submission.
- `downloadFile(file, options?): Promise<{ url }>` — produce a temporary signed download URL for a previously uploaded file.
- `deleteFile(file, options?): Promise<void>` — remove the file from the configured storage backend.

Static helpers:

- `Formio.Providers.providers.storage` — provider registry (keyed by provider name → factory function).
- `Formio.Providers.addProvider('storage', name, providerFn)` — register a new storage provider. This is the supported way to extend the registry; do not mutate `providers.storage` directly.

Provider metadata on the submission: every uploaded file is stored as a JSON descriptor — `{ storage: 's3', name, originalName, url, size, type, hash?, key? }`. The `storage` field determines which provider handles subsequent `downloadFile` / `deleteFile` calls.

## Examples

### Upload a file to S3 against a form's File component

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

const formio = new Formio(`${Formio.getProjectUrl()}/intake`);
const input = document.querySelector<HTMLInputElement>('#file-input');
const file = input.files?.[0];
if (!file) throw new Error('no file selected');

const descriptor = await formio.uploadFile('s3', file, `intake/${file.name}`, '', (event) =>
  console.log('progress', event.loaded, '/', event.total)
);
console.log('uploaded:', descriptor.url);
```

### Download a file by descriptor

```ts
import { Formio } from '@formio/js';

const formio = new Formio(`${Formio.getProjectUrl()}/intake/submission/000000000000000000000010`);
const submission = await formio.loadSubmission();
const fileDescriptor = submission.data.attachment?.[0];
if (fileDescriptor) {
  const { url } = await formio.downloadFile(fileDescriptor);
  window.open(url);
}
```

### Delete a previously uploaded file

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

await new Formio(`${Formio.getProjectUrl()}/intake`).deleteFile(fileDescriptor);
```

### Register a custom storage provider

```ts
import { Formio } from '@formio/js';

Formio.Providers.addProvider('storage', 'customCdn', (formio) => ({
  uploadFile(file, name, dir, progress) {
    // POST to your CDN endpoint and return the descriptor.
    return fetch('/api/upload', { method: 'POST', body: file })
      .then((r) => r.json())
      .then((res) => ({
        storage: 'customCdn',
        name: res.key,
        originalName: file.name,
        url: res.url,
        size: file.size,
        type: file.type,
      }));
  },
  downloadFile(fileInfo) {
    return Promise.resolve({ url: fileInfo.url });
  },
  deleteFile(fileInfo) {
    return fetch(`/api/upload/${fileInfo.name}`, { method: 'DELETE' }).then(() => undefined);
  },
}));
```

## MCP Tool Preference

The MCP server does not expose a first-party file tool today. Use the SDK directly, or call the storage backend's HTTP API directly when the SDK's provider abstraction is too restrictive.
