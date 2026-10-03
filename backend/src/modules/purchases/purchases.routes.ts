import { PaymentMethod, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { businessYear, D, money, ZERO } from '../../lib/money.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

const positiveMoney = z.coerce.number().finite().positive().max(100_000_000);
const paymentSchema = z.object({ method: z.enum(['CASH', 'UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER']), amount: positiveMoney, reference: z.string().trim().max(120).optional() });
const purchaseSchema = z.object({
  supplierId: z.string().uuid(), supplierInvoiceNumber: z.string().trim().max(100).optional(),
  purchaseDate: z.coerce.date().default(() => new Date()), discountAmount: z.coerce.number().finite().min(0).default(0),
  notes: z.string().trim().max(500).optional(), cashSessionId: z.string().uuid().optional(), payments: z.array(paymentSchema).max(10).default([]),
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.coerce.number().int().positive().max(1_000_000), purchasePrice: positiveMoney, taxRate: z.coerce.number().finite().min(0).max(100).default(0), discountAmount: z.coerce.number().finite().min(0).default(0) })).min(1).max(500),
});
const listSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional() });

async function nextPurchaseNumber(tx: Prisma.TransactionClient) {
  const year = businessYear(); const key = `PURCHASE:${year}`;
  await tx.invoiceSequence.upsert({ where: { key }, update: {}, create: { key, prefix: 'PUR', year, nextNumber: 1 } });
  const sequence = await tx.invoiceSequence.update({ where: { key }, data: { nextNumber: { increment: 1 } } });
  return `PUR-${year}-${String(sequence.nextNumber - 1).padStart(6, '0')}`;
}

