import { Formio } from '@formio/js';

export type ResourcePermissions = {
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
};

/** Wraps the SDK's `userPermissions`, which is an async instance method. */
export async function resourcePermissions({
  formUrl,
  user,
  form,
  submission,
}: {
  formUrl: string;
  user: unknown;
  form: unknown;
  submission?: unknown;
}): Promise<ResourcePermissions> {
  return new Formio(formUrl).userPermissions(user, form, submission);
}
