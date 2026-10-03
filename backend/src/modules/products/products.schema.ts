import { z } from 'zod';

const money = z.string().trim().regex(/^\d{1,15}(\.\d{1,4})?$/, 'Use a non-negative amount with up to 4 decimal places.');
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();

export const variantInputSchema = z.object({
  sku: z.string().trim().min(2).max(80),
  barcode: optionalText(80),
  size: optionalText(40),
  color: optionalText(60),
  design: optionalText(100),
  fabric: optionalText(100),
  pattern: optionalText(100),
  purchaseCost: money,
  mrp: money,
  retailPrice: money,
  wholesalePrice: money,
  minStockLevel: z.number().int().min(0).max(1_000_000).default(0),
  initialStock: z.number().int().min(0).max(1_000_000).default(0),
});

export const variantUpdateSchema = variantInputSchema.omit({ initialStock: true }).partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const productInputSchema = z.object({
  productCode: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(160),
  description: optionalText(1000),
  hsnCode: optionalText(20),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().nullable().optional(),
  taxRateId: z.string().uuid().nullable().optional(),
  variants: z.array(variantInputSchema).min(1).max(100),
});

export const productUpdateSchema = productInputSchema.omit({ variants: true }).partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

export const idSchema = z.string().uuid();

export type VariantInput = z.infer<typeof variantInputSchema>;
export type VariantUpdate = z.infer<typeof variantUpdateSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
