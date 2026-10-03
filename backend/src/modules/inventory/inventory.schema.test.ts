import { describe, expect, it } from 'vitest';
import { adjustmentSchema } from './inventory.schema.js';

const variantId = '11111111-1111-4111-8111-111111111111';

describe('stock adjustment validation', () => {
  it('rejects a zero adjustment', () => {
    expect(adjustmentSchema.safeParse({ variantId, quantityDelta: 0, reason: 'CORRECTION', notes: 'Counted stock' }).success).toBe(false);
  });
  it('rejects positive damaged stock', () => {
    expect(adjustmentSchema.safeParse({ variantId, quantityDelta: 2, reason: 'DAMAGED', notes: 'Damaged items' }).success).toBe(false);
  });
  it('accepts a documented correction', () => {
    expect(adjustmentSchema.safeParse({ variantId, quantityDelta: -2, reason: 'CORRECTION', notes: 'Physical count correction' }).success).toBe(true);
  });
});
