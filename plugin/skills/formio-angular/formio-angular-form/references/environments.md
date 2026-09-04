# Build environments

Angular's build itself needs no special configuration to render a form — no custom loader, no polyfill beyond what the workspace has. What the workspace does need is the two packages and the Bootstrap stylesheet, which are prerequisites rather than build settings and live in [the parent skill's prerequisites section](../SKILL.md) and [styling.md](./styling.md). Beyond those, one thing genuinely needs attention here: server rendering.

## Server rendering is the one hard limit

`@formio/js` reads browser globals **while its module is evaluating**, not when a form is created. Importing it in Node throws before any of your code runs:

```
document is not defined
```

`@formio/angular`'s own root entry point does the same — it assigns `window.global` at module scope. So `<formio>` cannot be imported during a server-render pass, and marking the host component client-side is not a remedy: Angular's server build still evaluates the module graph.

This applies to `@angular/ssr`, any prerender or `ng build --ssr` target, and any static-site generation over an Angular app. It is a renderer limit, not an Angular one — the same constraint `formio-react` documents for Next.js.

### Remedy 1 — a `@defer` block

The Angular-native answer. A `@defer` block's dependencies are not part of the server bundle: the server renders `@placeholder`, and the browser loads the block on the trigger.

```html
@defer (on viewport) {
  <formio [src]="formUrl" (submit)="onSubmit($event)"></formio>
} @placeholder {
  <div class="form-placeholder">Loading form…</div>
}
```

Two things to keep true: the component holding `<formio>` must be reachable **only** from inside the `@defer` block — a second import from an eagerly-rendered template pulls it back into the server bundle and the error returns — and incremental hydration must not be configured to render this block on the server.

### Remedy 2 — `isPlatformBrowser` and a dynamic import

When `@defer` does not fit (the form is created imperatively, or the trigger has to be your own logic), guard the import:

```ts
private readonly platformId = inject(PLATFORM_ID);

async ngAfterViewInit() {
  if (!isPlatformBrowser(this.platformId)) return;
  const { Formio } = await import('@formio/js');
  this.instance = await Formio.createForm(this.host.nativeElement, this.formUrl);
}
```

The `await import(...)` is what keeps the module out of the server pass; the platform check is what keeps the server from reaching it. Both are needed — a static `import` at the top of the file is evaluated on the server whatever the guard says. Note that this route mounts the renderer rather than the component, so it carries the four obligations in [renderer-directly.md](./renderer-directly.md) — which is the reason to prefer Remedy 1, where the component stays.

**Say the limit plainly rather than generating code that will not run.** If a request is for a server-rendered form screen, the answer is that the form renders in the browser and the surrounding page can render on the server.

## `zone.js` is optional

`@formio/angular` declares `zone.js` as an **optional** peer dependency, and `<formio>` does not require it: it works under `provideZonelessChangeDetection()` with an empty `polyfills` array, because its own bridge pairs `markForCheck` with `ngZone.run`. What differs between the modes is where a missing view refresh shows up — [change-detection.md](./change-detection.md) has it.

## What gets bundled

The renderer is bundled by your build. Nothing is fetched from a CDN at runtime, and this is worth knowing because `@formio/js` also ships a CDN-loading embed path that `Formio.createForm` is *named* after: importing the package replaces that function with the local one, so a form always renders from your own bundle. There is no `cdnUrl` to configure and no script tag to add.

Consequences for the build:

- **The renderer is large.** It carries every stock component, the templates, and the widget libraries. Where first-load size matters, put the form behind a lazily-loaded route or a `@defer` block — which is the same shape as the server-rendering remedy above, so one arrangement solves both.
- **What you import decides how much CSS ships.** `FormioComponent` inlines the renderer stylesheet into its own component styles, and `<form-builder>` and `<formio-report>` inline their own, larger ones. Importing the standalone `FormioComponent` rather than all of `FormioModule` leaves the builder's stylesheet tree-shakeable. See [styling.md](./styling.md).
- **`@formio/js` publishes CommonJS,** so `ng build` may warn that a dependency "can cause optimization bailouts". That is a warning, not an error: the app builds and runs. Add the named package to `angular.json`'s `allowedCommonJsDependencies` only to silence a warning you have actually seen — never pre-emptively, and never for a package the message did not name.

## Everything else

Standard `ng build` / `ng serve` workspaces, whatever their builder, need nothing more. Do not go looking for configuration that is not required.
