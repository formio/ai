import { MONGO_ID_PATTERN } from '../formio-client.js';
import { ToolError } from '../tool-errors.js';

export interface RequireObjectIdOptions {
  /** The argument's name, as the caller passed it. */
  argument: string;
  value: string;
  /** What to pass instead, and where to read it. */
  remedy: string;
}

/**
 * Refuses an argument that is not a 24-character ObjectId, before any request is made.
 *
 * Checked in the handler rather than in the schema, so the refusal carries the
 * `INVALID_ARGUMENT` code: a schema failure is reported by the SDK as bare text.
 */
export function requireObjectId({ argument, value, remedy }: RequireObjectIdOptions): void {
  if (!MONGO_ID_PATTERN.test(value)) {
    throw new ToolError({
      code: 'INVALID_ARGUMENT',
      message: `${argument} ${JSON.stringify(value)} is not accepted: ${remedy}`,
    });
  }
}
