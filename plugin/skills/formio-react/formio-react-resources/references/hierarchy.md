# Hierarchical resource applications

`/customer/:customerId/quote/:quoteId/line-item/:lineItemId` — each level's list filtered to its ancestor, each create screen pre-filled with it. This is the shape most Resource Maps produce.

## 1. One param per resource, named after the resource

```ts
export const customer = { routePath: 'customer', param: 'customerId', form: 'customer' };
export const quote    = { routePath: 'quote',    param: 'quoteId',    form: 'quote', parents: [{ resource: customer, field: 'customer' }] };
```

`param` is distinct across the whole tree. This is load-bearing, not cosmetic: Angular's nested resource routes all use `:id`, so a child's params shadow its parent's and the child cannot read its ancestor's id at all — which is the entire reason `FormioResources` exists there as a DI side channel. Name them apart and every ancestor id is present in `params` at every depth.

A bare `:id` at two levels produces a route that cannot address its own parent.

## 2. Bind ancestors by config reference

`parents: [{ resource: customer, field: 'customer' }]`

- **`resource`** — the ancestor's config object, imported. Not a string. A wrong reference is a build error, not a runtime 404.
- **`field`** — the `key` of the component in **this** resource's form that holds the reference.
- **`filter`** — defaults to `true`. Set `false` to pre-fill without narrowing the list.

The ancestor's param name comes from the referenced config, so it is never restated.

**Precondition on the data model:** the child's form must contain a reference component whose `key` equals `field`. The planner emits it. When it is missing, stop and report which relationship the map lacks — do not generate a resource whose list cannot be filtered.

## 3. Compose the route arrays

```ts
const customerRoutes = resourceRoutes(customer, { /* screens */ });
const quoteRoutes    = resourceRoutes(quote,    { /* screens */ });

// the item route is the one at ':<param>'
itemRouteOf(customerRoutes).children.push({ path: quote.routePath, children: quoteRoutes });
```

Routes are plain values, so this is ordinary array composition — and it is identical at the third level:

```ts
itemRouteOf(quoteRoutes).children.push({ path: lineItem.routePath, children: lineItemRoutes });
```

No decorator mutation, no registration side effect, no depth cap.

## 4. What the user gets at each route

| Route | Screen |
| --- | --- |
| `/customer` | customer list |
| `/customer/:customerId` | customer item shell, with `<Outlet />` |
| `/customer/:customerId/quote` | quote list, **filtered to that customer** |
| `/customer/:customerId/quote/new` | quote create, **customer pre-filled and hidden** |
| `/customer/:customerId/quote/:quoteId` | quote item, inside the customer's chrome |

**Filtering.** `parentFilters` produces `data.<resolved path>._id = params.customerId`. The path is the component's resolved data path, not its `key` — they differ when the component sits inside a container.

**Pre-filling.** `applyParentContext` hides the reference component (`hidden: true`, `clearOnHide: false`) and writes the **whole ancestor submission object** into the new submission's defaults. The whole object, not the id: that is what a resource-select stores, and what makes `data.<path>._id` a valid query against saved records.

The `submissionDefaults` it returns is a **data** object, keyed by the component's resolved path — so the create screen mounts it as `<Form src={form} submission={{ data: submissionDefaults }} />`. Passing it straight to `submission` hands the renderer a submission with no `data` key, the reference stays empty, and the record saves with no ancestor at all.

**Only create fetches the ancestor.** A filter-only binding needs the id alone, which is already in `params`.

**Edit verifies rather than overwrites.** No kernel export does this for you — `resourceItemLoader` returns the stored submission untouched, so it is the **generated edit screen's** job: hide the reference component the same way `applyParentContext` does, leave the stored value exactly as saved, and surface a mismatch between the stored ancestor id and `params[parent.resource.param]` as an error rather than correcting it. Angular re-sets the parent from the route on every load, which silently rewrites the relationship when a record is reached through the wrong ancestor's URL.

## 5. Chrome and breadcrumbs

Child screens render inside the parent item route's layout `<Outlet />`, so the parent's heading and navigation stay on screen. Each item layout links its own child resources, so a hierarchy is navigable without hand-written URLs.

A deep route no longer shows where it sits, so the item layout renders a breadcrumb built from the declared ancestor chain, each segment linking to that ancestor's item route.

## 6. The current user as an ancestor

```ts
parents: [{ resource: 'currentUser', field: 'user', filter: false }]
```

Pre-fills the named component with the user from the root loader and hides it — author-stamping. That is the **only** thing this binding does, and `filter` must be `false`.

### "My records" is server-side. Do not filter for it in the client.

The deployment already scopes the list. When the requesting user lacks `read_all` on the form, the server injects an owner clause into both the query and the count before either runs, so a plain list request comes back containing only that user's records. Three mechanisms do this, and each also ORs in the requester's own submissions:

| Mechanism | Configured by | Scopes the list to |
| --- | --- | --- |
| Owner filter | `read_own` in the form's `submissionAccess` | records the user created |
| Resource access | field-based `submissionAccess` on a reference select | records whose `access` array names the user or one of their roles — this is how group and team membership scopes a list |
| Field match | the form's `fieldMatchAccess` conditions | records matching those conditions |

So a "my records" view needs **no client-side filter at all**. Ask for the list; the server has already narrowed it.

Filtering in the client instead is wrong twice. It is redundant when the access rules are set, because the server has already applied them. And it is actively misleading when they are not: if the user holds `read_all`, a client-side `data.user._id` clause is the *only* thing hiding everyone else's records, and it is one edited request away from being gone. A filter that looks like a boundary but is not is worse than no filter.

The access rules belong to the data model, so they are the planner's output and `formio-api`'s subject — not something this skill generates.

## Route matching note

`/customer/:customerId/quote/new` matches the `new` route, not the item route with `quoteId` of `"new"` — React Router ranks static segments above dynamic ones.
