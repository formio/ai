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
// Every shape Form.io stores passes through unchanged: the portal saves
// `{conjunction: '', conditions: [], custom: ''}`, older actions carry
// `{field, eq, value}`, and a cleared condition is `null`. Only a row's
// operator is checked, because the server silently never matches one it lacks.
const actionCondition = z
    .looseObject({
    conjunction: z.enum(['all', 'any', '']).optional(),
    conditions: z
        .array(z.looseObject({
        component: z.string().optional(),
        operator: conditionOperator.optional(),
        value: z.unknown().optional(),
    }))
        .optional(),
    custom: z.string().optional(),
})
    .nullable()
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
    settings: z.record(z.string(), z.unknown()).nullable().optional(),
    condition: actionCondition,
    priority: z.number().optional(),
})
    .passthrough()
    .describe('Action definition');
/** The refusal for an action type the form's catalog does not offer. */
export function unknownActionType({ name, available, }) {
    return new ToolError({
        code: 'UNKNOWN_ACTION_TYPE',
        message: `Action type '${name}' is not available on this server. Available types: ${available.join(', ')}`,
    });
}
