import { Formio } from '@formio/js';
import { projectUrl } from '../config';
import { applyParentContext, parentFilters } from './parents';
import { resourcePermissions } from './permissions';
import { resourceUrls } from './urls';
import type { ParentBinding, ResourceConfig } from './types';

type LoaderArgs = { params: Record<string, string | undefined>; request: Request };

const PAGE_SIZE = 25;

/** A hand-edited `?page=` must not reach the API as `skip: NaN`. */
function positiveInt(raw: string | null, fallback: number) {
  const value = Number(raw);
  return raw !== null && Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** Loaders run outside React, so the URLs come from the config module. */
function formio(config: ResourceConfig, id?: string) {
  const { formUrl, submissionUrl } = resourceUrls({ projectUrl, form: config.form, id });
  return { formUrl, formio: new Formio(submissionUrl ?? formUrl) };
}

export function resourceListLoader(config: ResourceConfig) {
  return async ({ params, request }: LoaderArgs) => {
    // One instance for both requests — `formio()` already built it.
    const { formio: instance } = formio(config);
    const form = await instance.loadForm();
    const search = new URL(request.url).searchParams;
    const page = positiveInt(search.get('page'), 0);
    const limit = positiveInt(search.get('limit'), PAGE_SIZE);
    const query = {
      ...parentFilters({ form, parents: config.parents, params }),
      limit,
      skip: page * limit,
    };
    const submissions = await instance.loadSubmissions({ params: query });
    return { form, submissions, page, limit };
  };
}

export function resourceItemLoader(config: ResourceConfig) {
  return async ({ params }: LoaderArgs) => {
    const id = params[config.param];
    const { formUrl, formio: instance } = formio(config, id);
    const [form, submission, user] = await Promise.all([
      new Formio(formUrl).loadForm(),
      instance.loadSubmission(),
      Formio.currentUser(),
    ]);
    // Resolved here, never in a hook: the item shell renders with edit and
    // delete already in their final state.
    const permissions = await resourcePermissions({ formUrl, user, form, submission });
    return { form, submission, user, permissions };
  };
}

export function resourceNewLoader(config: ResourceConfig) {
  return async ({ params }: LoaderArgs) => {
    const { formUrl } = formio(config);
    // The form and every ancestor are independent requests — issue them together.
    const loadParent = async (binding: ParentBinding): Promise<[string, unknown] | undefined> => {
      if (binding.resource === 'currentUser') return [binding.field, await Formio.currentUser()];
      const id = params[binding.resource.param];
      if (!id) return undefined;
      const { submissionUrl } = resourceUrls({ projectUrl, form: binding.resource.form, id });
      return [binding.field, await new Formio(submissionUrl!).loadSubmission()];
    };
    const loadingForm = new Formio(formUrl).loadForm();
    const parents = await Promise.all((config.parents ?? []).map(loadParent));
    const form = await loadingForm;
    const parentSubmissions = Object.fromEntries(
      parents.filter((entry): entry is [string, unknown] => entry !== undefined)
    );
    return applyParentContext({ form, parents: config.parents, parentSubmissions });
  };
}
