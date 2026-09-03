---
'@formio/ai': minor
---

Add the `formio-react` skill family — a React framework implementor alongside `formio-angular`.

`formio-react` routes between three branches: a greenfield Vite + React Router build, adding Form.io CRUD to a React application that already exists, and embedding a single form. `@formio/react` ships no equivalent of `@formio/angular`'s `FormioResource` module, so `formio-react-resources` generates a small resource kernel into the user's application — pure domain functions plus React Router loader and action factories — rather than porting Angular's service, registry, alert bus, and refresh emitter. `formio-react-form` owns React-specific mounting; definition-level behaviour stays with `formio-form`, which now checks the host before writing mounting code.

React is a second row in `formio-application`'s `FRAMEWORK.md` registry, with a `Default` column, so a greenfield build asks which framework and falls back to Angular when the user declines to choose.
