# Worked example — a CRM, three levels deep

Planner output → Phase A plan → representative files. Customer → Quote → Line Item.

## Input

`template.md` declares three browsable resources. `Quote` has a `customer` reference select; `LineItem` has a `quote` reference select. Access: authenticated users only, records narrowed server-side.

`template.json` gives the form paths: `customer`, `quote`, `line-item` — note `line-item` is kebab-case while the resource is `LineItem`. That path is copied verbatim into `form`.

## Phase A plan (abridged)

```markdown
## Scaffolding Plan — CRM

**Workspace:** /Users/dev/crm   **Branch:** greenfield
**Project URL:** https://crm.form.io   **Base URL:** https://api.form.io

frontend-design consulted: yes — Bootstrap 5 brief applied; the quote item's
summary-header-plus-line-items layout and the status pill came from it

### Resources

| Resource | routePath | param | form | Parent bindings | Guard |
| --- | --- | --- | --- | --- | --- |
| Customer | customer | customerId | customer | — | auth |
| Quote | quote | quoteId | quote | customer (filter + prefill) | auth |
| LineItem | line-item | lineItemId | line-item | quote (filter + prefill) | auth |

### Route tree

/customer
/customer/:customerId
/customer/:customerId/quote
/customer/:customerId/quote/new
/customer/:customerId/quote/:quoteId
/customer/:customerId/quote/:quoteId/line-item
/customer/:customerId/quote/:quoteId/line-item/new
/customer/:customerId/quote/:quoteId/line-item/:lineItemId

### Screen sketches

Customer item — name as heading, contact block, quote count; tabs View / Edit / Quotes
Quote list    — number, status pill, total, created; empty state "No quotes for this customer yet"
Quote item    — summary header, then the line-item list inline
```

Then the gate. Nothing is written until it is approved.

## Phase B — the configs

```ts
// src/resources/customer/config.ts
export const customer: ResourceConfig = {
  routePath: 'customer', param: 'customerId', form: 'customer',
};

// src/resources/quote/config.ts
import { customer } from '../customer/config';
export const quote: ResourceConfig = {
  routePath: 'quote', param: 'quoteId', form: 'quote',
  parents: [{ resource: customer, field: 'customer' }],
};

// src/resources/line-item/config.ts
import { quote } from '../quote/config';
export const lineItem: ResourceConfig = {
  routePath: 'line-item', param: 'lineItemId', form: 'line-item',
  parents: [{ resource: quote, field: 'quote' }],
};
```

`form: 'line-item'` is the `template.json` path; `param: 'lineItemId'` is derived from the resource. They differ, and both are correct.

## Composition

```ts
const customerRoutes = resourceRoutes(customer, customerScreens);
const quoteRoutes    = resourceRoutes(quote, quoteScreens);
const lineItemRoutes = resourceRoutes(lineItem, lineItemScreens);

itemRouteOf(quoteRoutes).children.push({ path: lineItem.routePath, children: lineItemRoutes });
itemRouteOf(customerRoutes).children.push({ path: quote.routePath, children: quoteRoutes });

export const appRoutes = [{ path: customer.routePath, children: customerRoutes }];
```

The third level composes exactly like the second.

## What runs at `/customer/c1/quote/new`

1. `resourceNewLoader(quote)` loads the quote form, reads `params.customerId` = `c1`, fetches customer `c1`.
2. `applyParentContext` hides the `customer` component and writes the whole customer submission into the defaults at its resolved path.
3. The screen renders a quote form with no customer picker visible.
4. Submit → `resourceSaveAction(quote)` → `redirect('/customer/c1/quote/<new id>')`.

At `/customer/c1/quote`, `parentFilters` yields `data.customer._id = c1`, so the list shows only that customer's quotes.

## Closing check

Serve, sign in at `/login`, load `/customer/c1/quote/new`, confirm the URL is that route and not the login redirect, and confirm the content sits inside the shell's gutters. StrictMode is on; a development double-invocation is expected and is not disabled to make the page look right.
