# `@formio/uag-js` in a formio.js application

`@formio/uag-js` (2.x) connects a formio.js application to the UAG. Register it once, and render forms exactly as before, from their Form.io URLs. For every form tagged `uag`:

- **Its submissions are saved through the UAG**, so the form's Run task actions run on them. Other forms, and every other request (form definitions, files, resources, select data), still go straight to Form.io.
- **Agent Input is attached** when one of the form's tasks has an input. The user describes something in their own words, and the form fills itself from `{form}/agent/extract`: decisions first, so conditional pages react at once, then extracted values. It never overwrites what the user entered.
- **It can be rendered as a chat** with `Formio.createChat` ([chat-widget.md](./chat-widget.md)).

Tagging a form `uag` is then all it takes to move it onto the UAG; the application does not change. Agent Input calls `extract`, which is Agentic Formflow (a license or a hosted project); submission routing and the chat need no license on Form.io Open Source or the hosted service (a self-hosted Enterprise project needs a license that includes the UAG to be served at all).

## Contents

- [Install and register](#install-and-register)
- [Loading it from the UAG](#loading-it-from-the-uag)
- [What it changes, and what it does not](#what-it-changes-and-what-it-does-not)
- [Options](#options)
- [Setting up the form](#setting-up-the-form)
- [Triggers](#triggers)
- [Attaching by hand](#attaching-by-hand)
- [Rules Agent Input keeps](#rules-agent-input-keeps)
- [Public forms](#public-forms)

## Install and register

`npm install @formio/uag-js@{uagJsVersion}`, with the exact version resolved as [patterns-and-licensing.md](./patterns-and-licensing.md#versions) describes. It has no dependencies and a peer dependency on `@formio/js` 5. It ships as an ES module, a CommonJS module, the browser global `FormioUAG`, TypeScript types (`index.d.ts`) and a stylesheet, `@formio/uag-js/uag-js.css`, for Agent Input's notes and the chat.

```js
import { Formio } from '@formio/js';
import { UAG } from '@formio/uag-js';
import '@formio/uag-js/uag-js.css';

Formio.setBaseUrl(config.formioBaseUrl);          // the Base URL, as the app already sets it
Formio.setProjectUrl(config.formioProjectUrl);    // the Project URL — still Form.io, not the UAG
Formio.use(UAG(config.uagUrl));                   // the UAG URL, from the app's own configuration

Formio.createForm(document.getElementById('claim'), `${config.formioProjectUrl}/claim`);
```

`config` stands for wherever the application keeps its settings (Vite's `import.meta.env`, an Angular environment file, a server-rendered config object). The Project URL and Base URL come from `project_get`; the UAG URL from the user.

With script tags, where `{uagJsVersion}` is the same exact version (jsDelivr also answers a major such as `@2`, but that moves with each release):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@formio/js@5/dist/formio.full.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@formio/uag-js@{uagJsVersion}/uag-js.css">
<script src="https://cdn.jsdelivr.net/npm/@formio/js@5/dist/formio.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@formio/uag-js@{uagJsVersion}/index.js"></script>
<script>
  Formio.use(FormioUAG.UAG('https://uag.example.com'));
</script>
```

Give `UAG()` the UAG's root URL — `Formio.use(UAG('https://uag.example.com'))` — and allow the application's origin in the UAG's `CORS` setting. The module addresses each form on the UAG by its id: `{uagUrl}/project/{projectId}/form/{formId}` for a project on Enterprise or the hosted service, `{uagUrl}/form/{formId}` on Open Source.

Registering also adds the `chat` display and `Formio.createChat` (exported as `createChat` and `UAG.createChat` too).

### In React and Angular applications

`@formio/react` and `@formio/angular` render with `@formio/js`, so the same registration applies: call `Formio.use(UAG(uagUrl))` once, at startup, before the first form renders, on the `Formio` the framework library uses.

- **React**: in the entry module (`main.tsx`), next to any `Formio.setBaseUrl` / `setProjectUrl`, before `createRoot(...).render(...)`. `<Form src={formUrl}>` then routes and gets Agent Input with no other change; a form rendered from a definition object routes only as [What it changes](#what-it-changes-and-what-it-does-not) describes.
- **Angular**: in `main.ts` before `bootstrapApplication(...)`, or in an `APP_INITIALIZER` / `provideAppInitializer` that runs before the first `<formio>` renders.
- **One copy of `@formio/js`.** The registration lives on the `Formio` object of the `@formio/js` copy that rendered it. If the application resolves two copies (check `npm ls @formio/js`), deduplicate them, or the framework's forms will not see the module.

Mounting the form itself — lifecycle, teardown, change detection — stays with `formio-form`, `formio-react` or `formio-angular`; this module changes only where `uag` forms save and what they can do.

## Loading it from the UAG

Every UAG serves the `@formio/uag-js` it was installed with (the `formio/uag` image includes it), so a page without a bundler can load it from the UAG itself, at the UAG's own version, after formio.js:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@formio/js@5/dist/formio.full.min.css">
<link rel="stylesheet" href="https://uag.example.com/uag-js/uag-js.css">
<script src="https://cdn.jsdelivr.net/npm/@formio/js@5/dist/formio.full.min.js"></script>
<script src="https://uag.example.com/uag-js/uag.use.js"></script>
```

`uag.use.js` registers itself: it takes the UAG URL from its own `src`, carries the UAG's plugin manifest, and includes the formio.js component of every module the UAG uses (AI Document's, for one); `uag-js.css` carries their stylesheets. Do not call `Formio.use(UAG(...))` on top of it — the page would register the module twice. To pass options, load `index.js` instead (from jsDelivr or npm, as above) and register it yourself with `Formio.use(FormioUAG.UAG('https://uag.example.com', options))`; the modules' components are then at `{uagUrl}/uag-js/components/<type>.js` (and `<type>.css`), loaded after that registration.

These files are public (`Access-Control-Allow-Origin: *`) and revalidated on every load (`Cache-Control: no-cache` with an `ETag`), so a page always gets the copy that matches the UAG. A UAG installed without `@formio/uag-js` answers `404` "@formio/uag-js is not installed with this UAG.".

## What it changes, and what it does not

| Request | Goes to |
| --- | --- |
| A submission of a form tagged `uag`: create, read, update, delete, list | The UAG |
| A `uag` form's agent operations (Agent Input) | The UAG |
| The form's definition, files, resources and select data | Form.io, as before |
| Everything for a form without the tag | Form.io, as before |

Each request to the UAG carries the credential formio.js already sends to Form.io: the signed-in user's `x-jwt-token`, or none for a visitor. When the UAG cannot be reached, the submission fails with formio.js's normal error; it is never sent to Form.io instead, which would skip the form's tasks. A form loaded at a revision URL (`{form}/v/{n}`) saves to the form itself.

**How a save is recognised.** The module is a formio.js fetch plugin keyed on the form's Form.io URL. When formio.js loads a definition through a `Formio` instance (`Formio.createForm` with a URL, `<Form src={formUrl}>`, `[src]`, or `new Formio(formUrl).loadForm()`), the module records it; afterwards a submission request from any `Formio` instance for that same URL (`new Formio(formUrl).saveSubmission(...)`, or the rendered form's own submit) goes to the UAG when the recorded definition is tagged `uag`. So:

- An application that renders from a definition object — a React Router loader, Angular's `[form]` — still routes, provided it loaded that definition with `new Formio(formUrl).loadForm()` and saves with `new Formio(formUrl).saveSubmission(...)` for the same URL.
- A definition fetched any other way (`fetch`, a relay, a bundled JSON file) is never recorded, and a save sent with `fetch` is never seen: both go to Form.io and skip every Run task. Post those saves to `{form}/submission` on the UAG yourself (`uagFormUrl(uagUrl, definition)` gives `{form}`).
- Agent Input attaches to a form rendered from a definition only when the definition carries its `_id` (and `project` on Enterprise), as Form.io returns it.

**This is not a security boundary.** Routing happens in the browser, and a client can always post straight to Form.io. Keep an agent's fields safe on the server: `uagAuthoritative` on them, a Run task before the save that re-decides them, and on self-hosted Enterprise an agent role with form permissions that refuse users' direct writes ([workflows.md](./workflows.md)).

## Options

`UAG(uagUrl, options)`:

| Option | Default | Meaning |
| --- | --- | --- |
| `agentInput` | `true` | `false` attaches no Agent Input anywhere; `uag` forms still save through the UAG. |
| `task` | the task of the input that fired | The task Agent Input extracts for. |
| `trigger` | `next` for wizards, `blur` otherwise | When to extract: `blur`, `pause`, `next` or `button`. `UAG.attach()` defaults to `blur` for every form, wizards included. |
| `pauseMs` | `800` | With `pause`: the pause in typing that triggers a request. |
| `nextTimeoutMs` | `1500` | With `next`: the longest the wizard waits for decisions before moving on. |
| `requireReview` | `false` | Stop wizard **Next** and **Submit** until the user ticks "Yes, this looks right" on each uncertain value, or changes it. |
| `fetch` | the global `fetch` | The `fetch` Agent Input, the manifest request and `client.stream()` use. |
| `onStart`, `onResult`, `onError`, `onDone` | | Callbacks for every form; see below. |
| `manifest` | fetched from `{uagUrl}/plugins` at registration, with the user's token | The installed plugins, which modules' components read. `uag.use.js` passes it embedded. |
| `portal` | `false` | Used by the UAG's portal script: registers only the client and the manifest, for modules' components in the form builder. Not for applications. |

Besides `UAG`, `attach` and `createChat`, the package exports `client` (also `UAG.client` and, once registered, `Formio.uagClient`): the browser API that modules' components build on — the UAG's URL, the user's token and headers, a form's URL on the UAG, the installed plugins, and `stream()` for a module's routes. `UAG.ready` resolves once the installed plugins are known; an application with its own form builder awaits it before offering modules' components. `renderMarkdown(markdown)` (also `UAG.renderMarkdown`) renders Markdown as the AI Document does, with all text escaped. `uagFormUrl(uagUrl, definition)` returns a form's URL on the UAG from its definition (`''` without an `_id`), for code that saves or calls agent operations itself; `routingPlugin`, `ExtractionState`, `SSEParser` and `isEmpty` are exported too, and the default export bundles them all.

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

`UAG.attach(form, options)` attaches Agent Input to one rendered form — with `agentInput: false` globally, to use the `button` trigger, or to point one form at a relay. It replaces the form's earlier attachment, so the form never extracts twice. Its options are those of `UAG()` for one form, plus `formUrl` (where the form's agent operations are) and `uagUrl` (a UAG other than the registered one); its `trigger` defaults to `blur` even on a wizard, so pass `trigger: 'next'` there.

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
| `detach()` | Removes listeners and annotations, restores the wizard's hooks, aborts a request in flight. Forms are detached when formio.js destroys them only while the module's Agent Input is on; with `agentInput: false`, call `detach()` yourself when the form is destroyed. |

`onResult(event)` receives each engine group's `result` event (`kind`, `task`, `engine`, `model`, `latencyMs`, `attempts`, `fields`, `patch`, `toolCalls?`, `error?`); `onDone(summary)` gets the final result object, or `null` when the request failed. A new request aborts the one in flight, which then calls neither `onError` nor `onDone`. When the decisions revealed fields hidden until then, Agent Input asks once more with the new data (`followUp: true`).

### Attaching by hand in React and Angular

Attach when the framework hands over the rendered form, and detach when the component goes away. The framework destroys the form itself; with `agentInput: false`, Agent Input is not detached with it, so detach yourself. Mounting the form stays with `formio-react` or `formio-angular`.

```tsx
import { useEffect, useRef } from 'react';
import { Form } from '@formio/react';
import { UAG, type AgentInput } from '@formio/uag-js';

export function Claim({ formUrl }: { formUrl: string }) {
  const agent = useRef<AgentInput | null>(null);
  useEffect(() => () => { agent.current?.detach(); agent.current = null; }, []);
  return (
    <>
      <Form
        src={formUrl}
        onFormReady={(instance) => {
          // A new instance (a new src) replaces the earlier attachment.
          agent.current = UAG.attach(instance, { task: 'triage', trigger: 'next' });
        }}
      />
      <button type="button" onClick={() => agent.current?.extract()}>Fill in from my description</button>
    </>
  );
}
```

```ts
import { AfterViewInit, Component, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormioComponent, FormioModule } from '@formio/angular';
import { UAG, type AgentInput } from '@formio/uag-js';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-claim',
  imports: [FormioModule],
  template: `<formio [src]="formUrl"></formio><p>{{ status() }}</p>`,
})
export class ClaimComponent implements AfterViewInit, OnDestroy {
  @ViewChild(FormioComponent) formio!: FormioComponent;
  readonly formUrl = `${environment.formioProjectUrl}/claim`;
  readonly status = signal('');
  private agent: AgentInput | null = null;
  private destroyed = false;

  async ngAfterViewInit() {
    const instance = await this.formio.formioReady;
    if (this.destroyed) return;               // the view went away while the form was building
    this.agent = UAG.attach(instance, {
      task: 'triage',
      trigger: 'next',
      // Renderer callbacks run outside Angular: publish them with a signal write.
      onDone: (summary) => this.status.set(summary ? 'Filled in from your description.' : ''),
      onError: () => this.status.set('You can continue by hand.'),
    });
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.agent?.detach();
    this.agent = null;
  }
}
```

`environment` is the application's own environment file, holding the Project URL from `project_get`. Pass `trigger: 'next'` on a wizard: `UAG.attach()` defaults to `blur` everywhere.

## Rules Agent Input keeps

- **It never overwrites the user.** It writes a field only when it is empty, or when its value is the one Agent Input wrote last and the user has not changed it. A field the user changes is theirs for the rest of the session.
- **Nothing stale survives a new description.** When the input changes, values it wrote from the earlier input and the user has not changed are emptied before the new request.
- **Uncertain means check.** Confident values show their confidence; uncertain ones are prefilled with a "Please check this." note and a button per alternative; agent-engine values are marked as suggestions.
- **The form keeps working.** On a failure the user sees a short message under the input and carries on by hand.
- **It reads the form's data, not the widget.** Fields are compared by the value in the form's data, and emptying a field fires a `change`, so the form's conditions and calculations follow (`@formio/uag-js` 2.0.1 and later; earlier versions mistook a Choices.js select's late display for the user's choice and could not empty a number field).
- **Values the application sets.** Prefill a field from code with `component.setValue(value, { modified: true })` so Agent Input records it as the user's (`state.source(path)` is `'user'`, and with `requireReview` it counts as checked); setting an input this way also fires the task's `pause` trigger as typing would.

Styles: `uag-chip uag-confident`, `uag-chip uag-uncertain`, `uag-alternative`, `uag-chip uag-suggested`, and `uag-error` (with `role="status"`); with `requireReview`, `uag-review` (the checkbox's label), `uag-review-needed` (an unticked note after Next or Submit was stopped) and `uag-reviewed`.

Values Agent Input writes are values the user submits. To trust a decision that drives routing, re-decide it on the server with a Run task before the save ([workflows.md](./workflows.md#re-deciding-on-the-server)).

## Public forms

A visitor who is not signed in has no Form.io token. The simplest answer is to let visitors register: a self-registration form that saves to a user resource and logs them in, after which formio.js holds their token and the per-caller limits apply (the UAG's own demo signs its visitors in as guest users this way). Otherwise, two ways to give a public form Agent Input:

- **Anonymous use**: set `uagAnonymous: "true"` on the form and let the Anonymous role create its submissions. The UAG answers visitors directly, rate-limited per address and in total. Every request may call a model at the owner's expense.
- **A relay of your own**, when you need a CAPTCHA, a budget or your own sessions: the browser calls your server, which calls the UAG with a key the browser never sees, fixing the form and task. Point Agent Input at it with `formUrl` (`UAG.attach(form, { formUrl: '/api' })` posts to `/api/agent/extract`). The relay itself is in [agent-api.md](./agent-api.md#a-relay-of-your-own).

Never put a project or admin key in the page: the UAG refuses keys on browser requests, and anyone who opens the page could read it.
