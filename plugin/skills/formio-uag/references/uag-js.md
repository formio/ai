# `@formio/uag-js` in a formio.js application

`@formio/uag-js` (2.x) connects a formio.js application to the UAG. Register it once, and render forms exactly as before, from their Form.io URLs. For every form tagged `uag`:

- **Its submissions are saved through the UAG**, so the form's Run task actions run on them. Other forms, and every other request (form definitions, files, resources, select data), still go straight to Form.io.
- **Agent Input is attached** when one of the form's tasks has an input. The user describes something in their own words, and the form fills itself from `{form}/agent/extract`: decisions first, so conditional pages react at once, then extracted values. It never overwrites what the user entered.
- **It can be rendered as a chat** with `Formio.createChat` ([chat-widget.md](./chat-widget.md)).

Tagging a form `uag` is then all it takes to move it onto the UAG; the application does not change. Agent Input calls `extract`, which is Agentic Formflow (a license or a hosted project); submission routing and the chat need no license.

## Contents

- [Install and register](#install-and-register)
- [What it changes, and what it does not](#what-it-changes-and-what-it-does-not)
- [Options](#options)
- [Setting up the form](#setting-up-the-form)
- [Triggers](#triggers)
- [Attaching by hand](#attaching-by-hand)
- [Rules Agent Input keeps](#rules-agent-input-keeps)
- [Public forms](#public-forms)

## Install and register

`npm install @formio/uag-js`. It has no dependencies and a peer dependency on `@formio/js` 5. It ships as an ES module, a CommonJS module, the browser global `FormioUAG`, TypeScript types (`index.d.ts`) and a stylesheet, `@formio/uag-js/uag-js.css`, for Agent Input's notes and the chat.

```js
import { Formio } from '@formio/js';
import { UAG } from '@formio/uag-js';
import '@formio/uag-js/uag-js.css';

Formio.setBaseUrl(config.formioBaseUrl);          // the Base URL, as the app already sets it
Formio.setProjectUrl(config.formioProjectUrl);    // the Project URL — still Form.io, not the UAG
Formio.use(UAG(config.uagUrl));                   // the UAG URL, from the app's own configuration

Formio.createForm(document.getElementById('claim'), `${config.formioProjectUrl}/claim`);
```

`config` stands for wherever the application keeps its settings (Vite's `import.meta.env`, an Angular environment file, a server-rendered config object). The Project URL and Base URL come from `project_get`; the UAG URL from the user. With script tags:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@formio/js@5/dist/formio.full.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@formio/uag-js@2/uag-js.css">
<script src="https://cdn.jsdelivr.net/npm/@formio/js@5/dist/formio.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@formio/uag-js@2/index.js"></script>
<script>
  Formio.use(FormioUAG.UAG('https://uag.example.com'));
</script>
```

Give `UAG()` the UAG's root URL — `Formio.use(UAG('https://uag.example.com'))` — and allow the application's origin in the UAG's `CORS` setting. The module addresses each form on the UAG by its id: `{uagUrl}/project/{projectId}/form/{formId}` for a project on Enterprise or the hosted service, `{uagUrl}/form/{formId}` on Open Source.

Registering also adds the `chat` display and `Formio.createChat` (exported as `createChat` and `UAG.createChat` too).

### In React and Angular applications

`@formio/react` and `@formio/angular` render with `@formio/js`, so the same registration applies: call `Formio.use(UAG(uagUrl))` once, at startup, before the first form renders, on the `Formio` the framework library uses.

- **React**: in the entry module (`main.tsx`), next to any `Formio.setBaseUrl` / `setProjectUrl`, before `createRoot(...).render(...)`. The `<Form src=...>` component then routes and gets Agent Input with no other change.
- **Angular**: in `main.ts` before `bootstrapApplication(...)`, or in an `APP_INITIALIZER` / `provideAppInitializer` that runs before the first `<formio>` renders.
- **One copy of `@formio/js`.** The registration lives on the `Formio` object of the `@formio/js` copy that rendered it. If the application resolves two copies (check `npm ls @formio/js`), deduplicate them, or the framework's forms will not see the module.

Mounting the form itself — lifecycle, teardown, change detection — stays with `formio-form`, `formio-react` or `formio-angular`; this module changes only where `uag` forms save and what they can do.

## What it changes, and what it does not

| Request | Goes to |
| --- | --- |
| A submission of a form tagged `uag`: create, read, update, delete, list | The UAG |
| A `uag` form's agent operations (Agent Input) | The UAG |
| The form's definition, files, resources and select data | Form.io, as before |
| Everything for a form without the tag | Form.io, as before |

Each request to the UAG carries the credential formio.js already sends to Form.io: the signed-in user's `x-jwt-token`, or none for a visitor. When the UAG cannot be reached, the submission fails with formio.js's normal error; it is never sent to Form.io instead, which would skip the form's tasks. A form rendered from a definition object rather than its URL has no URL to route from: its submissions are not rerouted, and Agent Input is attached only when the definition carries its `_id` (and `project` on Enterprise).

**This is not a security boundary.** Routing happens in the browser, and a client can always post straight to Form.io. Keep an agent's fields safe on the server: `uagAuthoritative` on them, a Run task before the save that re-decides them, and on self-hosted Enterprise an agent role with form permissions that refuse users' direct writes ([workflows.md](./workflows.md)).

## Options

`UAG(uagUrl, options)`:

| Option | Default | Meaning |
| --- | --- | --- |
| `agentInput` | `true` | `false` attaches no Agent Input anywhere; `uag` forms still save through the UAG. |
| `task` | the task of the input that fired | The task Agent Input extracts for. |
| `trigger` | `next` for wizards, `blur` otherwise | When to extract: `blur`, `pause`, `next` or `button`. |
| `pauseMs` | `800` | With `pause`: the pause in typing that triggers a request. |
| `nextTimeoutMs` | `1500` | With `next`: the longest the wizard waits for decisions before moving on. |
| `fetch` | the global `fetch` | The `fetch` Agent Input uses. |
| `onStart`, `onResult`, `onError`, `onDone` | | Callbacks for every form; see below. |

## Setting up the form

Agent Input needs a task with an **input**: the field (or container) whose text is read, flagged `uag: "<task>"` and `uagField: "input"`. When the trigger fires, the form's current data is sent and the UAG reads the input from it. The user needs create or update access to the form.

```json
{ "type": "textarea", "key": "lossDescription", "label": "What happened?", "input": true,
  "properties": { "uag": "triage", "uagField": "input" } }
```

Put decision fields that steer a wizard (radios and selects whose values turn pages on) in the same task, set `clearOnHide: false` on each of them, and use the `next` trigger on the page that holds the input.

## Triggers

| Trigger | Fires | Use for |
| --- | --- | --- |
| `blur` | When the user leaves one of the task's inputs. | Single-page forms. |
| `pause` | After `pauseMs` without typing in an input. | Filling as the user types. |
| `next` | On wizard **Next**, from the page holding the input. The wizard waits for decisions, up to `nextTimeoutMs`, so the pages they turn on are in place before it moves. | Wizards whose pages depend on triage. |
| `button` | Never on its own; call `extract()`. | A "Fill in from my description" button. |

With `next`, Agent Input installs formio.js's `beforeNext` hook on that form only; an existing `beforeNext` runs first. After the wait it re-runs the form's conditionals and recomputes the wizard's pages.

## Attaching by hand

`UAG.attach(form, options)` attaches Agent Input to one rendered form — with `agentInput: false` globally, to use the `button` trigger, or to point one form at a relay. It replaces the form's earlier attachment, so the form never extracts twice.

```ts
const agent = UAG.attach(form, {
  task: 'triage',
  trigger: 'button',
  formUrl: '/api',             // where the form's agent operations are: a relay of your own; default the form on the UAG
  onStart: ({ followUp }) => showStatus(followUp ? 'Filling in the new steps…' : 'Reading your description…'),
  onResult: (event) => showStatus(event.kind === 'decision' ? 'Sorted.' : `Filled ${Object.keys(event.patch).length} fields.`),
  onError: () => showStatus('You can continue by hand.'),
  onDone: (summary, { followUp }) => {},
});

fillButton.addEventListener('click', async () => {
  const { decided, done } = agent.extract();
  await decided;   // the first decisions are applied
  await done;      // the whole request, and any follow-up, finished
});

// On teardown (a route change, a component's destroy):
agent.detach();
```

| Member | Meaning |
| --- | --- |
| `extract()` | Extract now. Returns `{ decided, done }`; failures go to `onError`, and both promises still resolve. |
| `state` | Which values Agent Input wrote and which the user changed: `state.source(path)` is `'user'`, `'agent'` or `'none'`. |
| `detach()` | Removes listeners and annotations, restores the wizard's hooks, aborts a request in flight. Forms attached automatically are detached when formio.js destroys them. |

`onResult(event)` receives each engine group's `result` event (`kind`, `task`, `engine`, `model`, `latencyMs`, `attempts`, `fields`, `patch`, `toolCalls?`, `error?`); `onDone(summary)` gets the final result object, or `null` when the request failed. A new request aborts the one in flight, which then calls neither `onError` nor `onDone`. When the decisions revealed fields hidden until then, Agent Input asks once more with the new data (`followUp: true`).

## Rules Agent Input keeps

- **It never overwrites the user.** It writes a field only when it is empty, or when its value is the one Agent Input wrote last and the user has not changed it. A field the user changes is theirs for the rest of the session.
- **Nothing stale survives a new description.** When the input changes, values it wrote from the earlier input and the user has not changed are emptied before the new request.
- **Uncertain means check.** Confident values show their confidence; uncertain ones are prefilled with a "Please check this." note and a button per alternative; agent-engine values are marked as suggestions.
- **The form keeps working.** On a failure the user sees a short message under the input and carries on by hand.

Styles: `uag-chip uag-confident`, `uag-chip uag-uncertain`, `uag-alternative`, `uag-chip uag-suggested`, and `uag-error` (with `role="status"`).

Values Agent Input writes are values the user submits. To trust a decision that drives routing, re-decide it on the server with a Run task before the save ([workflows.md](./workflows.md#re-deciding-on-the-server)).

## Public forms

A visitor who is not signed in has no Form.io token. Two ways to give a public form Agent Input:

- **Anonymous use**: set `uagAnonymous: "true"` on the form and let the Anonymous role create its submissions. The UAG answers visitors directly, rate-limited per address and in total. Every request may call a model at the owner's expense.
- **A relay of your own**, when you need a CAPTCHA, a budget or your own sessions: the browser calls your server, which calls the UAG with a key the browser never sees, fixing the form and task. Point Agent Input at it with `formUrl` (`UAG.attach(form, { formUrl: '/api' })` posts to `/api/agent/extract`). The relay itself is in [agent-api.md](./agent-api.md#a-relay-of-your-own).

Never put a project or admin key in the page: the UAG refuses keys on browser requests, and anyone who opens the page could read it.
