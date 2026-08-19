## Overview

Form CRUD via the SDK. A `new Formio(formUrl)` instance is the access point: it parses the URL into `projectId`, `formId`, etc., and exposes `loadForm`, `saveForm`, `deleteForm`, plus `loadForms` for lists. Sourced from `packages/core/src/sdk/Formio.ts` in the Form.io source code.

## Imports

```ts
import { Formio } from '@formio/js';
```

## URL Configuration

**Where these two values come from.** The hosts below are illustrations. When you write these calls into a real application, take both URLs from the MCP server rather than typing them — run `npx -y @formio/mcp@0.10.0 project get --cwd "$(pwd)"` and use exactly what it prints: its `Project URL` for `setProjectUrl`, its `Base URL` for `setBaseUrl`. Do not hardcode an example host, do not derive either URL from the other, and do not carry a value over from another project or an earlier session — the mapping the server reports is what every build-time Form.io tool call resolves, so a different value here ships an application pointed at a deployment the tooling is not managing. If the command reports a value missing, relay its instruction, persist the answer with the `project set` command it names, and re-run it.

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

A form URL is either `${projectUrl}/<formAlias>` or `${projectUrl}/form/<formId>`. The SDK accepts both and resolves `formId` lazily.

## API

Constructor:

```ts
const formio = new Formio(`${Formio.getProjectUrl()}/myform`);
// or
const formio = new Formio(`${Formio.getProjectUrl()}/form/000000000000000000000001`);
```

Resolved instance properties (read-only):

- `formio.projectUrl` — the project endpoint.
- `formio.formUrl` — `${projectUrl}/form/<id>`.
- `formio.formId` — the resolved Mongo ObjectId.
- `formio.formsUrl` — `${projectUrl}/form` (list).

Instance methods:

- `loadForm(query?, opts?): Promise<Form>` — `GET ${formUrl}`. Honors form revisions when the URL contains `?formRevision=<rev>`.
- `saveForm(data?, opts?): Promise<Form>` — `POST` if `formId` is absent, otherwise `PUT`. Used for both create and update.
- `deleteForm(opts?): Promise<void>` — `DELETE ${formUrl}`.
- `loadForms(query?, opts?): Promise<Form[]>` — `GET ${formsUrl}?<query>`. Use Mongo-style filters (`type=form`, `tags__in=published`, `limit=50`, `skip=0`).
- `getFormId(): Promise<string>` — resolve the alias to a real ObjectId.

Static helpers:

- `Formio.clearCache(): void` — drop the request cache (useful after `saveForm` if you observe stale reads).

## Examples

### Load a form by alias

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://forms.mysite.com');
Formio.setProjectUrl('https://forms.mysite.com/myproject');

const form = await new Formio(`${Formio.getProjectUrl()}/intake`).loadForm();
console.log(form.components.length, 'components');
```

### Create a form

```ts
import { Formio } from '@formio/js';

Formio.setBaseUrl('https://api.form.io');
Formio.setProjectUrl('https://myproject.form.io');

const created = await new Formio(`${Formio.getProjectUrl()}/form`).saveForm({
  title: 'Intake',
  name: 'intake',
  path: 'intake',
  type: 'form',
  components: [
    { type: 'textfield', key: 'firstName', label: 'First Name', input: true },
    { type: 'email', key: 'email', label: 'Email', input: true },
    { type: 'button', key: 'submit', label: 'Submit', action: 'submit', input: true },
  ],
});
```

### Update an existing form

```ts
import { Formio } from '@formio/js';

const formio = new Formio(`${Formio.getProjectUrl()}/intake`);
const form = await formio.loadForm();
form.title = 'Patient Intake';
await formio.saveForm(form);
```

### List forms with a query filter

```ts
import { Formio } from '@formio/js';

const forms = await new Formio(`${Formio.getProjectUrl()}/form`).loadForms({
  params: { type: 'form', tags__in: 'published', limit: 50, skip: 0 },
});
```

### Delete a form

```ts
import { Formio } from '@formio/js';

await new Formio(`${Formio.getProjectUrl()}/form/000000000000000000000001`).deleteForm();
```

## MCP Tool Preference

Inside this workspace, prefer the first-party MCP tools over raw SDK calls:

| Operation     | MCP tool      | SDK fallback                            |
| ------------- | ------------- | --------------------------------------- |
| Create a form | `form_create` | `new Formio(formsUrl).saveForm(form)`   |
| Load a form   | `form_get`    | `new Formio(formUrl).loadForm()`        |
| List forms    | `form_list`   | `new Formio(formsUrl).loadForms(query)` |
| Update a form | `form_update` | `new Formio(formUrl).saveForm(form)`    |

The MCP tools handle auth implicitly via the portal-login flow. Reach for the SDK when authoring code that runs in a consumer application (browser, Node script, plugin).
