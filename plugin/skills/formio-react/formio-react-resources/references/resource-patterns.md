# Generated code, pattern by pattern

The kernel is written once at `src/formio/`; everything below is what a resource adds on top. Full semantics in [`kernel-contract.md`](./kernel-contract.md).

## The kernel's shape

```
src/formio/
  index.ts          re-exports everything below — per-resource files import ONLY from here
  config.ts         (generated at CONFIG, imported here) projectUrl, baseUrl — and sets the SDK globals
  urls.ts           resourceUrls
  parents.ts        applyParentContext, parentFilters
  permissions.ts    resourcePermissions
  drafts.ts         preserveDraftState
  loaders.ts        resourceListLoader, resourceItemLoader, resourceNewLoader
  actions.ts        resourceSaveAction, resourceDeleteAction
  routes.tsx        resourceRoutes, itemRouteOf, itemRouteId
  hooks.ts          useResourceItem — view/edit read the item route by id
  auth.ts           rootLoader, requireUser, currentUserOrNull
  types.ts          ResourceConfig, ParentBinding
```

## 1. Pure functions

```ts
// parents.ts — no react, no react-router imports
export function applyParentContext({ form, parents, parentSubmissions }) {
  const next = structuredClone(form);
  const submissionDefaults = {};
  for (const binding of parents) {
    let found = false;
    Utils.eachComponent(next.components, (component, path) => {
      if (component.key !== binding.field) return;
      component.hidden = true;
      component.clearOnHide = false;
      set(submissionDefaults, path, parentSubmissions[binding.field]);
      found = true;
    });
    if (!found) {
      throw new Error(
        `${form.name}: no component with key "${binding.field}". The template.json for ` +
        `this resource emitted no reference select for that relationship, so its list ` +
        `cannot be filtered. Fix the data model rather than generating an unfiltered list.`,
      );
    }
  }
  return { form: next, submissionDefaults };
}
```

The throw is the point. An unfiltered child list is a data-exposure failure, not a cosmetic one.

## 2. A resource config

```ts
// src/resources/customer/config.ts
import type { ResourceConfig } from '../../formio';

export const customer: ResourceConfig = {
  routePath: 'customer',
  param: 'customerId',
  // `form` is the form's path in template.json, copied verbatim.
  // Never derive it from the display name — a wrong value 404s every request.
  form: 'customer',
};
```

## 3. A simple resource's routes

```tsx
import { resourceRoutes } from '../../formio';
import { customer } from './config';
import { CustomerList, CustomerItem, CustomerView, CustomerEdit, CustomerNew } from './screens';

export const customerRoutes = resourceRoutes(customer, {
  list: <CustomerList />,
  new: <CustomerNew />,
  item: <CustomerItem />,
  view: <CustomerView />,
  edit: <CustomerEdit />,
});
```

`resourceRoutes` takes **screen overrides only**. It does not take a guard: protection is applied once, above these routes, by the protected layout route in [`app-integration.md`](./app-integration.md). Passing a `guard` key here does nothing — the kernel ignores unknown keys, so every route renders unprotected and nothing reports it.

Bare `resourceRoutes(config)` with no screen overrides is a red flag this skill never emits.

## 4. A screen over loader data

`view` and `edit` render **below** the item route and have no loader of their own, so they read the item route by id. `useLoaderData()` here would return `undefined` — it resolves against the route the component renders in, not the nearest ancestor with a loader.

```tsx
export function CustomerView() {
  const { form, submission } = useResourceItem(customer);
  return <Form src={form} submission={submission} options={READ_ONLY} />;
}

// Module scope, not inline. An inline object literal changes identity every
// render and destroys and recreates the whole form instance.
const READ_ONLY = { readOnly: true };
```

The item layout is the exception: it renders **at** the `:<param>` route, so it uses `useLoaderData()` — see pattern 7. So does the list screen, and so does `new`. Only the view/edit children need the hook.

## 5. Saving through an action

The `edit` child carries its own `action` (the same save action the item route uses), because `useActionData` is keyed to the route it is called from. Without it a rejected save returns its errors under the item route's id, this screen reads `undefined`, and the form appears to do nothing on submit — a silent failure, unlike the loader case which throws.

```tsx
export function CustomerEdit() {
  const { form, submission } = useResourceItem(customer);
  const errors = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  // One submit per submission. See "Latch the submit" below — this is a ref,
  // deliberately, not `navigation.state` and not a disabled button.
  const inFlight = useRef(false);
  useEffect(() => {
    if (!busy) inFlight.current = false; // released so a rejected save can retry
  }, [busy]);

  return (
    <>
      {errors ? <FormErrors errors={errors} /> : null}
      <Form
        src={form}
        submission={submission}
        onSubmit={(next) => {
          if (inFlight.current) return;
          inFlight.current = true;
          submit({ submission: JSON.stringify(next) }, { method: 'post' });
        }}
      />
    </>
  );
}
```

The renderer's `onSubmit` is the seam between the two idioms: it hands the submission to the router, and the action does the write and the redirect. No imperative navigation in the component.

### Latch the submit — and use a ref

`onSubmit` is a seam between two systems, and a handler that runs twice on a create route writes **two records**. That has happened in a shipped generated app: two rows, identical data, timestamps 2 ms apart.

Guard the outcome rather than any one cause. Several can produce it — a duplicated renderer listener, an event emitted twice, a stale handler surviving a hot reload, an impatient double-click — and they are hard to tell apart after the fact.

**The latch must be a `useRef`.** The duplicate arrives in the same tick, before React has re-rendered, so `navigation.state` is still `'idle'` and a disabled button has not yet disabled. Only a synchronous flag is read soon enough. Release it when the router settles, or a rejected save can never be retried.

Cheap, and the failure it prevents is a data-integrity one rather than a cosmetic one — duplicate records outlive the session that created them.

## 6. Delete without a route

```tsx
const fetcher = useFetcher();
// …in a confirmation dialog's confirm handler:
fetcher.submit({ intent: 'delete' }, { method: 'post' });
```

The item route's action branches on `intent`. No `/delete` path.

## 7. Item shell with permissions already resolved

```tsx
export function CustomerItem() {
  const { submission, permissions } = useLoaderData();
  return (
    <>
      <Breadcrumb />
      <nav>
        {/* The view screen is the item route's INDEX child, so it has no path
            of its own. `to="view"` would resolve to /customer/c1/view, which
            matches no route and drops the user on the errorElement. */}
        <NavLink to="." end>
          View
        </NavLink>
        {permissions.edit ? <NavLink to="edit">Edit</NavLink> : null}
        {permissions.delete ? <DeleteButton /> : null}
        <NavLink to="quote">Quotes</NavLink>
      </nav>
      <Outlet />
    </>
  );
}
```

Permissions come from the loader, so the controls render in their final state on the first paint.

## 8. Hierarchy and joins

Parent/child composition, filtering, and pre-fill: [`hierarchy.md`](./hierarchy.md).

A bidirectional join generates two subtrees around the same join form, each binding to the opposite side and composed under that side's item route. **Each subtree gets its own `ResourceConfig`** — same `form`, different `routePath` and `param`. Reusing one config for both mounts collides on the item route's id and `createBrowserRouter` refuses to build the router at all. When the join carries a Group Assignment action and end users create the group side at runtime, the group-creation path also writes the creator's membership row — creating a group confers no membership in it.
