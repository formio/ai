import { z } from 'zod';

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
  .describe('Condition for when action runs');

export const actionDefinitionSchema = z
  .object({
    name: z.string().describe('Action type name'),
    title: z.string().describe('Action title'),
    handler: z.array(z.string()).describe('Handler phases (e.g. ["before"], ["after"])'),
    method: z.array(z.string()).describe('Methods (e.g. ["create"], ["update"])'),
    settings: z.record(z.string(), z.unknown()).optional().describe('Action settings'),
    condition: actionCondition,
    priority: z.number().optional().describe('Action priority'),
  })
  .passthrough()
  .describe('Action definition');
