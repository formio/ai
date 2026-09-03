# Rendering a form

```tsx
import { Form } from '@formio/react';

<Form src={formJson} submission={submission} onSubmit={handleSubmit} />
```

## Which source wins

`src` is the one **required** prop, and it takes the definition either way — `FormSource` is `string | FormType`:

| `src` value | Who fetches |
| --- | --- |
| a form URL string | **the renderer** — it fetches on mount |
| a form definition object | **your application** — you loaded it, the renderer just renders it |

Two more props sit beside it:

- `form` — a legacy alias for an object `src`. At runtime `form` takes precedence over `src` when both are passed, but the prop types declare `src` required and `form` optional, so `<Form src={json} />` on its own **fails to type-check** (`Property 'src' is missing`) in the strict TypeScript workspace every generated app uses. Pass the object through `src` instead; do not reach for `form`, and do not paper over the error with a dummy `src`.
- `url` — alongside an object `src`, sets the instance URL so submissions post to the right place.

Decide deliberately which owns fetching. A URL `src` is fine for a standalone embed; an object `src` is right whenever the surrounding application already has the definition, because then one thing owns loading and re-loading.

## Pre-filling

`submission` populates an existing submission:

```tsx
<Form src={formJson} submission={{ data: { firstName: 'Ada' } }} />
```

Changing it is **cheap**. It is applied to the live instance behind an equality check rather than rebuilding the form, so updating it as state changes does not tear the renderer down. See [lifecycle.md](./lifecycle.md).

## Wizards and PDFs

The embed is agnostic to how a form displays. A form built as a wizard or a PDF in the Form.io portal renders as one through the same `<Form src={...} />` — the definition carries its own `display`, and the renderer picks the right class from it. Nothing changes on the React side.

PDF rendering additionally needs the project's PDF server; the endpoint and project requirements belong to [`formio-api`](../../../formio-api/SKILL.md).

### Driving a wizard from your own UI

Where React does get involved is when the application wants to **own the wizard's flow** — its own Next and Back buttons, a progress indicator in the page chrome, a step counter in the header. That is the form-controller pattern from [control.md](./control.md) applied to a wizard instance:

```tsx
const wizard = useRef<Wizard | null>(null);
const [page, setPage] = useState(0);

<Form
  src={wizardJson}
  options={HIDE_BUILTIN_NAV}
  onFormReady={(instance) => { wizard.current = instance as Wizard; }}
  onNextPage={({ page }) => setPage(page)}
  onPrevPage={({ page }) => setPage(page)}
/>

<button onClick={() => wizard.current?.prevPage()}>Back</button>
<button onClick={() => wizard.current?.nextPage()}>Next</button>
<Progress current={page} total={wizard.current?.pages.length ?? 0} />
```

```ts
// module scope, so its identity is stable
const HIDE_BUILTIN_NAV = {
  buttonSettings: { showPrevious: false, showNext: false, showCancel: false, showSubmit: false },
};
```

Three pieces, each doing one job:

- **`buttonSettings`** hides the renderer's own navigation so yours is the only one. Add `breadcrumbSettings: { clickable: false }` when users must move strictly forward.
- **`onNextPage` / `onPrevPage`** are the wizard's page events, mapped to props by the `Form` component. They carry the new page index, which is what a progress indicator renders from. `wizardPageSelected` (a breadcrumb click) has no prop; reach it through `otherEvents`.
- **`nextPage()` / `prevPage()` / `setPage(i)` / `submit()`** on the instance drive the flow. `nextPage()` validates the current page first and rejects if it fails, leaving the wizard where it is with the errors rendered — so an `await` on it is also your gate.

The page API, conditional pages, and the events in full are documented once, for every host, in [`formio-form`'s wizards reference](../../../formio-form/references/wizards.md); this section only covers the React wiring around them.

## Options

`options` is the renderer's options object — `readOnly`, `noAlerts`, `i18n`, `hooks`, `sanitizeConfig`, and the rest, documented in [`formio-form`](../../../formio-form/references/options.md).

**Declare it at module scope or memoize it.** An inline `options={{ readOnly: true }}` is a new object every render and destroys and recreates the entire form instance. This is the single most common way an embedded form misbehaves — see [lifecycle.md](./lifecycle.md).

```tsx
const READ_ONLY = { readOnly: true };          // module scope
<Form src={formJson} options={READ_ONLY} />
```

## Substituting a renderer subclass

`FormClass` accepts a custom subclass of the renderer in place of the default, for an application that has extended `Webform` or `Wizard` itself. It is the only reason to pass a constructor; the definition's `display` already selects between the stock classes. `formioform` is its deprecated alias.

## Presentation

`className` and `style` apply to the container element the component renders. The form's own appearance comes from a stylesheet — see [styling.md](./styling.md).

## Rolling your own wrapper

`Form` is the way to embed. A hand-rolled wrapper around `Formio.createForm` in a `useEffect` is **not** a simpler equivalent: it has to re-implement the same lifecycle, and in practice re-implements it with the bugs the component already fixed.

If you genuinely cannot take the dependency, or you need the form mounted outside React's tree, a correct wrapper must:

1. Create the instance, `await instance.ready`, and `destroy(true)` on unmount.
2. Guard against the instance resolving **after** unmount — creation is asynchronous, and a component can unmount mid-build.
3. Guard the definition by equality before rebuilding, or an inline `src={{...}}` rebuilds the renderer every render.
4. Apply `submission` changes to the **live instance**, not as an effect dependency, or every data update becomes a teardown.

Note also that `onFormReady` already hands you the live `Webform` instance, so there is almost no renderer capability that bypassing the component unlocks. See [control.md](./control.md).
