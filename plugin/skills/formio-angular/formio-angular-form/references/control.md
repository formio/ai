# Controlling the form from Angular

Two ways in, and they answer different needs.

## 1. Events as outputs

Twenty-two of them:

`(ready)`, `(render)`, `(change)`, `(submit)`, `(beforeSubmit)`, `(invalid)`, `(errorChange)`, `(customEvent)`, `(formLoad)`, `(submissionLoad)`, `(prevPage)`, `(nextPage)`, `(page)`, `(changeItemsPerPage)`, `(fileUploadingStatus)`, and the datagrid row set: `(rowAdd)`, `(rowAdded)`, `(rowEdit)`, `(rowEdited)`, `(rowDelete)`, `(rowClick)`, `(rowSelectChange)`.

**`error` is not among them — it is an `@Input()`,** and the output that reports errors is `(errorChange)`. Writing `(error)="…"` compiles, because Angular falls back to a DOM event listener for the native `error` event on the host element, and that never fires: the handler silently never runs and errors appear to vanish. See section 2 for what `[error]` is actually for.

```html
<formio [src]="formUrl" (submit)="onSubmit($event)" (errorChange)="onErrors($event)"></formio>
```

Three are worth calling out because they have no obvious equivalent anywhere else:

- **`(customEvent)`** carries a `custom` button's event from the form definition — how a form asks the host application to do something: open a modal, navigate, call an API. The payload names the event and the component.
- **`(fileUploadingStatus)`** emits `'start'` and `'end'`, which is what a "do not navigate away" guard hangs off.
- **`(errorChange)`** emits the error array the component just placed on the fields, which is what an application renders its own error summary from after switching the built-in alerts off.

All of these are bridged into Angular's notification path for you. A handler you register on the instance is not — see below, and [change-detection.md](./change-detection.md).

## 2. `EventEmitter` inputs — pushing into the form

Five inputs are emitters the component subscribes to, so a parent drives the form without holding the instance at all:

| Input | Effect |
| --- | --- |
| `[refresh]` | emit `{ form }`, `{ submission }`, or both to swap the definition and/or the data on the live instance |
| `[language]` | an `EventEmitter<string>` (or a plain string) that sets the renderer's language |
| `[success]` | emit a message to show a success alert |
| `[error]` | emit an error to run it through the component's error placement — `error.details` unpacked, `setCustomValidity` on the offending fields |
| `[submitDone]` | emit a submission to fire the renderer's `submitDone` event, which is what a form's own post-submit behaviour listens for |

```ts
import type { FormioRefreshValue } from '@formio/angular';
import type { Submission } from '@formio/core/types'; // NOT @formio/js — it exports no submission type

readonly refresh = new EventEmitter<FormioRefreshValue>();
readonly triggerError = new EventEmitter<unknown>();

reload(submission: Submission) {
  this.refresh.emit({ submission });
}
```

`[refresh]` is the answer to "change the form without rebuilding it", and `[error]` is how an application's own save failure gets rendered on the right fields. Between them, most screens never need the instance — which is why the generated CRUD screens use exactly this pattern and hold no instance reference.

## 3. The live instance — the form controller

The renderer's `Webform` (or `Wizard`, or `PDF`) instance is the full API: read and set values, submit, validate, redraw, subscribe to any event, reach any renderer method.

### `(ready)` emits the **component**, not the instance

This is the trap. `ready` is typed `EventEmitter<FormioBaseComponent>` and emits the component itself; the renderer instance is on its `formio` property:

```ts
private instance: Webform | null = null;

onReady(component: FormioBaseComponent) {
  this.instance = component.formio;      // NOT the $event itself
}
```

### `formioReady` is usually the better route

The component exposes `formioReady`, a promise that resolves with the renderer instance. It does not depend on catching an event, so it works from code rather than from a template binding — a guard, a toolbar button, a parent reaching down:

```ts
import { FormioComponent } from '@formio/angular';

@ViewChild(FormioComponent) formio!: FormioComponent;

async ngAfterViewInit() {
  this.instance = await this.formio.formioReady;
}
```

Prefer this one. `(ready)` is for the case where the template is already wiring outputs anyway.

### Either way

**Hold it in a plain field, not a signal or a store.** The instance is not render-relevant data; nothing in your template derives from it, and putting it in a signal only invites reads that schedule change detection for no reason.

**Guard for not-yet-ready.** It arrives asynchronously, so any handler that can fire before the form finishes building must tolerate `null`.

**You do not destroy it.** The component's `ngOnDestroy` does that. Drop your reference and nothing else.

## Subscribing on the instance — the escape hatch

`instance.on(name, handler)` reaches every renderer event, including the ones with no output:

```ts
private readonly audit = inject(AuditService);
private readonly drafts = inject(DraftService);
// ...
const instance = await this.formio.formioReady;
instance.on('componentChange', (event) => this.audit.record(event));
instance.on('saveDraft', (submission) => this.drafts.save(submission));
```

**A handler registered this way is outside Angular's notification path.** The component's `ngZone.run` bridging applies only to the events it maps to its own outputs. So publish anything the view depends on explicitly — a `signal()` write or a `markForCheck()`. [change-detection.md](./change-detection.md) is the whole story, and it is short.

Reach for an output first. `instance.on` is for events that genuinely have none.

## Reading and writing submission data

- **As the user types:** `(change)`.
- **On submit:** `(submit)` carries the submission. Whether it has already been saved depends on your bindings — see [mounting.md](./mounting.md).
- **Reading on demand:** `instance.submission`, or `instance.data` for the data alone.
- **Writing one field:** `instance.getComponent('firstName')?.setValue('Ada')`.
- **Writing the lot:** a new `[submission]` binding, or a `[refresh]` emission, or `instance.submission = { data: … }`.
- **Submitting from your own button:** `await instance.submit()` — it validates first and rejects if the form is invalid.

Do not mirror the whole submission into component state on every `(change)` unless something actually renders from it. The renderer already owns that state, and copying it means two sources of truth diverging on the next redraw.

## Focus and validation

- `focusOnComponet(key)` on the component moves focus to a field; it is already wired to the built-in alert clicks.
- `instance.setCustomValidity(message, dirty)` on a component puts a server-side message on that field. You rarely need it directly: emitting through `[error]`, or letting an `[src]`-bound save fail, runs the component's own `error.details` → `getComponent(path)` → `setCustomValidity` placement.
- `instance.showErrors(errors)` renders an error list the renderer's own way.
