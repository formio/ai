# Mounting the renderer yourself

The second path, and the honest one: you stop using an Angular component and call the renderer. `@formio/angular` is no longer involved — drop the dependency, or leave it for the CRUD screens and simply do not reach for `<formio>` on this page.

**This is a different job, not a lighter component.** Everything `<formio>` was doing — saving the submission, placing server errors on fields, alerts, loading state, applying input changes, entering Angular's zone, latching submit — becomes yours. Four of those are non-negotiable and are listed below. Read them as the price, and decide against the price rather than against the syntax.

## When it is warranted

Three cases justify it. Nothing else does.

1. **The form must live outside Angular's tree.** A `<dialog>` the application opens imperatively, a third-party container, a Web Component boundary, a portal target Angular does not own. There is no host element for a `<formio>` to sit in.
2. **The page must not carry `@formio/angular`.** A public single-form page where load size is the requirement, and dropping `@formio/angular` is a measured win — measure it, in your own build, before writing the code. Note the renderer itself dominates either way, so the saving is the Angular layer and its inlined stylesheets, not an order of magnitude. See [environments.md](./environments.md).
3. **A `Webform` or `Wizard` subclass of your own is doing the mounting.** `<formio>` accepts a `[renderer]` input for exactly this, so try that first; go direct only when the subclass also needs to control construction.

Everything else — wanting fewer inputs, disliking the alert chrome, preferring the renderer's own save behaviour — is [mounting.md](./mounting.md) and [styling.md](./styling.md), not this document. `disableAlerts`, `[hideLoading]`, and a `[form]` object with no `[src]` cover all three without giving up the component.

## The shape

```ts
import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { Formio } from '@formio/js';
import type { Webform } from '@formio/js';
import type { Submission } from '@formio/core/types';

@Component({
  selector: 'app-intake-form',
  template: '<div #host></div>',
})
export class IntakeFormComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLElement>;

  private instance: Webform | null = null;
  private destroyed = false;
  private inFlight = false;

  async ngAfterViewInit() {
    const instance = await Formio.createForm(this.host.nativeElement, this.formUrl, OPTIONS);

    // (2) the component may already be gone
    if (this.destroyed) {
      instance.destroy(true);
      return;
    }

    this.instance = instance;
    instance.on('submit', (submission: Submission) => this.onSubmit(submission));
  }

  ngOnDestroy() {
    this.destroyed = true;         // (2)
    this.instance?.destroy(true);   // (1)
    this.instance = null;
  }
}
```

```ts
// module scope, so its identity is stable and nothing rebuilds on a re-render
const OPTIONS = { noAlerts: false };
```

**`Submission` comes from `@formio/core/types`, not from `@formio/js`.** `@formio/js` exports the renderer classes (`Webform`, `Form`, `Formio`, `Utils`, `Templates`, …) and no submission type; importing one from there is a `TS2305` before anything runs. `@formio/core` arrives transitively with `@formio/js`, and `@formio/angular`'s own components take the type from exactly this path — add `@formio/core` as an explicit dependency if the workspace prefers not to rely on a transitive one for types.

## The four obligations

Each one is something `<formio>` was doing silently. Omitting any of them produces a bug that does not announce itself.

### 1. Destroy the instance

`instance.destroy(true)` in `ngOnDestroy`. Angular removes the host element; the `Webform` is a plain object with its own listeners and timers and does not know the page moved on. Without this, memory grows across route changes and old forms keep responding to SDK events against a detached tree.

### 2. Guard against being destroyed mid-build

Building a form is asynchronous, so the component can be destroyed while `createForm` is still in flight. The instance then finishes building against an element nobody is looking at, and `ngOnDestroy` already ran with nothing to destroy. Track a flag, check it when the promise resolves, and destroy there instead — the `destroyed` field above.

### 3. Latch submit

```ts
private async onSubmit(submission: Submission) {
  if (this.inFlight) return;
  this.inFlight = true;
  try {
    await this.records.create(submission);
  } finally {
    this.inFlight = false;
  }
}
```

The renderer can emit `submit` more than once for one interaction. `<formio>` holds a `submitting` latch; here nothing does, and the failure mode is **two records written milliseconds apart** that look like data somebody meant to create — the redirect lands on one, a list shows two plausible rows, the console stays silent.

A plain field, not a signal and not a disabled button: the duplicate arrives in the same tick, before change detection runs, so a disabled attribute has not taken effect yet.

The latch is unnecessary when the renderer is doing the saving — a URL passed to `createForm` sets the instance up to post the submission itself, and your handler is being notified rather than asked to act. [mounting.md](./mounting.md) has which is which.

### 4. Publish renderer callbacks into Angular

Every `instance.on(...)` handler is outside Angular's notification path. Anything the view derives from one must be published explicitly — a `signal()` write, or `ChangeDetectorRef.markForCheck()`:

```ts
readonly page = signal(0);
// ...
instance.on('nextPage', ({ page }) => this.page.set(page));
```

Under zone.js a missed publish costs performance; under zoneless it costs correctness, and the field updates while the view never repaints. Never reach for `NgZone.run` — it is a no-op under `provideZonelessChangeDetection()`. [change-detection.md](./change-detection.md) is the whole story.

There is also a **performance** half here that `<formio>` handles and you now do not: building a form attaches a great many DOM listeners, and under zone.js each one inside Angular's zone schedules a change-detection pass. Wrap the creation in `ngZone.runOutsideAngular(...)` on a zone-based application with a large form.

## What you own beyond the four

These are not correctness traps — they are capabilities that simply stop existing, and the reason case 2 above is rarer than it looks:

- **Server-error placement.** `<formio>` unpacks `error.details`, resolves each `path` with `getComponent`, and calls `setCustomValidity` so the message lands on the offending field. Do it yourself, or accept a generic error banner.
- **The `beforeSubmit` hook** that can asynchronously rewrite or reject a submission. The renderer has its own hook set through `options.hooks`; the callback-style hook `<formio>` adds on top of it does not exist here.
- **Alerts and loading state.** The renderer's own alerts appear unless you set `noAlerts`; there is no `<formio-alerts>` and no `<formio-loader>`.
- **Input reactivity.** There are no inputs. Change the instance: `instance.submission = …`, `instance.setForm(definition)`, `instance.getComponent(key)?.setValue(…)`.
- **The renderer stylesheet.** `<formio>` inlines it into its own component styles, so a page without one has nothing supplying it. Add `@formio/js/dist/formio.form.css` to `angular.json`'s `styles` array — [styling.md](./styling.md)'s "The one exception — a page that mounts the renderer itself" has the entry and the mixed-application case, and it is the one place that document permits it.

## Where the renderer API is documented

You are holding the renderer now, so the renderer's own skills answer everything from here:

- [`formio-form`](../../../formio-form/SKILL.md) — rendering by URL or JSON, pre-fill, the JavaScript control surface, renderer options, and every definition-level behaviour.
- [`formio-sdk`](../../../formio-sdk/SKILL.md) — `Formio.createForm`, the statics, `new Formio(url)` instances, and `Utils`.

This document does not restate any of it. What it covers is the Angular seam around a renderer Angular is not managing, and that seam is the four obligations above.
