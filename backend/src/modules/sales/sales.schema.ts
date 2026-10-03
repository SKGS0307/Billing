import { z } from 'zod';

const amount = z.string().trim().regex(/^\d{1,15}(\.\d{1,4})?$/, 'Use a non-negative decimal amount.');

export const saleInputSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  cashSessionId: z.string().uuid().nullable().optional(),
  taxMode: z.enum(['INCLUSIVE', 'EXCLUSIVE']).default('INCLUSIVE'),
  isInterstate: z.boolean().default(false),
  billDiscountAmount: amount.default('0'),
  notes: z.string().trim().max(500).nullable().optional(),
  items: z.array(z.object({
    variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10_000),
    discountAmount: amount.default('0'), priceOverride: amount.optional(),
  })).min(1).max(200),
  payments: z.array(z.object({
    method: z.enum(['CASH', 'UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'CREDIT']),
    amount,
    tenderedAmount: amount.optional(),
    reference: z.string().trim().max(120).optional(),
  })).min(1).max(10),
});

export const salesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  dateFrom: z.coerce.date().optional(), dateTo: z.coerce.date().optional(),
  status: z.enum(['HELD', 'COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED', 'CANCELLED']).optional(),
});

export type SaleInput = z.infer<typeof saleInputSchema>;
export type SalesListQuery = z.infer<typeof salesListQuerySchema>;
