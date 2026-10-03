import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateSale, type SaleVariant } from './sales.calculator.js';

const variant: SaleVariant = {
  id: '11111111-1111-4111-8111-111111111111', sku: 'TEST-M', size: 'M', color: 'Black',
  purchaseCost: new Prisma.Decimal(500), mrp: new Prisma.Decimal(1200), retailPrice: new Prisma.Decimal(1050),
  wholesalePrice: new Prisma.Decimal(900), stockQuantity: 10, product: { name: 'Test Shirt', hsnCode: '6205', taxRate: { rate: new Prisma.Decimal(5) } },
};

describe('sale calculator', () => {
  it('extracts inclusive GST deterministically', () => {
    const result = calculateSale({ customerId: null, cashSessionId: null, taxMode: 'INCLUSIVE', isInterstate: false, billDiscountAmount: '0', items: [{ variantId: variant.id, quantity: 1, discountAmount: '0' }], payments: [{ method: 'UPI', amount: '1050' }] }, new Map([[variant.id, variant]]), false);
    expect(result.taxableAmount.toFixed(2)).toBe('1000.00');
    expect(result.cgst.plus(result.sgst).toFixed(2)).toBe('50.00');
    expect(result.grandTotal.toFixed(2)).toBe('1050.00');
  });
  it('rejects overselling from the backend stock snapshot', () => {
    expect(() => calculateSale({ customerId: null, cashSessionId: null, taxMode: 'INCLUSIVE', isInterstate: false, billDiscountAmount: '0', items: [{ variantId: variant.id, quantity: 11, discountAmount: '0' }], payments: [{ method: 'UPI', amount: '1' }] }, new Map([[variant.id, variant]]), false)).toThrow(/only 10 pieces/);
  });
});
