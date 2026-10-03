import { z } from 'zod';

const amount = z.string().trim().regex(/^\d{1,15}(\.\d{1,4})?$/);
export const customerInputSchema = z.object({
  name: z.string().trim().min(2).max(120), mobile: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(), address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(), state: z.string().trim().max(100).nullable().optional(),
  gstin: z.string().trim().max(20).nullable().optional(), type: z.enum(['RETAIL', 'WHOLESALE', 'VIP']).default('RETAIL'),
  notes: z.string().trim().max(500).nullable().optional(), openingBalance: amount.default('0'),
});
export const customerUpdateSchema = customerInputSchema.omit({ openingBalance: true }).partial().extend({ isActive: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);
export const customerListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), search: z.string().trim().max(100).optional() });
export const partyPaymentSchema = z.object({ amount, method: z.enum(['CASH', 'UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER']), cashSessionId: z.string().uuid().nullable().optional(), reference: z.string().trim().max(120).optional(), notes: z.string().trim().max(500).optional() });
export type CustomerInput = z.infer<typeof customerInputSchema>;
