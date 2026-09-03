import { Outlet, type RouteObject } from 'react-router';
import { resourceItemLoader, resourceListLoader, resourceNewLoader } from './loaders';
import { resourceDeleteAction, resourceSaveAction } from './actions';
import type { ResourceConfig } from './types';
import type { ReactElement } from 'react';

/**
 * Rendered surfaces only. There is deliberately no `guard` key: protection is
 * applied once, above the whole subtree, at the pathless protected layout route.
 * A per-call guard is five chances to miss one, and a missed one fails silently.
 */
export type ResourceScreens = {
  list?: ReactElement;
  new?: ReactElement;
  item?: ReactElement;
  view?: ReactElement;
  edit?: ReactElement;
  errorElement?: ReactElement;
};

/** Stable route id, so view/edit children can read the item route's data. */
export function itemRouteId(config: ResourceConfig) {
  return `${config.routePath}-item`;
}

/**
 * The `:<param>` route inside a `resourceRoutes` array.
 *
 * The return type declares `children` present, not optional, because this
 * function has just guaranteed it. `RouteObject` alone types it `| undefined`,
 * so the composition every hierarchy uses — `itemRouteOf(x).children.push(...)`
 * — would not compile.
 */
export function itemRouteOf(routes: RouteObject[]): RouteObject & { children: RouteObject[] } {
  const item = routes.find((route) => route.path?.startsWith(':'));
  if (!item) throw new Error('no item route in this resource route array');
  item.children ??= [];
  return item as RouteObject & { children: RouteObject[] };
}

export function resourceRoutes(
  config: ResourceConfig,
  screens: ResourceScreens = {}
): RouteObject[] {
  const save = resourceSaveAction(config);
  return [
    {
      index: true,
      element: screens.list,
      loader: resourceListLoader(config),
      errorElement: screens.errorElement,
    },
    {
      path: 'new',
      element: screens.new,
      loader: resourceNewLoader(config),
      action: save,
      errorElement: screens.errorElement,
    },
    {
      path: `:${config.param}`,
      id: itemRouteId(config),
      element: screens.item ?? <Outlet />,
      loader: resourceItemLoader(config),
      // `save` branches on the `intent` field; wiring the delete action here
      // directly would make EVERY post to the item route delete the record.
      action: save,
      errorElement: screens.errorElement,
      children: [
        { index: true, element: screens.view },
        // Its own action, so `useActionData` in the edit screen is keyed here.
        { path: 'edit', element: screens.edit, action: save },
      ],
    },
  ];
}
