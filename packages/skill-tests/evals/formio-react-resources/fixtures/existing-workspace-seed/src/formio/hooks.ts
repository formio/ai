import { useRouteLoaderData } from 'react-router';
import { itemRouteId } from './routes';
import type { ResourceConfig } from './types';

/**
 * `useLoaderData` resolves against the route the component renders in, so a
 * view/edit child — which has no loader — must read the item route by id.
 */
export function useResourceItem<T = unknown>(config: ResourceConfig): T {
  const data = useRouteLoaderData(itemRouteId(config)) as T | undefined;
  if (data === undefined) {
    throw new Error(
      `no data for route "${itemRouteId(config)}" — is this screen a child of the item route?`
    );
  }
  return data;
}
