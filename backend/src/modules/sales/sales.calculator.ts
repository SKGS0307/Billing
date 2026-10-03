import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/api-error.js';
import { currency, D, money, ZERO } from '../../lib/money.js';
import type { SaleInput } from './sales.schema.js';

export interface SaleVariant {
  id: string; sku: string; size: string | null; color: string | null; purchaseCost: Prisma.Decimal;
  mrp: Prisma.Decimal; retailPrice: Prisma.Decimal; wholesalePrice: Prisma.Decimal; stockQuantity: number;
  product: { name: string; hsnCode: string | null; taxRate: { rate: Prisma.Decimal } | null };
}

export function calculateSale(input: SaleInput, variants: Map<string, SaleVariant>, wholesale: boolean) {
  const requested = new Map<string, number>();
  const baseLines = input.items.map((item) => {
    const variant = variants.get(item.variantId);
    if (!variant) throw new ApiError(400, 'VARIANT_NOT_FOUND', 'A selected product variant is unavailable.');
    const totalQuantity = (requested.get(item.variantId) ?? 0) + item.quantity;
    requested.set(item.variantId, totalQuantity);
    if (variant.stockQuantity < totalQuantity) {
      const label = [variant.color, variant.size].filter(Boolean).join(' / ') || variant.sku;
      throw new ApiError(409, 'INSUFFICIENT_STOCK', `${variant.product.name} (${label}) has only ${variant.stockQuantity} pieces available.`);
    }
    const regularPrice = wholesale ? variant.wholesalePrice : variant.retailPrice;
    const price = item.priceOverride ? D(item.priceOverride) : regularPrice;
    const gross = money(price.mul(item.quantity));
    const itemDiscount = money(item.discountAmount);
    if (itemDiscount.gt(gross)) throw new ApiError(400, 'INVALID_DISCOUNT', `Discount cannot exceed the value of ${variant.product.name}.`);
    return { item, variant, price, gross, itemDiscount, afterItemDiscount: gross.minus(itemDiscount) };
  });
  const subtotal = baseLines.reduce((sum, line) => sum.plus(line.gross), ZERO);
  const itemDiscount = baseLines.reduce((sum, line) => sum.plus(line.itemDiscount), ZERO);
  const afterItemDiscount = subtotal.minus(itemDiscount);
  const billDiscount = money(input.billDiscountAmount);
  if (billDiscount.gt(afterItemDiscount)) throw new ApiError(400, 'INVALID_DISCOUNT', 'Bill discount cannot exceed the bill value.');

  let allocated = ZERO;
  const lines = baseLines.map((line, index) => {
    const billShare = index === baseLines.length - 1
      ? billDiscount.minus(allocated)
      : money(afterItemDiscount.isZero() ? 0 : billDiscount.mul(line.afterItemDiscount).div(afterItemDiscount));
    allocated = allocated.plus(billShare);
    const net = line.afterItemDiscount.minus(billShare);
    const rate = line.variant.product.taxRate?.rate ?? ZERO;
    const taxable = input.taxMode === 'INCLUSIVE' ? money(net.div(D(1).plus(rate.div(100)))) : money(net);
    const tax = input.taxMode === 'INCLUSIVE' ? money(net.minus(taxable)) : money(taxable.mul(rate).div(100));
    const finalAmount = input.taxMode === 'INCLUSIVE' ? money(net) : money(net.plus(tax));
    const igst = input.isInterstate ? tax : ZERO;
    const cgst = input.isInterstate ? ZERO : money(tax.div(2));
    const sgst = input.isInterstate ? ZERO : tax.minus(cgst);
    return { ...line, billShare, taxable, tax, finalAmount, igst, cgst, sgst, rate };
  });
  const taxableAmount = lines.reduce((sum, line) => sum.plus(line.taxable), ZERO);
  const cgst = lines.reduce((sum, line) => sum.plus(line.cgst), ZERO);
  const sgst = lines.reduce((sum, line) => sum.plus(line.sgst), ZERO);
  const igst = lines.reduce((sum, line) => sum.plus(line.igst), ZERO);
  const rawTotal = lines.reduce((sum, line) => sum.plus(line.finalAmount), ZERO);
  const grandTotal = currency(rawTotal);
  const roundOff = money(grandTotal.minus(rawTotal));
  return { lines, subtotal: money(subtotal), itemDiscount: money(itemDiscount), billDiscount, taxableAmount: money(taxableAmount), cgst: money(cgst), sgst: money(sgst), igst: money(igst), roundOff, grandTotal };
}
