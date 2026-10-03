import { z } from 'zod';

export const moneySchema = z.string().trim().regex(/^\d{1,15}(\.\d{1,4})?$/, 'Enter a valid non-negative amount.');

export const variantFormSchema = z.object({
  sku: z.string().trim().min(2, 'SKU is required.').max(80),
  barcode: z.string().trim().max(80),
  size: z.string().trim().max(40),
  color: z.string().trim().max(60),
  purchaseCost: moneySchema,
  mrp: moneySchema,
  retailPrice: moneySchema,
  wholesalePrice: moneySchema,
  minStockLevel: z.coerce.number().int().min(0),
  initialStock: z.coerce.number().int().min(0),
});

export const productFormSchema = z.object({
  productCode: z.string().trim().min(2, 'Product code is required.'),
  name: z.string().trim().min(2, 'Product name is required.'),
  description: z.string().trim().max(1000),
  hsnCode: z.string().trim().max(20),
  categoryId: z.string().uuid('Choose a category.'),
  brandId: z.string(),
  taxRateId: z.string(),
  variants: z.array(variantFormSchema).min(1),
});

export type VariantFormValues = z.infer<typeof variantFormSchema>;
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const emptyVariant: VariantFormValues = {
  sku: '', barcode: '', size: '', color: '', purchaseCost: '0.00', mrp: '0.00',
  retailPrice: '0.00', wholesalePrice: '0.00', minStockLevel: 0, initialStock: 0,
};
