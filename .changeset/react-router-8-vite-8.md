---
'@formio/ai': patch
---

Bring `formio-react` up to the stack its unpinned installs resolve today: React Router 8, Vite 8, `@vitejs/plugin-react` 6, and TypeScript 6.

React Router 8 removed the `react-router-dom` package and every v7 `future` flag, and hard-requires Node 22.22+ and React 19.2.7+. `BOOTSTRAP.md` now imports `RouterProvider` from `react-router/dom` and everything else from `react-router`, forbids `react-router-dom` and `future` flags, and states both floors — reporting a lower Node or React rather than pinning the router back a major. It also records why the bare stylesheet imports type-check: TypeScript 6 enables `noUncheckedSideEffectImports`, so without the template's `"types": ["vite/client"]` every `import '….css'` fails with TS2882. The resources sub-skill's router assembly names the same `RouterProvider` import.

`EXISTING.md` adds the router package and major to the inspection, generates `react-router-dom` imports for an application still on 6.4+, and never bumps the router major without approval, since v8 drags the React and Node floors with it.

`formio-react-form`'s `environments.md` installs the plugin-react major that matches the workspace's Vite (`^6` for Vite 8, `^5` for Vite 4–7): plugin-react 6 peers on Vite 8 only, so the previous unpinned install failed peer resolution in every older workspace.

The eval seed moves to React 19.3, React Router 8.4, Vite 8.3, plugin-react 6.1, and TypeScript 6.0, and gains the `vite/client` types it needed to type-check under TypeScript 6.
