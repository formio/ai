# Rendering a form

```html
<formio [src]="formUrl" (submit)="onSubmit($event)" [renderOptions]="renderOptions"></formio>
```

```ts
import { FormioComponent } from '@formio/angular';
```

`FormioModule` re-exports the component too, but importing the standalone component alone lets the form builder's much larger stylesheet tree-shake out. Put it in the `imports` of whichever standalone component or NgModule hosts the template.

## Which source wins

Three bindings take the definition, and the choice decides who fetches it:

| Binding | Who fetches the definition |
| --- | --- |
| `[src]="'https://…/yourform'"` | **the component**, through its own `FormioService`, on mount |
| `[form]="definitionObject"` | **your application** — you loaded it, the component just renders it |
| `[url]="'https://…/yourform'"` | nobody; it sets the instance's URL, alongside a `[form]` you supply |

A `[src]` URL that includes a submission id (`…/yourform/submission/<id>`) also loads that submission, so a view or edit screen needs no separate fetch.

The definition is loaded with `{ params: { live: 1 } }` — the published revision. On a project using form revisions that is deliberately not the same as the draft you may be looking at in the portal.

Decide deliberately which owns fetching. A URL `[src]` is right for a standalone embed. An object `[form]` is right whenever the surrounding application already has the definition — a route resolver, a store, a parent that reloads it — because then one thing owns loading and re-loading.

## Who saves the submission

The question that most often gets answered wrong, and it turns on which binding you used rather than on anything you configure. The component always takes the renderer out of the posting business — `setForm` sets the renderer's `nosubmit` flag unconditionally — and then decides for itself whether to save, based on whether it has a `FormioService` (it does when you gave it `[src]`) and whether you also set `[url]`.

| Bindings | What `(submit)` means |
| --- | --- |
| `[src]` = URL | the component **already posted** the submission through `FormioService`; `(submit)` carries the saved record |
| `[form]` = object, no `[url]` | nothing was posted; `(submit)` hands you validated data to save yourself |
| `[form]` = object **and** `[url]` | nothing was posted — setting `[url]` is what tells the component not to save, so the save is yours |

So `[src]` means "the form talks to the server", and `[form]` — with or without `[url]` — means "you talk to the server". `[url]` alongside `[form]` is still worth setting: it is what lets file uploads, resource-backed selects, and nested forms resolve against the right project.

**Confirm which one you are in before writing the handler.** A handler that saves a record after an `[src]`-mounted form has already saved it writes the record twice.

This is also why the generated CRUD screens bind `[form]` rather than `[src]`: their service owns the save, so the component must not.

## Pre-filling

`[submission]` populates an existing submission:

```html
<formio [src]="formUrl" [submission]="prefill"></formio>
```

It is a reactive input, and a cheap one: a new value after the first render is applied to the live instance through `setSubmission` rather than rebuilding the form, so driving it from state as data loads does not tear the renderer down or lose focus. See [lifecycle.md](./lifecycle.md).

## Options — two channels, and picking the wrong one is silent

This is the single most common way an option "does nothing".

