import { z } from 'zod';

export const roleFields = {
  title: z.string().optional().describe('Role title'),
  description: z.string().optional().describe('Role description'),
  default: z
    .boolean()
    .optional()
    .describe('When true, role is assigned to every new authenticated user'),
  admin: z.boolean().optional().describe('When true, holders bypass access checks'),
};
