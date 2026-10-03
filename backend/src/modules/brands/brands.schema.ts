import { z } from 'zod';

export const brandInputSchema = z.object({ name: z.string().trim().min(2).max(100) });
export const brandUpdateSchema = brandInputSchema.partial().extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');
export const brandQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});
