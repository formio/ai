# Lifecycle — what you must do, and why the component looks like this

Two parts, deliberately separated. Part one changes the code you write. Part two explains the internals and is background — read it when debugging, or when weighing [renderer-directly.md](./renderer-directly.md) against staying with the component.

The short version of part one: the component handles teardown, double-submit, and the change-detection bridge for you. What it cannot handle is what you hand it, and every item below is about that.

---

# Part one — what you must do

## A new `[form]` object rebuilds the renderer

**Symptom.** The form flickers, loses focus mid-typing, or resets what the user entered. `(ready)` fires repeatedly.

**Cause.** `ngOnChanges` calls `setForm` whenever the `form` input's value changes, and `setForm` destroys the current renderer and builds a new one. **Identity** is what `ngOnChanges` compares, so an object literal written inline in a template — `[form]="{ components: [...] }"` — is a new object on every change-detection pass, and rebuilds the form on every pass.

**Remedy.** Hold the definition in a field, a signal, or an observable and bind that, so its identity changes only when the definition actually does.

```ts
import type { FormioForm } from '@formio/angular';

readonly definition = signal<FormioForm | null>(null);
```

```html
<formio [form]="definition()" [submission]="prefill" (submit)="onSubmit($event)"></formio>
```

The same applies to `[options]` and `[renderOptions]` — see [mounting.md](./mounting.md).

**This is a usage requirement, not a library defect.** Any input-driven renderer has it; the change hook keys on its inputs either way.

## Changing `[submission]` is cheap — rely on it

**Symptom.** Contortions to avoid updating `[submission]`, or state mirrored elsewhere to dodge a rebuild that never happens.

**Cause.** The natural assumption is that `[submission]` behaves like `[form]`. It does not: `ngOnChanges` applies it to the **live instance** through `setSubmission`, behind the component's `formioReady` promise so a value arriving before the form is built is applied once it is rather than lost.

**Remedy.** Pass it and move on. Pre-fill it, update it as data loads, drive it from state. `[hideComponents]` is applied in place too.

## Clone form definitions you reuse

**Symptom.** Two forms on one page interfere. A form is subtly wrong the second time it mounts. A "default" definition accumulates fields.

**Cause.** The renderer mutates form definitions **in place**. A definition object held at module scope, or in a shared service, and handed to more than one `<formio>` is a single reference being edited by each of them.

**Remedy.** Clone per instance before binding it. `structuredClone(definition)` is enough; `Utils.fastCloneDeep` from `@formio/js/utils` is what the renderer itself uses.

## `[noeval]` is a global switch, not a per-form option

`[noeval]` writes `Evaluator.noeval` on the renderer's shared `Evaluator`, in `ngOnInit` and again in `ngOnChanges`. It is **global** and last-write-wins: setting it on one `<formio>` changes how every other form in the application evaluates its expressions, including forms already on screen.

Set it once, at bootstrap, for the whole application if you want it — not as a per-embed binding. And do not set it *away* from the application-wide value on one screen; the next screen will not put it back.

## Give a generated `<formio>` a stable identity

An `@for` over forms without `track` gives Angular licence to reuse the wrong host element. Track by something stable — the form's `_id` or path — whenever more than one `<formio>` is generated from a collection.

## Do not save twice

Whether `(submit)` means "saved" or "validated" depends on your bindings, and a handler that saves after an `[src]`-bound form already did writes the record twice. [mounting.md](./mounting.md) has the table. The component's own `submitting` latch protects against a duplicate `submit` event, not against a duplicate save you write yourself into the wrong branch.

## What you do NOT have to do

Worth stating, because these are the habits carried in from hand-rolled mountings and they are all wasted work here:

- **Destroying the renderer.** `ngOnDestroy` calls `formio.destroy()`.
- **Guarding against a destroy mid-build.** The component chains off its own `formioReady`.
- **Latching submit against duplicates.** A `submitting` flag drops a second `submit` while the first is in flight.
- **Entering Angular's zone from renderer events,** for any event the component maps to an output. Only handlers you register on the instance need publishing — [change-detection.md](./change-detection.md).
- **Clearing the container before a rebuild.** `setForm` empties the host element itself.

---

# Part two — background: why the component looks like this

Not instructions. Useful when debugging, or when evaluating [renderer-directly.md](./renderer-directly.md) against what the component already handles.

- **It builds outside Angular's zone and re-enters per event.** `setForm` runs inside `runOutsideAngular` — building a form attaches a great many DOM listeners, and each one inside the zone would schedule a change-detection pass — and each renderer event it maps to an output is wrapped in `ngZone.run`.
- **It sets `nosubmit = true` and owns the save.** That is what makes the component's `beforeSubmit` hook, its success alert, and its server-error placement possible: it stands between the renderer and the server on purpose. When you bind `[form]` instead of `[src]` there is no service to save through, so it emits and stops.
- **`formioReady` is a promise resolved after the renderer's own `ready`.** `ngOnChanges` chains off it, which is why an input change arriving before the form is built is applied rather than dropped.
- **Its alerts are Angular state.** `FormioAlerts` is a plain class the component owns and the `<formio-alerts>` child renders, which is why `markForCheck` appears everywhere an alert is set.
- **It defaults the renderer's `noAlerts` to `true`.** Two alert systems on one form would double every message, so it suppresses the renderer's own.
- **Its error path resolves paths to components.** `onError` unpacks `error.details`, resolves each `path` with `getComponent`, calls `setCustomValidity`, and binds an alert to the component so clicking the alert focuses the field. Nothing in the renderer does that mapping.
