import { z } from 'zod';

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
});

export const categoryUpdateSchema = categoryInputSchema.partial().extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const categoryQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});
