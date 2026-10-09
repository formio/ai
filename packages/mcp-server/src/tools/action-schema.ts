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
  .optional()
  .describe('When the action runs');

export const actionDefinitionSchema = z
  .object({
    name: z.string().describe('Action type name, from action_type_list'),
    title: z.string(),
    handler: z.array(z.string()).describe('"before" and/or "after"'),
    method: z.array(z.string()).describe('e.g. "create", "update"'),
    settings: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Keys from action_type_get's settingsForm"),
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
