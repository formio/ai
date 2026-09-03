import { Formio } from '@formio/js';
import { redirect, type LoaderFunction } from 'react-router';
// Evaluated for its side effect: src/config.ts sets the SDK globals that
// `currentUser()` reads. Importing it here guarantees the ordering whatever
// else the router module happens to import first.
import '../config';

// `currentUser()` resolves against the SDK's GLOBAL project URL. That is the one
// documented exception to the kernel's "loaders take URLs from src/config.ts"
// rule, and it is forced: there is no per-request form of this call that works.
// `new Formio('https://host/myproject/customer').projectUrl` parses to
// 'https://host' — the project segment is dropped — so an instance built to
// carry the URL would authenticate against the wrong one on a sub-directory
// deployment, and constructing it before `setProjectUrl` has run mutates the
// global as well.
//
// It is safe because src/config.ts calls `Formio.setProjectUrl` / `setBaseUrl`
// at module evaluation, and this module imports it. FormioProvider setting the
// same values during render is NOT what makes it safe: `createBrowserRouter`
// starts the initial loaders before React renders anything.
// Do not "fix" this by constructing an instance. See kernel-contract.md.

/**
 * The signed-in user, or null.
 *
 * `Formio.currentUser()` REJECTS — it does not resolve null — when a stored
 * token is expired or revoked (the `/current` request 401s or 440s). A guard
 * that only checks for null would throw on that path and render the error
 * element instead of redirecting, so the rejection is folded into "anonymous"
 * here. (On a 440 the SDK has already dropped the token; on a 401 the login
 * route the redirect lands on replaces it.)
 */
export async function currentUserOrNull(): Promise<unknown | null> {
  try {
    return (await Formio.currentUser()) ?? null;
  } catch {
    return null;
  }
}

/** The current user, loaded once at the root route. */
export async function rootLoader() {
  return { user: await currentUserOrNull() };
}

/**
 * Redirects before the wrapped loader runs, so a protected screen never mounts.
 *
 * Two forms. `requireUser()` is a loader that only checks — that is what the
 * pathless protected layout route uses. `requireUser(loader)` wraps one, for a
 * route protected on its own.
 */
export function requireUser(loader?: LoaderFunction): LoaderFunction {
  return async (...args: Parameters<LoaderFunction>) => {
    const user = await currentUserOrNull();
    if (!user) return redirect('/login');
    return loader ? loader(...args) : null;
  };
}
