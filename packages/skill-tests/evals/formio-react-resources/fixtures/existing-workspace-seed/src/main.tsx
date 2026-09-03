import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { FormioProvider } from '@formio/react';
// DELIBERATE GAP — do not "fix" this file in the fixture.
// `@formio/js/dist/formio.form.css` is missing on purpose. This seed represents
// an application written before that requirement was documented: it has the
// Bootstrap half and not the renderer's own, so every reference select renders
// as an unstyled list. EXISTING.md's inspection is supposed to catch exactly
// this and backfill it, and eval 3 asserts that it did.
import 'bootstrap/dist/css/bootstrap.min.css';
import { baseUrl, projectUrl } from './config';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FormioProvider projectUrl={projectUrl} baseUrl={baseUrl}>
      <RouterProvider router={router} />
    </FormioProvider>
  </StrictMode>
);
