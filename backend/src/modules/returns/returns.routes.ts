import { PaymentMethod, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { businessYear, D, money, ZERO } from '../../lib/money.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

const method = z.enum(['CASH', 'UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'CREDIT']);
const saleReturnSchema = z.object({ saleId: z.string().uuid(), reason: z.string().trim().min(2).max(500), cashSessionId: z.string().uuid().optional(), refundMethod: method.default('CASH'), items: z.array(z.object({ saleItemId: z.string().uuid(), quantity: z.coerce.number().int().positive() })).min(1) });
const purchaseReturnSchema = z.object({ purchaseId: z.string().uuid(), reason: z.string().trim().min(2).max(500), cashSessionId: z.string().uuid().optional(), refundMethod: method.exclude(['CREDIT']).optional(), items: z.array(z.object({ purchaseItemId: z.string().uuid(), quantity: z.coerce.number().int().positive() })).min(1) });

async function nextReturnNumber(tx: Prisma.TransactionClient, kind: 'SALE_RETURN' | 'PURCHASE_RETURN') {
  const year = businessYear(); const key = `${kind}:${year}`; const prefix = kind === 'SALE_RETURN' ? 'TTMR' : 'PURR';
  await tx.invoiceSequence.upsert({ where: { key }, update: {}, create: { key, prefix, year, nextNumber: 1 } });
  const sequence = await tx.invoiceSequence.update({ where: { key }, data: { nextNumber: { increment: 1 } } });
  return `${prefix}-${year}-${String(sequence.nextNumber - 1).padStart(6, '0')}`;
}

export const saleReturnsRoutes = Router();
saleReturnsRoutes.use(authenticate);
saleReturnsRoutes.get('/', requirePermission('sales:read'), asyncHandler(async (_req, res) => res.json({ success: true, data: await prisma.saleReturn.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { sale: { select: { id: true, invoiceNumber: true } }, items: true, payments: true } }) })));
saleReturnsRoutes.post('/', requirePermission('sales:return'), asyncHandler(async (req, res) => {
  const input = saleReturnSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "sales" WHERE "id" = ${input.saleId}::uuid FOR UPDATE`;
    const sale = await tx.sale.findUnique({ where: { id: input.saleId }, include: { items: true } });
    if (!sale || ['CANCELLED', 'RETURNED', 'HELD'].includes(sale.status)) throw new ApiError(400, 'SALE_NOT_RETURNABLE', 'This sale cannot be returned.');
    const itemMap = new Map(sale.items.map((item) => [item.id, item])); let subtotal = ZERO; let tax = ZERO; const lines = [];
    for (const requested of input.items) {
      const item = itemMap.get(requested.saleItemId); if (!item) throw new ApiError(400, 'INVALID_SALE_ITEM', 'A return item does not belong to this sale.');
      if (requested.quantity > item.quantity - item.returnedQuantity) throw new ApiError(400, 'RETURN_QUANTITY_EXCEEDED', `Return quantity exceeds available quantity for ${item.skuSnapshot}.`);
      const ratio = D(requested.quantity).div(item.quantity); const lineTax = money(D(item.cgst).plus(item.sgst).plus(item.igst).times(ratio)); const final = money(D(item.finalAmount).times(ratio)); const taxable = money(final.minus(lineTax));
      subtotal = subtotal.plus(taxable); tax = tax.plus(lineTax); lines.push({ requested, item, lineTax, final, taxable });
    }
    const refund = money(subtotal.plus(tax));
    if (input.refundMethod === 'CASH' && (!input.cashSessionId || !await tx.cashSession.findFirst({ where: { id: input.cashSessionId, status: { in: ['OPEN', 'REOPENED'] } } }))) throw new ApiError(400, 'CASH_SESSION_REQUIRED', 'An open cash session is required for cash refunds.');
    const returnNumber = await nextReturnNumber(tx, 'SALE_RETURN');
    const saleReturn = await tx.saleReturn.create({ data: { returnNumber, saleId: sale.id, subtotal: money(subtotal), taxAmount: money(tax), refundAmount: refund, reason: input.reason, createdById: req.auth!.id } });
    for (const line of lines) {
      const returned = await tx.saleReturnItem.create({ data: { saleReturnId: saleReturn.id, saleItemId: line.item.id, variantId: line.item.variantId, quantity: line.requested.quantity, taxableAmount: line.taxable, taxAmount: line.lineTax, finalAmount: line.final } });
      await tx.saleItem.update({ where: { id: line.item.id }, data: { returnedQuantity: { increment: line.requested.quantity } } });
      const variant = await tx.productVariant.update({ where: { id: line.item.variantId }, data: { stockQuantity: { increment: line.requested.quantity } } });
      await tx.stockMovement.create({ data: { variantId: line.item.variantId, type: 'SALE_RETURN', quantity: line.requested.quantity, balanceAfter: variant.stockQuantity, referenceType: 'sale_return_item', referenceId: returned.id, notes: returnNumber } });
    }
    if (input.refundMethod !== 'CREDIT') await tx.payment.create({ data: { saleReturnId: saleReturn.id, customerId: sale.customerId, cashSessionId: input.refundMethod === 'CASH' ? input.cashSessionId : null, kind: 'REFUND', method: input.refundMethod as PaymentMethod, amount: refund } });
    if (sale.customerId) await tx.customerLedgerEntry.create({ data: { customerId: sale.customerId, type: 'RETURN', amount: refund.negated(), referenceType: 'sale_return', referenceId: saleReturn.id, notes: returnNumber } });
    const totals = await tx.saleItem.aggregate({ where: { saleId: sale.id }, _sum: { quantity: true, returnedQuantity: true } }); const allReturned = totals._sum.quantity === totals._sum.returnedQuantity;
    await tx.sale.update({ where: { id: sale.id }, data: { status: allReturned ? 'RETURNED' : 'PARTIALLY_RETURNED' } });
    await tx.auditLog.create({ data: { actorId: req.auth!.id, action: 'SALE_RETURN_CREATED', entityType: 'sale_return', entityId: saleReturn.id, metadata: { returnNumber, refund: refund.toString() }, ipAddress: req.ip } });
    return tx.saleReturn.findUniqueOrThrow({ where: { id: saleReturn.id }, include: { sale: true, items: true, payments: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  res.status(201).json({ success: true, data: result });
}));
saleReturnsRoutes.post('/:id/exchange', requirePermission('sales:return'), asyncHandler(async (req, res) => {
  const saleReturnId = z.string().uuid().parse(req.params.id); const replacementSaleId = z.object({ replacementSaleId: z.string().uuid() }).parse(req.body).replacementSaleId;
  const [returned, replacement] = await Promise.all([prisma.saleReturn.findUnique({ where: { id: saleReturnId } }), prisma.sale.findUnique({ where: { id: replacementSaleId } })]);
  if (!returned || !replacement) throw new ApiError(404, 'EXCHANGE_REFERENCE_NOT_FOUND', 'Return or replacement sale was not found.');
  const exchange = await prisma.exchange.create({ data: { saleReturnId, replacementSaleId, differenceAmount: money(D(replacement.grandTotal).minus(returned.refundAmount)) } });
  res.status(201).json({ success: true, data: exchange });
}));

export const purchaseReturnsRoutes = Router();
purchaseReturnsRoutes.use(authenticate);
purchaseReturnsRoutes.get('/', requirePermission('purchases:read'), asyncHandler(async (_req, res) => res.json({ success: true, data: await prisma.purchaseReturn.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { purchase: { select: { purchaseNumber: true } }, items: true, payments: true } }) })));
purchaseReturnsRoutes.post('/', requirePermission('purchases:return'), asyncHandler(async (req, res) => {
  const input = purchaseReturnSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "purchases" WHERE "id" = ${input.purchaseId}::uuid FOR UPDATE`;
    const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId }, include: { items: true } });
    if (!purchase || ['CANCELLED', 'RETURNED'].includes(purchase.status)) throw new ApiError(400, 'PURCHASE_NOT_RETURNABLE', 'This purchase cannot be returned.');
    const map = new Map(purchase.items.map((item) => [item.id, item])); let subtotal = ZERO; let tax = ZERO; const lines = [];
    for (const requested of input.items) {
      const item = map.get(requested.purchaseItemId); if (!item) throw new ApiError(400, 'INVALID_PURCHASE_ITEM', 'A return item does not belong to this purchase.');
      if (requested.quantity > item.quantity - item.returnedQuantity) throw new ApiError(400, 'RETURN_QUANTITY_EXCEEDED', `Return quantity exceeds available quantity for ${item.skuSnapshot}.`);
      const ratio = D(requested.quantity).div(item.quantity); const lineTax = money(D(item.taxAmount).times(ratio)); const final = money(D(item.finalAmount).times(ratio)); const lineSubtotal = money(final.minus(lineTax));
      const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId } }); if (variant.stockQuantity < requested.quantity) throw new ApiError(400, 'INSUFFICIENT_STOCK', `Not enough current stock to return ${item.skuSnapshot}.`);
      subtotal = subtotal.plus(lineSubtotal); tax = tax.plus(lineTax); lines.push({ requested, item, lineTax, final, lineSubtotal });
    }
    const total = money(subtotal.plus(tax));
    if (input.refundMethod === 'CASH' && (!input.cashSessionId || !await tx.cashSession.findFirst({ where: { id: input.cashSessionId, status: { in: ['OPEN', 'REOPENED'] } } }))) throw new ApiError(400, 'CASH_SESSION_REQUIRED', 'An open cash session is required for a cash refund.');
    const returnNumber = await nextReturnNumber(tx, 'PURCHASE_RETURN');
    const purchaseReturn = await tx.purchaseReturn.create({ data: { returnNumber, purchaseId: purchase.id, subtotal: money(subtotal), taxAmount: money(tax), totalAmount: total, reason: input.reason, createdById: req.auth!.id } });
    for (const line of lines) {
      const row = await tx.purchaseReturnItem.create({ data: { purchaseReturnId: purchaseReturn.id, purchaseItemId: line.item.id, variantId: line.item.variantId, quantity: line.requested.quantity, subtotal: line.lineSubtotal, taxAmount: line.lineTax, finalAmount: line.final } });
      await tx.purchaseItem.update({ where: { id: line.item.id }, data: { returnedQuantity: { increment: line.requested.quantity } } });
      const variant = await tx.productVariant.update({ where: { id: line.item.variantId }, data: { stockQuantity: { decrement: line.requested.quantity } } });
      await tx.stockMovement.create({ data: { variantId: line.item.variantId, type: 'PURCHASE_RETURN', quantity: -line.requested.quantity, balanceAfter: variant.stockQuantity, referenceType: 'purchase_return_item', referenceId: row.id, notes: returnNumber } });
    }
    if (input.refundMethod) await tx.payment.create({ data: { purchaseReturnId: purchaseReturn.id, supplierId: purchase.supplierId, cashSessionId: input.refundMethod === 'CASH' ? input.cashSessionId : null, kind: 'SUPPLIER_REFUND', method: input.refundMethod as PaymentMethod, amount: total } });
    await tx.supplierLedgerEntry.create({ data: { supplierId: purchase.supplierId, type: 'PURCHASE_RETURN', amount: total.negated(), referenceType: 'purchase_return', referenceId: purchaseReturn.id, notes: returnNumber } });
    const sums = await tx.purchaseItem.aggregate({ where: { purchaseId: purchase.id }, _sum: { quantity: true, returnedQuantity: true } }); await tx.purchase.update({ where: { id: purchase.id }, data: { status: sums._sum.quantity === sums._sum.returnedQuantity ? 'RETURNED' : 'PARTIALLY_RETURNED' } });
    await tx.auditLog.create({ data: { actorId: req.auth!.id, action: 'PURCHASE_RETURN_CREATED', entityType: 'purchase_return', entityId: purchaseReturn.id, metadata: { returnNumber, total: total.toString() }, ipAddress: req.ip } });
    return tx.purchaseReturn.findUniqueOrThrow({ where: { id: purchaseReturn.id }, include: { items: true, payments: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  res.status(201).json({ success: true, data: result });
}));
