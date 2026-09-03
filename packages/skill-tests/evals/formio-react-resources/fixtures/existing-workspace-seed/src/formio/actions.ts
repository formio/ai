import { Formio } from '@formio/js';
import { redirect } from 'react-router';
import { projectUrl } from '../config';
import { preserveDraftState } from './drafts';
import { resourceUrls } from './urls';
import type { ResourceConfig } from './types';

type ActionArgs = { params: Record<string, string | undefined>; request: Request };

/**
 * `/customer/c1/quote/new`, `/customer/c1/quote/q1` and `/customer/c1/quote/q1/edit`
 * all list at `/customer/c1/quote`. `new` is already the list path once its own
 * segment is dropped — stripping a second segment there would climb into the parent.
 */
function listPath(pathname: string) {
  if (/\/new$/.test(pathname)) return pathname.replace(/\/new$/, '');
  return pathname.replace(/\/edit$/, '').replace(/\/[^/]+$/, '');
}

export function resourceSaveAction(config: ResourceConfig) {
  return async ({ params, request }: ActionArgs) => {
    const body = await request.formData();
    if (body.get('intent') === 'delete') {
      return resourceDeleteAction(config)({ params, request });
    }

    const id = params[config.param];
    const { formUrl, submissionUrl } = resourceUrls({ projectUrl, form: config.form, id });
    const raw = body.get('submission');
    // A post with no submission field is a wiring mistake in the screen, not a
    // record to save: `{}` would PUT an empty body over an existing record.
    if (typeof raw !== 'string') return { error: 'the request carried no `submission` field' };
    try {
      // Inside the try: a malformed field must land in `error` beside the form,
      // not escape as a thrown exception that replaces the screen.
      const incoming = JSON.parse(raw);
      // On update the write goes to the SUBMISSION url, which makes the request
      // a PUT whatever the body carries. Posting to the form url instead leaves
      // the method riding on `incoming._id`, so a submission that reaches the
      // action without one silently CREATES a second record.
      const target = submissionUrl ?? formUrl;
      const payload = submissionUrl
        ? preserveDraftState({
            existing: await new Formio(submissionUrl).loadSubmission(),
            incoming,
          })
        : incoming;
      const saved = await new Formio(target).saveSubmission(payload);
      return redirect(`${listPath(new URL(request.url).pathname)}/${saved._id}`);
    } catch (error) {
      // Returned, never thrown: throwing would replace the form with an error
      // page and lose what the user typed.
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };
}

export function resourceDeleteAction(config: ResourceConfig) {
  return async ({ params, request }: ActionArgs) => {
    const id = params[config.param];
    const { submissionUrl } = resourceUrls({ projectUrl, form: config.form, id });
    if (submissionUrl) await new Formio(submissionUrl).deleteSubmission();
    return redirect(listPath(new URL(request.url).pathname));
  };
}
