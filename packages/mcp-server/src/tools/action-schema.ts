import { z } from 'zod';
import { ToolError } from '../tool-errors.js';

const conditionOperator = z.enum([
  'isEqual',
  'isNotEqual',
  'isEmpty',
  'isNotEmpty',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'startsWith',
  'endsWith',
  'includes',
  'notIncludes',
  'isDateEqual',
  'isNotDateEqual',
  'dateGreaterThan',
  'dateGreaterThanOrEqual',
  'dateLessThan',
  'dateLessThanOrEqual',
]);

const actionCondition = z
  .object({
    conjunction: z.enum(['all', 'any']),
    conditions: z.array(
      z.object({
        component: z.string(),
        operator: conditionOperator,
        value: z.unknown().optional(),
      })
    ),
  })
  .optional();

// Form.io's own fields, documented by the formio-actions skill, so they carry no
// description here: `name` comes from action_type_list, and the keys valid in
// `settings` from action_type_get's settingsForm.
export const actionDefinitionSchema = z
  .object({
    name: z.string(),
    title: z.string(),
    handler: z.array(z.string()),
    method: z.array(z.string()),
    settings: z.record(z.string(), z.unknown()).optional(),
    condition: actionCondition,
    priority: z.number().optional(),
  })
  .passthrough()
  .describe('Action definition');

/** The refusal for an action type the form's catalog does not offer. */
export function unknownActionType({
  name,
  available,
}: {
  name: string;
  available: readonly string[];
}): ToolError {
  return new ToolError({
    code: 'UNKNOWN_ACTION_TYPE',
    message: `Action type '${name}' is not available on this server. Available types: ${available.join(', ')}`,
  });
}
