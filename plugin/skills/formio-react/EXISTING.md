# EXISTING — adding Form.io work to a React application that already exists

The existing-application branch. This is **not** a greenfield run with steps skipped: the decisions here are integration decisions, and they only get made if you begin by inspecting and reporting rather than by ticking prerequisites off a list.

`BOOTSTRAP.md` never runs on this branch, and no workspace is scaffolded.

## 1. Inspect, and report before changing anything

Report all of the following before modifying a single file:

- **Router style.** Does the application route through React Router's **data-router** API (`createBrowserRouter`), or through `<BrowserRouter>` with `<Routes>` alone? See step 2 — this one is a gate.
- **Packages.** Are `@formio/react` and `@formio/js` installed, and at what versions?
- **Renderer stylesheets — both of them.** `@formio/js/dist/formio.form.css` carries the `.formio-*` and `.choices*` rules, and a Bootstrap 5 stylesheet supplies the classes the default template emits. An application that predates this guidance commonly has the Bootstrap half and not the renderer's own, which renders every reference select as an unstyled list. Check for each separately; a form missing either looks broken rather than erroring.
- **Provider.** Is `FormioProvider` mounted, and against which project URL?
- **Authentication.** Is there an existing auth surface and a current-user source?
- **Design conventions.** What design system, file layout, and naming does the application already use?

State what you found. Then backfill ONLY what is missing.

## 2. The data-router gate

The generated resources require loaders and actions. An application on `<Routes>` alone cannot host them.

Detect this **before writing any file**. On detection, explain the constraint plainly and offer, in ONE question round, either converting the application's routing to `createBrowserRouter` or stopping.

**Never migrate routing without that explicit approval.** Routing is shared infrastructure the whole application depends on, and a silent migration is a change nobody asked for. If the user declines, stop and say what is blocked.

## 3. Backfill only what is missing

- **No provider** → load [`CONFIG.md`](./CONFIG.md).
- **No auth surface** → load [`AUTH.md`](./AUTH.md).
- **Provider or auth already present** → leave them alone.

**Integrate with what exists; do not replace it.** Leaving a satisfied prerequisite alone is not the same as ignoring it. An application with its own authentication gets no second login surface generated — `AUTH.md` does not run — but the generated resource routes still have to protect themselves through that existing mechanism, so record its current-user source in the handoff and wire the generated code to it. An application with an established design language does not need `frontend-design` skipped either — it needs composition within that language. Where integration genuinely is not possible, raise it with the user rather than overwriting.

## 4. Hand off

Load [`formio-react-resources/SKILL.md`](./formio-react-resources/SKILL.md) by path, with `branch: 'existing'` and the inspection findings in the payload. The sub-skill generates different code for an application whose auth and layout it must integrate with than for one the greenfield chain just wrote, and it cannot tell the two apart from a workspace path alone.

## Gate

End with the approval gate: what was found, what will be backfilled, and what will be left alone. Proceed only on approval.
