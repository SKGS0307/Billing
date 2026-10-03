import { describe, expect, it } from 'vitest';
import { productInputSchema, variantInputSchema } from './products.schema.js';

const variant = {
  sku: 'SHIRT-BLK-M', barcode: '290000000001', size: 'M', color: 'Black',
  purchaseCost: '500.00', mrp: '1299.00', retailPrice: '999.00', wholesalePrice: '800.00',
  minStockLevel: 2, initialStock: 5,
};

describe('product validation', () => {
  it('accepts deterministic decimal strings and whole-piece stock', () => {
    expect(variantInputSchema.safeParse(variant).success).toBe(true);
  });

  it('rejects negative money and stock values', () => {
    expect(variantInputSchema.safeParse({ ...variant, purchaseCost: '-1.00' }).success).toBe(false);
    expect(variantInputSchema.safeParse({ ...variant, initialStock: -1 }).success).toBe(false);
  });

  it('requires a category and at least one variant', () => {
    const result = productInputSchema.safeParse({
      productCode: 'SHIRT-1', name: 'Linen Shirt', categoryId: '11111111-1111-4111-8111-111111111111', variants: [],
    });
    expect(result.success).toBe(false);
  });
});
