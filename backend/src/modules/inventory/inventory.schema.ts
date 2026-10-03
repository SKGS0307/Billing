import { z } from 'zod';

export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  stockStatus: z.enum(['ALL', 'IN_STOCK', 'LOW', 'OUT']).default('ALL'),
});

export const movementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  variantId: z.string().uuid().optional(),
  type: z.enum(['OPENING_STOCK', 'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGED', 'LOST', 'THEFT', 'EXCHANGE_IN', 'EXCHANGE_OUT']).optional(),
});

export const adjustmentSchema = z.object({
  variantId: z.string().uuid(),
  quantityDelta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, 'Quantity change cannot be zero.'),
  reason: z.enum(['CORRECTION', 'DAMAGED', 'LOST', 'THEFT', 'FOUND', 'OTHER']),
  notes: z.string().trim().min(3).max(500),
}).superRefine((value, context) => {
  if (['DAMAGED', 'LOST', 'THEFT'].includes(value.reason) && value.quantityDelta > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['quantityDelta'], message: `${value.reason} must reduce stock.` });
  }
  if (value.reason === 'FOUND' && value.quantityDelta < 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['quantityDelta'], message: 'FOUND must increase stock.' });
  }
});

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;
export type MovementListQuery = z.infer<typeof movementListQuerySchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
