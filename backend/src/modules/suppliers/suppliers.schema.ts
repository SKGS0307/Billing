import { z } from 'zod';
const amount = z.string().trim().regex(/^\d{1,15}(\.\d{1,4})?$/);
export const supplierInputSchema = z.object({ name: z.string().trim().min(2).max(120), company: z.string().trim().max(160).nullable().optional(), mobile: z.string().trim().max(20).nullable().optional(), email: z.string().trim().email().max(254).nullable().optional(), address: z.string().trim().max(500).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), state: z.string().trim().max(100).nullable().optional(), gstin: z.string().trim().max(20).nullable().optional(), notes: z.string().trim().max(500).nullable().optional(), openingBalance: amount.default('0') });
export const supplierUpdateSchema = supplierInputSchema.omit({ openingBalance: true }).partial().extend({ isActive: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);
export type SupplierInput = z.infer<typeof supplierInputSchema>;
