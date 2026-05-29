## Overview

Component-tree traversal and search. The Form.io component schema is recursive (containers nest components, datagrids nest rows of components, etc.). `Utils.eachComponent`, `Utils.eachComponentData`, `Utils.getComponent`, `Utils.findComponent`, `Utils.flattenComponents`, and `Utils.searchComponents` are the canonical helpers. Sourced from `packages/core/src/utils/formUtil/index.ts` (core implementations) and `packages/formio.js/src/utils/formUtils.js` (re-exports for `@formio/js/utils`) in the Form.io source code.

## Imports

```ts
import { Utils } from '@formio/js/utils';
```

## API

Traversal:

- `Utils.eachComponent(components, fn, includeAll?, parentPaths?, parent?): void` — iterate every component depth-first. `fn(component, path, components, parent, paths)` returning `true` stops the descent into that component's children.
- `Utils.eachComponentData(components, data, fn, includeAll?, local?, parent?, parentPaths?, noScopeReset?, afterFn?, localRoot?): void` — same as `eachComponent` but exposes the contextual row of data at every level (handles `datagrid`, `editgrid`, nested `form`).
- `Utils.eachComponentAsync(components, fn, includeAll?, parentPaths?, parent?): Promise<void>` — async variant; `fn` may return a Promise.
- `Utils.eachComponentDataAsync(...): Promise<void>` — async data-aware variant.

Search:

- `Utils.getComponent(components, path | query, includeAll?, dataIndex?): Component | undefined` — find by string key/path or by `{ type: 'email' }`-style query.
- `Utils.getComponentFromPath(components, path, data?, dataIndex?, includeAll?): { component, paths } | undefined` — fuzzy path resolution (`data.row[0].firstName` → component).
- `Utils.searchComponents(components, query): Component[]` — return every component matching the query object (`{ disabled: true }`, `{ type: 'textfield', input: true }`).
- `Utils.findComponent(components, key, path, fn): void` — legacy callback search; resolves a path array via the callback.
- `Utils.findComponents(components, query): Component[]` — deprecated alias for `searchComponents`.

Flatten / value lookup:

- `Utils.flattenComponents(components, includeAll?): { [path: string]: Component }` — return a path-to-component map keyed by the component's data path.
- `Utils.getComponentData(components, data, path): { component, data }` — return the component plus the contextual row of data for that path.
- `Utils.getComponentValue(form, data, path, dataIndex?, local?): any` — fetch the value at `path` from the submission data, respecting nested containers.
- `Utils.getComponentKey(component): string` — return the data key (`key` for most components, special-cased for `radio`).

Paths and model types:

- `Utils.getComponentPath(component, parent?, parentPaths?): string` — derive the canonical path.
- `Utils.getComponentPaths(component, parent?, parentPaths?): ComponentPaths` — return every path variant (`path`, `fullPath`, `dataPath`, `localPath`, …).
- `Utils.getModelType(component): 'nestedArray' | 'nestedDataArray' | 'dataObject' | 'object' | 'map' | 'content' | 'string' | 'number' | 'boolean' | 'none' | 'any'` — classify the component's data model.
- `Utils.componentInfo(component): { hasColumns, hasRows, hasComps, layout, iterable }` — structural metadata.

Mutation helpers:

- `Utils.removeComponent(components, path): void` — remove by path array.
- `Utils.applyFormChanges(form, changes): { form, failed }` — apply add / edit / remove change objects.
- `Utils.generateFormChange(type, data): object | null` — produce a change object.

## Examples

### Walk every component

```ts
import { Utils } from '@formio/js/utils';

Utils.eachComponent(form.components, (component, path) => {
  console.log(path, component.type, component.key);
});
```

### Walk components alongside their data

The callback receives `(component, contextualData, row, path)`. `contextualData` is the full submission `data` tree; `row` is the contextual row at the current path (e.g., the datagrid row for nested components). To read the value of the current component, index into `row`, not `contextualData`.

```ts
import { Utils } from '@formio/js/utils';

Utils.eachComponentData(form.components, submission.data, (component, _data, row, path) => {
  console.log(path, '=', row[component.key]);
});
```

### Find a component by key

```ts
import { Utils } from '@formio/js/utils';

const email = Utils.getComponent(form.components, 'email');
if (email) email.label = 'Work Email';
```

### Query components by attribute

```ts
import { Utils } from '@formio/js/utils';

const required = Utils.searchComponents(form.components, { 'validate.required': true });
console.log('required fields:', required.map((c) => c.key));
```

### Flatten to a path map

```ts
import { Utils } from '@formio/js/utils';

const map = Utils.flattenComponents(form.components);
console.log(Object.keys(map));
```

### Read a value at a deep path

`getComponentValue` expects the path **without** the leading `data.` prefix — it indexes from the root of the submission's data object.

```ts
import { Utils } from '@formio/js/utils';

const value = Utils.getComponentValue(form, submission.data, 'address.line1');
console.log(value);
```

### Async traversal with side effects

```ts
import { Utils } from '@formio/js/utils';

await Utils.eachComponentAsync(form.components, async (component, path) => {
  if (component.type === 'select' && component.data?.url) {
    component.data.values = await fetch(component.data.url).then((r) => r.json());
  }
});
```

### Stop descent into hidden containers

`eachComponent` skips layout components (`panel`, `fieldset`, `well`, etc.) by default — pass `true` as the third argument (`includeAll`) so the callback fires for layout components and `return true` can actually short-circuit the descent.

```ts
import { Utils } from '@formio/js/utils';

Utils.eachComponent(
  form.components,
  (component) => {
    if (component.hidden) {
      return true; // skip children of hidden containers
    }
  },
  true,
);
```
