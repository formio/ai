import { z } from 'zod';
import { MONGO_ID_PATTERN } from '../formio-client.js';
import { ToolError } from '../tool-errors.js';

/**
 * The one rule for `formId`: it is always a form's 24-character ObjectId. Reads that
 * Form.io also serves by form path take `formIdOrPath` instead; every write and every
 * action tool takes `formId`, because the action-type catalog route does not resolve
 * a path and one argument name should mean one thing.
 *
 * The check runs in the handler rather than in the schema, so a refusal carries the
 * `INVALID_ARGUMENT` code: a schema failure is reported by the SDK as bare text.
 */
export function formIdArgument() {
  return z.string().describe("The form's _id, a 24-character ObjectId (form_get returns it)");
}

/** Refuses a `formId` that is not an ObjectId, before any request is made. */
export function requireFormId(formId: string): void {
  if (!MONGO_ID_PATTERN.test(formId)) {
    throw new ToolError({
      code: 'INVALID_ARGUMENT',
      message: `formId ${JSON.stringify(formId)} is not accepted: formId takes a form's 24-character ObjectId _id. Read the form's _id with form_get; a form path is accepted only by the formIdOrPath argument of form_get, form_revision_list and form_revision_get.`,
    });
  }
}
