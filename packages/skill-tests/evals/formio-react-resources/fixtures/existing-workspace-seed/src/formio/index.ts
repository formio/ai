// Resource kernel — generated once per application by formio-react-resources.
// Per-resource files import ONLY from this index.
export type { ResourceConfig, ParentBinding } from './types';
export { applyParentContext, parentFilters, referencePath } from './parents';
export { resourcePermissions } from './permissions';
export { preserveDraftState } from './drafts';
export { resourceUrls } from './urls';
export { resourceListLoader, resourceItemLoader, resourceNewLoader } from './loaders';
export { resourceSaveAction, resourceDeleteAction } from './actions';
export { resourceRoutes, itemRouteOf, itemRouteId } from './routes';
export { useResourceItem } from './hooks';
export { rootLoader, requireUser, currentUserOrNull } from './auth';
