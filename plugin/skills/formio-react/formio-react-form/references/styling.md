# Making a rendered form look right

## A rendered form needs two stylesheets

Install the packages, render a form with no CSS, and what you get is an unstyled, visually broken form. **That symptom reads as a rendering failure**, which sends people to debug mounting, the form JSON, or the provider — none of which are wrong. Nothing is broken except that a stylesheet is missing.

Two are needed, and they are not interchangeable:

1. **`@formio/js/dist/formio.form.css` — the renderer's own stylesheet.** `@formio/js` DOES ship CSS, in `dist/`. It carries ~73 `.formio-*` selectors (datagrid, wizard navigation, file upload, signature, collapse icons, `.formio-errors`) plus every `.choices*` rule the `choicesjs` widget needs. Bootstrap contains none of them, so this file is required no matter what else you load — omit it and a reference select renders as an unstyled list.
2. **A Bootstrap 5 stylesheet**, because the default template emits Bootstrap-classed markup (`form-control`, `btn`, `col-*`) that the renderer's own CSS does not define.

```ts
import 'bootstrap/dist/css/bootstrap.min.css';
import '@formio/js/dist/formio.form.css';
```

`dist/*` is exported by `@formio/js`, so the specifier resolves under npm, Yarn PnP and pnpm alike. Use `formio.form.css` to render forms; `formio.full.css` adds the form **builder** and is only for an app embedding `FormBuilder`.

## Replacing the Bootstrap half

The renderer's own stylesheet stays either way. What is negotiable is item 2:

1. **Keep Bootstrap.** The markup is already Bootstrap-classed, so this is the shortest path to a correct-looking form.
2. **Write your own CSS against the renderer's class names.** Right when the application has its own design system and Bootstrap would collide with it.
3. **Change the markup itself with a template framework** — see below.

## Templates — changing what the renderer emits

`Templates` is re-exported from `@formio/react`. Setting the active template framework changes the **markup** the renderer produces, rather than fighting that markup with CSS overrides:

```ts
import { Templates } from '@formio/react';
Templates.framework = 'bootstrap';
```

Reach for this when the markup itself is wrong for your design system. Reach for CSS when the markup is fine and only the appearance needs work. A long override sheet fighting the emitted structure is a sign the framework choice is the real answer.

## Per instance versus globally

`Templates.framework` is global. To vary by form, pass the template through that form's renderer `options` instead — useful when one page embeds forms belonging to different design contexts.

## Scoping

Two directions, both worth guarding:

- **Form styles leaking out.** A global Bootstrap import restyles the whole application. In an app with its own design system, scope the import to the form's container.
- **App styles breaking the form.** Aggressive global resets, or utility CSS that targets bare element selectors, can break the renderer's layout. If a form looks subtly wrong only inside your app, suspect the app's own CSS before the renderer.

## Not the same as the application's design language

The stylesheet makes a **rendered form** legible. The application's design language governs the screens *around* it — and, for generated CRUD screens, that decision belongs to `formio-react`'s bootstrap phase and the `frontend-design` consultation. Different decisions; do not conflate them.
