import { z } from 'zod';

// Form.io's own fields, documented by the formio-schema skill, so they carry no
// description here.
const roleFields = {
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.boolean().optional(),
  admin: z.boolean().optional(),
};

/** A role document, as role_update sends it. */
export const roleSchema = z.object(roleFields).catchall(z.unknown());

/** A role document to create: the same shape, with its title required. */
export const newRoleSchema = roleSchema.extend({ title: z.string() });
