# Lifecycle — what you must do, and why the component looks like this

Two parts, deliberately separated. Part one changes the code you write. Part two explains the component's internals and is background — read it when debugging, or when weighing a hand-rolled wrapper.

---

# Part one — what you must do

## Memoize anything in the create path

**Symptom.** The form flickers, loses focus mid-typing, resets what the user entered, or re-runs `onFormReady` constantly.

**Cause.** Instance creation is keyed on the form source, the constructor, `options`, and `url`. An `options` object whose *identity* changes on every parent render — an inline `options={{}}` — makes that key change, so the component destroys the instance and builds a new one. Every render.

**Remedy.** Give `options` stable identity — module scope is best — or apply the change to the live instance instead.

```tsx
const OPTIONS = { readOnly: true };                        // module scope: best

<Form src={formJson} options={OPTIONS} onFormReady={(i) => { ref.current = i; }} />
```

**This is a usage requirement, not a library defect.** Any effect-based renderer has it, a hand-rolled wrapper included: the effect keys on its dependencies either way.

## Changing `submission` is cheap — rely on it

**Symptom.** Contortions to avoid updating `submission`, or state mirrored elsewhere to dodge a rebuild that never happens.

**Cause.** The natural assumption is that `submission` behaves like the other props and rebuilds the form. It does not: it is applied to the **live instance** behind an equality check.

**Remedy.** Pass it and move on. Pre-fill it, update it as data loads, drive it from state.

## Clone form definitions you reuse

**Symptom.** Two forms on a page interfere; a form is subtly wrong the second time it mounts; a "default" definition accumulates fields.

**Cause.** The renderer and the builder mutate form definitions **in place**. A module-level definition object handed to more than one instance — or to one instance across a redraw — is a single shared reference being edited by each.

**Remedy.** Clone per instance before handing it over.

## StrictMode

React StrictMode double-invokes effects in development: mount, cleanup, remount. Vite's React template enables it by default, so most React applications run it.

**Verify the behaviour in your own application before concluding anything.** Mount a form with StrictMode on and look: does it render once, twice, or vanish? The interaction worth knowing about is that the component's liveness guard tests a mounted flag *after* the instance resolves, and a StrictMode remount sets that flag back to true before the first instance finishes — so two creates can be in flight against the same DOM node.

**Do not remove StrictMode to make a symptom go away.** It hides the defect in production rather than fixing it, and gives up the double-invocation check that surfaces other lifecycle bugs. If a form misbehaves under it, that is a cause to find and report upstream.

---

# Part two — background: why the component looks like this

Not instructions. Useful when debugging, or when evaluating a hand-rolled wrapper against what the component already handles.

- **Creation is guarded against unmount.** Building a form is asynchronous, so a component can unmount while one is mid-build. The component destroys an instance that resolves after its mount is gone, rather than leaking it.
- **`submission` is deliberately excluded from the create dependencies.** It has its own effect with an equality guard. Adding it back would convert every data update into a teardown — which is exactly the bug that exclusion fixed.
- **Previous instances are destroyed when a rebuild does happen.** The component does not leave orphaned renderers attached to the container.
