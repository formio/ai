# Keeping the view in step — zone.js and zoneless

The renderer builds and updates its own DOM. Angular does not know that DOM exists, and does not need to — until your application derives something from a renderer callback and renders it. That is the whole of this document, and it is short because the component does most of it for you.

Which mode the application runs in matters for the failure mode, so establish it before writing a handler: look for `provideZonelessChangeDetection()` (zoneless) or `provideZoneChangeDetection()` / a `zone.js` entry in `angular.json`'s `polyfills` (zone-based) in the app's bootstrap.

## What the component already does

It builds the renderer inside `ngZone.runOutsideAngular(...)`, wraps every renderer event it maps to an output in `ngZone.run(...)`, and calls `ChangeDetectorRef.markForCheck()` at each point where its own state — alerts, loading, label — changes.

That combination works in **both** modes. `runOutsideAngular` keeps a form's hundreds of DOM listeners from scheduling a change-detection pass each under zone.js; `markForCheck` is what notifies the scheduler under zoneless. `@formio/angular` declares `zone.js` as an optional peer dependency and takes no position on the mode.

So every output in [control.md](./control.md) — `(submit)`, `(change)`, `(page)`, the datagrid row events — refreshes the view without you doing anything. Same for the five `EventEmitter` inputs.

## The one rule

> Anything the view depends on that comes from a handler **you** registered on the instance must be published explicitly — a `signal()` write, or `ChangeDetectorRef.markForCheck()`.

The bridging covers the component's own outputs and nothing else. `instance.on('nextPage', …)`, registered after `formioReady`, bypasses it:

```ts
@ViewChild(FormioComponent) formio!: FormioComponent;

readonly page = signal(0);

async ngAfterViewInit() {
  const instance = await this.formio.formioReady;
  instance.on('nextPage', ({ page }) => this.page.set(page));   // signal write: notifies
}
```

With a non-signal field, say it explicitly:

```ts
private readonly cdr = inject(ChangeDetectorRef);
private currentPage = 0;
// ...
instance.on('nextPage', ({ page }) => {
  this.currentPage = page;
  this.cdr.markForCheck();
});
```

Prefer the signal. It works identically in both modes, needs no injection, and cannot be forgotten at one of several assignment sites.

**Check for an output before reaching for `instance.on` at all.** Most renderer events the application cares about already have one, and an output is bridged. This rule exists for the events that genuinely do not.

## The SDK's promises need the same treatment

`loadForm`, `loadSubmissions`, `currentUser`, `userPermissions` — every SDK promise resolves outside any notification path. Update state from them with a signal write or `markForCheck`, exactly as above.

**Never with `NgZone.run`.** Under `provideZonelessChangeDetection()`, `NgZone` is a no-op: `ngZone.run(...)` executes the callback and notifies nothing. Code written that way looks correct, works under zone.js, and silently stops working the day the application goes zoneless. This is the single most common wrong reflex here.

## The two failure modes

Same missing publish, different symptom:

- **Zone-based:** usually nothing, because some other event in the same tick schedules a pass and the stale value gets picked up by accident. It breaks when the surrounding component becomes `OnPush`.
- **Zoneless:** the field updates and the view never repaints. Deterministic, and the reason the rule above is not a nicety in a zoneless application.

The second is easier to debug and is why a generated app pins zoneless explicitly.

## What not to do

- **Do not remove zoneless to make a stale view repaint.** It hides the missing publish rather than fixing it, and the same handler will be stale under zone-based change detection the moment the component becomes `OnPush`.
- **Do not call `detectChanges()` from a renderer callback.** It runs synchronously inside the renderer's own event handling; `markForCheck` (or a signal write) schedules the pass for after it, which is what you want.
- **Do not mirror the whole submission into a signal on every `(change)`** just to keep the view fresh. Publish the one derived value the view renders — a page index, a validity flag, a computed total.
