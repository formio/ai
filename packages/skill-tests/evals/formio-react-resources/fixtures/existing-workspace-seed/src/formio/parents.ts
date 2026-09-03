// No react, no react-router imports — pure domain logic.
import { Utils } from '@formio/js';
import type { ParentBinding } from './types';

type FormJson = { name?: string; components: unknown[] };

function set(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let cursor = target;
  for (const key of keys.slice(0, -1)) {
    cursor[key] = cursor[key] ?? {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

/**
 * Resolved DATA path of the component whose `key` matches `field`.
 *
 * `includeAll` is deliberately left off: with it on, `eachComponent` yields
 * `fullPath`, which carries every enclosing layout component's key — a select
 * inside a panel comes back as `panel1.customer` rather than `customer`, and a
 * query keyed on that path matches no stored record. Layout components are still
 * recursed into either way; only the callback for them is skipped.
 */
export function referencePath(form: FormJson, field: string): string | undefined {
  let found: string | undefined;
  Utils.eachComponent(form.components, (component: { key?: string }, path: string) => {
    if (component.key === field && found === undefined) found = path;
  });
  return found;
}

export function applyParentContext({
  form,
  parents = [],
  parentSubmissions,
}: {
  form: FormJson;
  parents?: ParentBinding[];
  parentSubmissions: Record<string, unknown>;
}) {
  const next = structuredClone(form);
  const submissionDefaults: Record<string, unknown> = {};
  for (const binding of parents) {
    let found = false;
    // No `includeAll` — the defaults are written at the component's DATA path,
    // and `includeAll` would hand back the full path with layout keys in it.
    Utils.eachComponent(
      next.components,
      (component: { key?: string; hidden?: boolean; clearOnHide?: boolean }, path: string) => {
        if (component.key !== binding.field) return;
        component.hidden = true;
        component.clearOnHide = false;
        set(submissionDefaults, path, parentSubmissions[binding.field]);
        found = true;
      }
    );
    if (!found) {
      throw new Error(
        `${form.name}: no component with key "${binding.field}". The template.json for ` +
          `this resource emitted no reference select for that relationship, so its list ` +
          `cannot be filtered. Fix the data model rather than generating an unfiltered list.`
      );
    }
  }
  return { form: next, submissionDefaults };
}

/** Keyed on the reference component's RESOLVED path, never its `key`. */
export function parentFilters({
  form,
  parents = [],
  params,
}: {
  form: FormJson;
  parents?: ParentBinding[];
  params: Record<string, string | undefined>;
}) {
  const query: Record<string, string> = {};
  for (const binding of parents) {
    if (binding.filter === false) continue;
    const path = referencePath(form, binding.field);
    if (!path) {
      throw new Error(
        `no component with key "${binding.field}" — refusing to list this resource unfiltered`
      );
    }
    if (binding.resource === 'currentUser') {
      // A currentUser binding is prefill only. "My records" is scoped by the
      // deployment: without `read_all`, the server injects an owner clause into
      // the list query itself. Filtering here would be redundant at best, and a
      // boundary that isn't one at worst.
      throw new Error(
        'a currentUser binding cannot filter — set `filter: false`, and scope ' +
          "the list with the form's submissionAccess instead"
      );
    }
    const id = params[binding.resource.param];
    if (!id) {
      throw new Error(
        `no route param "${binding.resource.param}" for the ${binding.field} ancestor — ` +
          'refusing to list this resource unfiltered'
      );
    }
    query[`data.${path}._id`] = id;
  }
  return query;
}