- **`[options]`** configures the **component**: `errors.message`, `alerts.submitMessage`, `disableAlerts`, `alertsPosition`, and `hooks.beforeSubmit`. Of the renderer's own options it forwards only a whitelist — `noAlerts`, `i18n`, `fileService`. Anything else you put here is **silently dropped** before the renderer sees it. `alertsPosition` takes the `AlertsPosition` enum exported by `@formio/angular` (`top`, `bottom`, `both`, `none`), not a string — the template compares it by identity, so a string renders no alerts at all. `disableAlerts: true` is the readable way to say `none`.
- **`[renderOptions]`** is the pass-through, merged last into the renderer options. Every renderer-intended option belongs here: `sanitizeConfig`, `buttonSettings`, `breadcrumbSettings`, `saveDraft`, `templates`, `icons`, `language`, `zoom`, and the rest of [`formio-form`'s options reference](../../../formio-form/references/options.md).

```html
<formio
  [src]="formUrl"
  [options]="componentOptions"
  [renderOptions]="renderOptions"
></formio>
```

Two more inputs write renderer options directly: `[readOnly]`, and `[viewOnly]` (which also switches the renderer to `renderMode: 'html'`). **`[renderOptions]` is merged last and therefore wins over both** — `getRendererOptions()` builds its defaults, including `readOnly` from the input, and then spreads `renderOptions` on top. So `[readOnly]="true"` with `[renderOptions]="{ readOnly: false }"` gives an editable form, and if a `[readOnly]` binding appears to do nothing, that collision is the first thing to check. Pick one channel per option rather than setting the same thing twice. `[hideComponents]` takes an array of component keys and is applied reactively; it has no `renderOptions` counterpart to collide with.

### The two `beforeSubmit` hooks are different hooks

Same name, different jobs, and nothing warns you:

- **`[hooks]`** is handed straight to the renderer — the renderer's own hook set (`beforeSubmit`, `beforeCancel`, `beforeNext`, `attachComponent`, `customValidation`, …).
- **`[options].hooks.beforeSubmit`** is the **component's** hook. It is callback-style — `(submission, callback) => …` — runs before the component's own save, and can substitute the submission or fail it with an error that goes through the component's error placement.

For "validate against my API, then save, or show the message on the field", the second is the one you want.

## Declare options objects on the class

An `[options]` or `[renderOptions]` object literal written inline in a template is a new object on every change-detection pass, and `ngOnChanges` compares identity. Put them on the component class or at module scope and bind the field:

```ts
import type { Submission } from '@formio/core/types';

readonly renderOptions = { icons: 'bi' };

beforeSubmit(submission: Submission, callback: (err: unknown, sub?: Submission) => void) {
  callback(null, submission);
}

readonly componentOptions = {
  disableAlerts: true,
  hooks: { beforeSubmit: (submission, callback) => this.beforeSubmit(submission, callback) },
};
```

**Bind the hook.** The component calls it as a bare function, so a plain `beforeSubmit: this.beforeSubmit` reference arrives with `this` undefined and throws on the first `this.` inside it — at submit time, on the one path the hook exists for. An arrow wrapper (above) or `this.beforeSubmit.bind(this)` both fix it; a method reference alone does not.

## Wizards and PDFs

Mounting is **agnostic to how a form displays**. A form built as a wizard or a PDF in the Form.io portal renders as one through the same `<formio [src]="…">` — the definition carries its own `display`, and the renderer picks the right class from it. Nothing changes on the Angular side, and there is no display to select at embed time.

PDF rendering additionally needs the project's PDF server; the endpoint and project requirements belong to [`formio-api`](../../../formio-api/SKILL.md).

### Driving a wizard from your own UI

Where Angular does get involved is when the application wants to **own the wizard's flow** — its own Next and Back buttons, a progress indicator in the page chrome, a step counter in the header. Three pieces, each doing one job.

**1. Hide the renderer's own navigation** so yours is the only one, through `buttonSettings` in `[renderOptions]`. Add `breadcrumbSettings: { clickable: false }` when users must move strictly forward.

```ts
readonly renderOptions = {
  buttonSettings: { showPrevious: false, showNext: false, showCancel: false, showSubmit: false },
};
```

**2. Drive the flow from the instance.** `nextPage()`, `prevPage()`, `setPage(i)`, and `submit()` are `Wizard` methods, reached through the instance — [control.md](./control.md) has both ways to get hold of it. `nextPage()` validates the current page first and rejects if it fails, leaving the wizard where it is with the errors rendered, so awaiting it is also your gate.

```ts
import type { Webform } from '@formio/js';

// `Wizard` is not exported by @formio/js and its deep path is not in the package's
// `exports` map, so name the methods you use structurally rather than importing it.
type WizardInstance = Webform & {
  nextPage(): Promise<void>;
  prevPage(): Promise<void>;
  setPage(page: number): Promise<void>;
};

private wizard: WizardInstance | null = null;   // captured via formioReady — see control.md

async next() {
  await this.wizard?.nextPage();
}
```

**3. Track the page** from the component's own outputs: `(nextPage)`, `(prevPage)`, and `(page)`, the last carrying `{ currentPage, component }`. These are bridged into Angular for you, unlike a handler you register on the instance — see [change-detection.md](./change-detection.md).

The page API, conditional pages, and the wizard events in full are documented once, for every host, in [`formio-form`'s wizards reference](../../../formio-form/references/wizards.md); this section only covers the Angular wiring around them.

## Substituting a renderer subclass

`[renderer]` accepts a custom subclass of the renderer in place of the default `Form`, for an application that has extended `Webform` or `Wizard` itself. It is the only reason to pass a constructor — the definition's `display` already selects between the stock classes — and it is worth trying before concluding you need to mount the renderer yourself ([renderer-directly.md](./renderer-directly.md)).

## Presentation

The container the component renders is a `<div role="form">` with the form's title as its `aria-label`; put your own classes on the `<formio>` element or its parent. The form's own appearance comes from a stylesheet, and one of the two you need is already on the page — see [styling.md](./styling.md).
