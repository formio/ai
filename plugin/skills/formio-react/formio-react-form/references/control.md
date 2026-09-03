# Controlling the form from React

Two ways in, and they answer different needs.

## 1. Events as props

The component maps the renderer's `formio.*` events onto `on*` props:

`onChange`, `onSubmit`, `onSubmitDone`, `onSubmitError`, `onNextPage`, `onPrevPage`, `onCancelSubmit`, `onCancelComponent`, `onCustomEvent`, `onComponentChange`, `onFormLoad`, `onError`, `onRender`, `onAttach`, `onBuild`, `onFocus`, `onBlur`, `onInitialized`, `onLanguageChanged`, `onBeforeSetSubmission`, `onSaveDraftBegin`, `onSaveDraft`, `onRestoreDraft`, `onSubmissionDeleted`, `onRequestDone`.

```tsx
<Form
  src={formJson}
  onSubmit={(submission) => save(submission)}
  onSubmitError={(error) => report(error)}
/>
```

### Events with no prop

`otherEvents` takes a map keyed by raw event name, for anything not in the list above — including custom events a form definition emits:

```tsx
<Form src={formJson} otherEvents={{ 'formio.myCustomThing': (payload) => handle(payload) }} />
```

This is the documented escape hatch. Reach for it before concluding an event is unreachable.

## 2. The live instance — the form controller

This is the most important pattern in `@formio/react`. `onFormReady` hands back the live `Webform` instance, and holding onto it is what lets an application do everything it needs to with a form: read and set values, submit, validate, redraw, subscribe to events, reach any renderer API. Think of it as the form's controller.

Hold it in a **ref**:

```tsx
const formInstance = useRef<Webform | null>(null);

<Form src={formJson} onFormReady={(instance) => { formInstance.current = instance; }} />

function fillName() {
  if (!formInstance.current) return;          // not ready yet — guard every use
  formInstance.current.getComponent('firstName')?.setValue('Ada');
}
```

(`formReady` is this prop's deprecated alias, as `formioform` is the deprecated alias of `FormClass`.)

That reaches the imperative renderer APIs with no prop equivalent: `getComponent(...)`, `submit()`, validation state, redraws.

**A ref, not state.** Storing the instance in `useState` triggers a render every time a form loads, and the instance is not render-relevant data — nothing in your JSX derives from it.

**Guard for not-yet-ready.** The instance arrives asynchronously, so any handler that can fire before the form finishes building must tolerate `null`.

## Reading and writing submission data

- **Reading as the user types:** `onChange`.
- **Reading on submit:** `onSubmit` receives the submission.
- **Writing:** pass a new `submission` prop — cheap, applied to the live instance — or use the instance's `getComponent(key)?.setValue(...)` for a single field.

Do not mirror the whole submission into React state on every `onChange` unless something actually renders from it; the renderer already owns that state.