export const purchasesRoutes = Router();
purchasesRoutes.use(authenticate);
purchasesRoutes.get('/', requirePermission('purchases:read'), asyncHandler(async (req, res) => {
  const input = listSchema.parse(req.query); const where: Prisma.PurchaseWhereInput = input.search ? { OR: [{ purchaseNumber: { contains: input.search, mode: 'insensitive' } }, { supplierInvoiceNumber: { contains: input.search, mode: 'insensitive' } }, { supplier: { name: { contains: input.search, mode: 'insensitive' } } }] } : {};
  const [items, total] = await prisma.$transaction([prisma.purchase.findMany({ where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy: { purchaseDate: 'desc' }, include: { supplier: true, _count: { select: { items: true } } } }), prisma.purchase.count({ where })]);
  res.json({ success: true, data: items, meta: { ...input, total, pageCount: Math.ceil(total / input.pageSize) } });
}));
purchasesRoutes.get('/:id', requirePermission('purchases:read'), asyncHandler(async (req, res) => {
  const purchase = await prisma.purchase.findUnique({ where: { id: z.string().uuid().parse(req.params.id) }, include: { supplier: true, createdBy: { select: { id: true, name: true } }, items: { include: { variant: true } }, payments: true, returns: { include: { items: true } } } });
  if (!purchase) throw new ApiError(404, 'PURCHASE_NOT_FOUND', 'Purchase was not found.'); res.json({ success: true, data: purchase });
}));
purchasesRoutes.post('/', requirePermission('purchases:manage'), asyncHandler(async (req, res) => {
  const input = purchaseSchema.parse(req.body);
  const created = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, isActive: true } });
    if (!supplier) throw new ApiError(400, 'INVALID_SUPPLIER', 'Choose an active supplier.');
    const ids = [...new Set(input.items.map((item) => item.variantId))].sort();
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "product_variants" WHERE "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`);
    const variants = await tx.productVariant.findMany({ where: { id: { in: ids } }, include: { product: true } });
    if (variants.length !== ids.length) throw new ApiError(400, 'INVALID_VARIANT', 'One or more product variants were not found.');
    const variantMap = new Map(variants.map((variant) => [variant.id, variant])); let subtotal = ZERO; let taxAmount = ZERO;
    const lines = input.items.map((item) => {
      const variant = variantMap.get(item.variantId)!; const gross = D(item.purchasePrice).times(item.quantity); const discount = D(item.discountAmount);
      if (discount.gt(gross)) throw new ApiError(400, 'INVALID_DISCOUNT', `Discount exceeds item value for ${variant.sku}.`);
      const taxable = gross.minus(discount); const tax = taxable.times(item.taxRate).div(100); subtotal = subtotal.plus(gross); taxAmount = taxAmount.plus(tax);
      return { item, variant, gross: money(gross), tax: money(tax), final: money(taxable.plus(tax)) };
    });
    const discount = D(input.discountAmount); if (discount.gt(subtotal)) throw new ApiError(400, 'INVALID_DISCOUNT', 'Purchase discount exceeds subtotal.');
    const grandTotal = money(subtotal.minus(discount).plus(taxAmount)); const paid = input.payments.reduce((sum, item) => sum.plus(item.amount), ZERO);
    if (paid.gt(grandTotal)) throw new ApiError(400, 'PAYMENT_EXCEEDS_TOTAL', 'Payments cannot exceed purchase total.');
    const cash = input.payments.some((item) => item.method === 'CASH');
    if (cash && (!input.cashSessionId || !await tx.cashSession.findFirst({ where: { id: input.cashSessionId, status: { in: ['OPEN', 'REOPENED'] } } }))) throw new ApiError(400, 'CASH_SESSION_REQUIRED', 'An open cash session is required for cash payments.');
    const purchaseNumber = await nextPurchaseNumber(tx);
    const purchase = await tx.purchase.create({ data: { purchaseNumber, supplierInvoiceNumber: input.supplierInvoiceNumber || null, supplierId: input.supplierId, subtotal: money(subtotal), discountAmount: money(discount), taxAmount: money(taxAmount), grandTotal, amountPaid: money(paid), balanceDue: money(grandTotal.minus(paid)), purchaseDate: input.purchaseDate, notes: input.notes, createdById: req.auth!.id } });
    for (const line of lines) {
      const row = await tx.purchaseItem.create({ data: { purchaseId: purchase.id, variantId: line.variant.id, productNameSnapshot: line.variant.product.name, skuSnapshot: line.variant.sku, quantity: line.item.quantity, purchasePrice: line.item.purchasePrice, discountAmount: line.item.discountAmount, taxRateSnapshot: line.item.taxRate, taxAmount: line.tax, finalAmount: line.final } });
      const updated = await tx.productVariant.update({ where: { id: line.variant.id }, data: { stockQuantity: { increment: line.item.quantity }, purchaseCost: line.item.purchasePrice } });
      if (!D(line.variant.purchaseCost).eq(line.item.purchasePrice)) await tx.priceHistory.create({ data: { variantId: line.variant.id, oldPurchaseCost: line.variant.purchaseCost, newPurchaseCost: line.item.purchasePrice, oldMrp: line.variant.mrp, newMrp: line.variant.mrp, oldRetailPrice: line.variant.retailPrice, newRetailPrice: line.variant.retailPrice, oldWholesalePrice: line.variant.wholesalePrice, newWholesalePrice: line.variant.wholesalePrice, changedById: req.auth!.id } });
      await tx.stockMovement.create({ data: { variantId: line.variant.id, type: 'PURCHASE', quantity: line.item.quantity, balanceAfter: updated.stockQuantity, referenceType: 'purchase_item', referenceId: row.id, notes: purchaseNumber } });
    }
    for (const payment of input.payments) await tx.payment.create({ data: { purchaseId: purchase.id, supplierId: supplier.id, cashSessionId: payment.method === 'CASH' ? input.cashSessionId : null, kind: 'SUPPLIER_PAYMENT', method: payment.method as PaymentMethod, amount: payment.amount, reference: payment.reference } });
    await tx.supplierLedgerEntry.create({ data: { supplierId: supplier.id, type: 'PURCHASE', amount: grandTotal, referenceType: 'purchase', referenceId: purchase.id, notes: purchaseNumber } });
    if (paid.gt(0)) await tx.supplierLedgerEntry.create({ data: { supplierId: supplier.id, type: 'PAYMENT', amount: money(paid.negated()), referenceType: 'purchase_payment', referenceId: purchase.id, notes: purchaseNumber } });
    await tx.auditLog.create({ data: { actorId: req.auth!.id, action: 'PURCHASE_CREATED', entityType: 'purchase', entityId: purchase.id, metadata: { purchaseNumber, grandTotal: grandTotal.toString() }, ipAddress: req.ip } });
    return tx.purchase.findUniqueOrThrow({ where: { id: purchase.id }, include: { supplier: true, items: true, payments: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
  res.status(201).json({ success: true, data: created });
}));
