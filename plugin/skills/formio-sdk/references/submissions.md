## Overview

Submission CRUD, querying, patching, action discovery, and PDF download URLs via `new Formio(formUrl)` and `new Formio(submissionUrl)`. Sourced from `packages/core/src/sdk/Formio.ts` in the Form.io source code.

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

A submission URL is `${formUrl}/submission/<submissionId>`. List endpoint is `${formUrl}/submission`.

## API

Instance methods (on a Formio whose URL is form-scoped or submission-scoped):

- `loadSubmission(query?, opts?): Promise<Submission>` — `GET ${submissionUrl}`.
- `saveSubmission(data?, opts?): Promise<Submission>` — `POST ${formUrl}/submission` to create, `PUT ${submissionUrl}` to update (depending on whether `submissionId` is in the URL).
- `deleteSubmission(opts?): Promise<void>` — `DELETE ${submissionUrl}`.
- `loadSubmissions(query?, opts?): Promise<Submission[]>` — `GET ${formUrl}/submission?<query>`. Mongo-style filters: `data.email=alice@example.com`, `created__gt=2024-01-01`, `sort=-created`, `limit`, `skip`.
- `availableActions(): Promise<ActionInfo[]>` — `GET ${formUrl}/actions`.
- `actionInfo(name): Promise<ActionInfo>` — `GET ${formUrl}/actions/<name>` — return the action type's settings schema.
- `userPermissions(user?, form?, submission?): Promise<{ create, read, edit, delete }>` — compute the current user's access flags for a submission. Loads the form / current user if not passed.
- `canSubmit(): Promise<boolean>` — convenience for "the current user can create a new submission on this form".
- `getDownloadUrl(form?): Promise<string>` — return a temp-token-wrapped PDF download URL for the current submission.
- `getTempToken(expire, allowed, options?): Promise<string>` — mint a short-lived token scoped to specific endpoint patterns (used for downloads or unauthenticated reads).

Static helpers:

- `Formio.clearCache(): void` — drop the request cache before re-reading submissions.

## Examples

### Create a submission

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

const created = await new Formio(`${Formio.getProjectUrl()}/intake/submission`).saveSubmission({
  data: { firstName: 'Alice', email: 'alice@example.com' },
});
console.log(created._id);
```

### Load and update a submission

```ts
import { Formio } from '@formio/js';

const formio = new Formio(`${Formio.getProjectUrl()}/intake/submission/000000000000000000000010`);
const submission = await formio.loadSubmission();
submission.data.firstName = 'Allison';
await formio.saveSubmission(submission);
```

### Query submissions with filters

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

const recent = await new Formio(`${Formio.getProjectUrl()}/intake/submission`).loadSubmissions({
  params: {
    'data.email': 'alice@example.com',
    sort: '-created',
    limit: 25,
  },
});
```

### Delete a submission

```ts
import { Formio } from '@formio/js';

await new Formio(
  `${Formio.getProjectUrl()}/intake/submission/000000000000000000000010`
).deleteSubmission();
```

### Generate a PDF download URL

```ts
import { Formio } from '@formio/js';

const formio = new Formio(`${Formio.getProjectUrl()}/intake/submission/000000000000000000000010`);
const url = await formio.getDownloadUrl();
window.open(url);
```

### List available actions for a form

```ts
import { Formio } from '@formio/js';

const actions = await new Formio(`${Formio.getProjectUrl()}/intake`).availableActions();
actions.forEach((a) => console.log(a.name, a.title));
```

## MCP Tool Preference

The MCP server in this workspace does not expose first-party submission CRUD tools today. Use the SDK directly for submission operations, or call the corresponding REST endpoints via the `formio-api` skill's `runtime-submissions.md` reference.
