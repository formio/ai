// Shared jsdom harness for the tests that run the real @formio/js renderer.
//
// Why this exists: `Formio.createForm` leaves a live form instance behind, and
// the renderer finishes work on callbacks that outlive the `it()` that started
// them — validation, error classes, redraws. Removing the container element is
// not enough. A callback that lands after Vitest tears the environment down
// throws `ReferenceError: HTMLElement is not defined` as an *unhandled* error,
// which fails the whole run while every individual test still reports as
// passing, and it only reproduces under some timings (a CI flake).
//
// So: every renderer test creates its form through `createForm` here, and the
// shared `afterEach` destroys the instances and lets the queued work drain
// while the DOM is still alive.

import { afterEach } from 'vitest';
import { Formio } from '@formio/js';

// `Formio.createForm` is declared as `Promise<any>` in @formio/js — the runtime
// instance is loosely typed there (which is why the test files carry
// `@ts-nocheck`). This harness only ever calls `destroy`, so it names that one
// member and leaves the rest opaque instead of spreading `any` further.
type RenderedForm = { destroy: (all?: boolean) => void } & Record<string, unknown>;

const containers: HTMLElement[] = [];
const forms: RenderedForm[] = [];

/**
 * Renders a form definition into a fresh container attached to `document.body`,
 * tracking both for teardown. Same argument order as `Formio.createForm` minus
 * the element, which the harness owns.
 */
export async function createForm(definition: unknown, options?: unknown): Promise<RenderedForm> {
  const element = document.createElement('div');
  document.body.appendChild(element);
  containers.push(element);

  const form: RenderedForm = await Formio.createForm(element, definition, options);
  forms.push(form);
  return form;
}

afterEach(async () => {
  for (const form of forms.splice(0)) {
    form.destroy(true);
  }
  // Let anything the renderer queued before `destroy()` run while the DOM still
  // exists, rather than after the environment is gone.
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const element of containers.splice(0)) {
    element.remove();
  }
});
