// Generated at CONFIG. The single source of truth for both URLs: the provider
// reads it, and so does the kernel — loaders run outside React and cannot read
// context, so they import this module directly.
import { Formio } from '@formio/js';

export const projectUrl = 'https://seedcrm.form.io';
export const baseUrl = 'https://api.form.io';

// The SDK globals are set HERE, at module evaluation, not by FormioProvider.
// `createBrowserRouter(...)` runs the initial navigation's loaders the moment it
// is called — during module evaluation of router.tsx, before React renders the
// provider — and `Formio.currentUser()` reads these globals. Every kernel module
// imports this file, so the globals are in place before any loader can run.
Formio.setBaseUrl(baseUrl);
Formio.setProjectUrl(projectUrl);
