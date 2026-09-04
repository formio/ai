# Making a rendered form look right

## A rendered form needs two stylesheets, and one is already there

Render a form with no CSS and what you get is an unstyled, visually **broken** form. **That symptom reads as a rendering failure**, which sends people to debug mounting, the form JSON, or the configuration — none of which are wrong. Nothing is broken except that a stylesheet is missing.

Two are needed, and they are not interchangeable:

1. **The renderer's own stylesheet** (`@formio/js/dist/formio.form.css`). It carries the `.formio-*` rules — datagrid, wizard navigation, file upload, signature, collapse icons, `.formio-errors` — plus every `.choices*` rule the `choicesjs` widget needs. Bootstrap contains none of them, so a form without it has, among other things, unstyled reference selects.
2. **A Bootstrap 5 stylesheet**, because the default template emits Bootstrap-classed markup (`form-control`, `btn`, `col-*`) that the renderer's own CSS does not define.

**`<formio>` brings the first one with it. You add the second.**

## How the component carries it

`FormioComponent` declares `styleUrls: ['…/@formio/js/dist/formio.form.min.css']` with `encapsulation: ViewEncapsulation.None`, and the packaged build inlines that stylesheet into the published bundle. `ViewEncapsulation.None` is what makes it work: the styles are emitted **globally**, so they reach the DOM the renderer builds imperatively, which scoped component styles never would.

Three consequences.

### Do not also add it to `angular.json` — while you are using `<formio>`

```json
"styles": [
  "node_modules/bootstrap/dist/css/bootstrap.min.css",
  "node_modules/bootstrap-icons/font/bootstrap-icons.css",
  "src/styles.css"
]
```

Bootstrap and Bootstrap Icons, and nothing from `@formio/js`. Adding `formio.form.css` here ships a **second copy** of the same tens of kilobytes for no benefit. Put Bootstrap before the workspace's own `src/styles.css` so application styles can override the defaults, and repeat the array on the matching `test` target.

**Not in `main.ts` and not as an `@import` in `styles.css`.** Both work, and both hide a workspace-wide dependency somewhere nobody looks for it.

### The one exception — a page that mounts the renderer itself

Everything above assumes `<formio>` is on the page. It is the component that carries the renderer stylesheet, so a page that mounts the renderer directly ([renderer-directly.md](./renderer-directly.md), or `environments.md`'s dynamic-import remedy) has nothing supplying it. **There, add it** — and it is the one case where the `angular.json` entry is correct rather than a duplicate:

```json
"styles": [
  "node_modules/bootstrap/dist/css/bootstrap.min.css",
  "node_modules/bootstrap-icons/font/bootstrap-icons.css",
  "node_modules/@formio/js/dist/formio.form.css",
  "src/styles.css"
]
```

`dist/*` is exported by `@formio/js`, so that specifier resolves under npm, Yarn PnP, and pnpm alike.

**In an application that has both kinds of page, list it once here and accept the duplicate.** A workspace-wide entry is the only way to serve a direct-renderer route that a user can deep-link to, and the cost is one copy of a stylesheet the browser caches — cheaper than a route that renders an unstyled form for anyone who did not arrive via a `<formio>` screen first.

### The styles arrive on first use, not at bootstrap

Angular injects a component's styles when that component type is **first instantiated**. So "is the renderer stylesheet on the page?" is only a meaningful question on a screen that has actually rendered a form, and the check is whether a `.formio-component` rule is present in the document's stylesheets. Absent on a screen that rendered a `<formio>`, suspect the `@formio/angular` install rather than a missing entry in `angular.json` — but absent on a direct-renderer page, the missing `angular.json` entry is exactly the cause, per the exception above.

This is worth knowing for a lazily-loaded route: nothing is missing before the first `<formio>` exists, so a "the form is unstyled" report needs the screen named. It is also why a direct-renderer route in a mixed application looks fine after visiting a `<formio>` screen and broken on a cold load — see the exception above.

### The styles are global whether you wanted that or not

`<form-builder>` and `<formio-report>` do the same with their own, larger stylesheets. That is one reason to import the standalone `FormioComponent` rather than all of `FormioModule` when only rendering is needed — it leaves the builder's stylesheet tree-shakeable.

## Replacing the Bootstrap half

The renderer's own stylesheet stays either way. What is negotiable is item 2:

1. **Keep Bootstrap.** The markup is already Bootstrap-classed, so this is the shortest path to a correct-looking form. Bootstrap Icons (`bi bi-*`) pairs with it, but the renderer defaults to Font Awesome icon classes — set `icons: 'bi'` in `[renderOptions]` if that is what the application ships, or every in-form icon renders as an invisible `<i>`.
2. **Write your own CSS against the renderer's class names.** Right when the application has its own design system and Bootstrap would collide with it.
3. **Change the markup itself with a template framework** — see below.

## Templates — changing what the renderer emits

`Templates` is exported from `@formio/js`. Setting the active template framework changes the **markup** the renderer produces, rather than fighting that markup with CSS overrides:

```ts
import { Templates } from '@formio/js';
Templates.framework = 'bootstrap';
```

Reach for this when the markup itself is wrong for your design system. Reach for CSS when the markup is fine and only the appearance needs work. A long override sheet fighting the emitted structure is a sign the framework choice is the real answer.

`Templates.framework` is global. To vary by form, pass the template through that form's `[renderOptions]` instead — useful when one page embeds forms belonging to different design contexts.

## The component's own chrome is yours to restyle or switch off

`<formio-alerts>` emits `alert alert-<type>` divs and `<formio-loader>` has its own stylesheet, both global. If they clash with the application's design system, either restyle them — they are plain Bootstrap classes — or turn them off with `disableAlerts: true` in `[options]` and `[hideLoading]="true"`, and render your own from `(errorChange)` and the form's ready state.

## Scoping

Two directions, both worth guarding:

- **Form styles leaking out.** A global Bootstrap import restyles the whole application. In an app with its own design system, scope the import to the form's container.
- **App styles breaking the form.** Aggressive global resets, or utility CSS that targets bare element selectors, can break the renderer's layout. If a form looks subtly wrong only inside your app, suspect the app's own CSS before the renderer.

## Not the same as the application's design language

The stylesheet makes a **rendered form** legible. The application's design language governs the screens *around* it — and, for a generated application, that decision belongs to `formio-angular`'s BOOTSTRAP phase and the `frontend-design` consultation. Different decisions; do not conflate them.
