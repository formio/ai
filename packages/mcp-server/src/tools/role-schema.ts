import { z } from 'zod';

const roleFields = {
  title: z.string().optional().describe('Role title'),
  description: z.string().optional().describe('Role description'),
  default: z
    .boolean()
    .optional()
    .describe('When true, role is assigned to every new authenticated user'),
  admin: z.boolean().optional().describe('When true, holders bypass access checks'),
};

/** A role document, as role_update replaces it. */
export const roleSchema = z.object(roleFields).catchall(z.unknown());

/** A role document to create: the same shape, with its title required. */
export const newRoleSchema = roleSchema.extend({ title: z.string().describe('Role title') });
