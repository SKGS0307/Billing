import { PaymentMethod, Prisma, SaleStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { businessYear, D, money, ZERO } from '../../lib/money.js';
import { calculateSale, type SaleVariant } from './sales.calculator.js';
import type { SaleInput, SalesListQuery } from './sales.schema.js';

async function nextNumber(tx: Prisma.TransactionClient, kind: string, prefix: string) {
  const year = businessYear();
  const key = `${kind}:${year}`;
  await tx.invoiceSequence.upsert({ where: { key }, update: {}, create: { key, prefix, year, nextNumber: 1 } });
  const sequence = await tx.invoiceSequence.update({ where: { key }, data: { nextNumber: { increment: 1 } } });
  return `${prefix}-${year}-${String(sequence.nextNumber - 1).padStart(6, '0')}`;
}

const fullSaleInclude = {
  customer: true, createdBy: { select: { id: true, name: true } }, payments: true,
  items: { include: { variant: { select: { id: true, size: true, color: true } } } },
} satisfies Prisma.SaleInclude;

export const salesRepository = {
  findByIdempotency(idempotencyKey: string) {
    return prisma.sale.findUnique({ where: { idempotencyKey }, include: fullSaleInclude });
  },
  create(input: SaleInput, idempotencyKey: string, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findUnique({ where: { idempotencyKey }, include: fullSaleInclude });
      if (existing) return existing;
      const variantIds = [...new Set(input.items.map((item) => item.variantId))].sort();
      const lockedIds = Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`));
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "product_variants" WHERE "id" IN (${lockedIds}) ORDER BY "id" FOR UPDATE`);
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds }, status: 'ACTIVE', product: { status: 'ACTIVE' } },
        include: { product: { include: { taxRate: true } } },
      });
      const customer = input.customerId ? await tx.customer.findFirst({ where: { id: input.customerId, isActive: true } }) : null;
      if (input.customerId && !customer) throw new ApiError(400, 'INVALID_CUSTOMER', 'Choose an active customer.');
      const calculation = calculateSale(input, new Map(variants.map((variant) => [variant.id, variant as SaleVariant])), customer?.type === 'WHOLESALE');
      const paymentTotal = input.payments.reduce((sum, payment) => sum.plus(payment.amount), ZERO);
      if (!paymentTotal.eq(calculation.grandTotal)) throw new ApiError(400, 'PAYMENT_MISMATCH', `Payments must total ₹${calculation.grandTotal.toFixed(2)}.`);
      const creditTotal = input.payments.filter((payment) => payment.method === 'CREDIT').reduce((sum, payment) => sum.plus(payment.amount), ZERO);
      if (creditTotal.gt(0) && !customer) throw new ApiError(400, 'CUSTOMER_REQUIRED_FOR_CREDIT', 'Select a customer for a credit sale.');
      const hasCash = input.payments.some((payment) => payment.method === 'CASH');
      let cashSession = null;
      if (hasCash) {
        if (!input.cashSessionId) throw new ApiError(400, 'CASH_SESSION_REQUIRED', 'Open a cash session before accepting cash.');
        cashSession = await tx.cashSession.findFirst({ where: { id: input.cashSessionId, status: { in: ['OPEN', 'REOPENED'] } } });
        if (!cashSession) throw new ApiError(400, 'CASH_SESSION_CLOSED', 'The selected cash session is not open.');
      }
      const config = await tx.setting.findUnique({ where: { key: 'invoice.configuration' } });
      const configValue = config?.value as { prefix?: string } | null;
      const invoiceNumber = await nextNumber(tx, 'SALE', configValue?.prefix ?? 'TTM');
      const amountPaid = input.payments.filter((payment) => payment.method !== 'CREDIT').reduce((sum, payment) => sum.plus(payment.amount), ZERO);
      const sale = await tx.sale.create({ data: {
        invoiceNumber, idempotencyKey, customerId: customer?.id, cashSessionId: cashSession?.id,
        taxMode: input.taxMode, isInterstate: input.isInterstate, subtotal: calculation.subtotal,
        itemDiscount: calculation.itemDiscount, billDiscount: calculation.billDiscount, taxableAmount: calculation.taxableAmount,
        cgst: calculation.cgst, sgst: calculation.sgst, igst: calculation.igst, roundOff: calculation.roundOff,
        grandTotal: calculation.grandTotal, amountPaid: money(amountPaid), balanceDue: money(creditTotal), notes: input.notes, createdById: actorId,
      } });
      for (const line of calculation.lines) {
        const label = [line.variant.color, line.variant.size].filter(Boolean).join(' / ') || 'Default';
        const saleItem = await tx.saleItem.create({ data: {
          saleId: sale.id, variantId: line.variant.id, productNameSnapshot: line.variant.product.name,
          skuSnapshot: line.variant.sku, variantSnapshot: label, hsnSnapshot: line.variant.product.hsnCode,
          purchaseCostSnapshot: line.variant.purchaseCost, mrpSnapshot: line.variant.mrp, sellingPrice: line.price,
          quantity: line.item.quantity, discountAmount: line.itemDiscount.plus(line.billShare), taxRateSnapshot: line.rate,
          taxableAmount: line.taxable, cgst: line.cgst, sgst: line.sgst, igst: line.igst, finalAmount: line.finalAmount,
        } });
        const updated = await tx.productVariant.update({ where: { id: line.variant.id }, data: { stockQuantity: { decrement: line.item.quantity } } });
        await tx.stockMovement.create({ data: {
          variantId: line.variant.id, type: 'SALE', quantity: -line.item.quantity, balanceAfter: updated.stockQuantity,
          referenceType: 'sale_item', referenceId: saleItem.id, notes: invoiceNumber,
        } });
      }
      for (const payment of input.payments) {
        const paid = D(payment.amount);
        const tendered = payment.tenderedAmount ? D(payment.tenderedAmount) : null;
        if (payment.method === 'CASH' && tendered && tendered.lt(paid)) throw new ApiError(400, 'INSUFFICIENT_TENDER', 'Cash received cannot be less than the cash payment.');
        await tx.payment.create({ data: {
          saleId: sale.id, customerId: customer?.id, cashSessionId: payment.method === 'CASH' ? cashSession?.id : null,
          kind: 'RECEIPT', method: payment.method as PaymentMethod, amount: paid, tenderedAmount: tendered,
          changeAmount: tendered ? money(tendered.minus(paid)) : null, reference: payment.reference,
        } });
      }
      if (customer) {
        await tx.customerLedgerEntry.create({ data: { customerId: customer.id, type: 'SALE', amount: calculation.grandTotal, referenceType: 'sale', referenceId: sale.id, notes: invoiceNumber } });
        for (const payment of input.payments.filter((item) => item.method !== 'CREDIT')) {
          await tx.customerLedgerEntry.create({ data: { customerId: customer.id, type: 'PAYMENT', amount: D(payment.amount).negated(), referenceType: 'payment', referenceId: sale.id, notes: payment.method } });
        }
      }
      await tx.auditLog.create({ data: { actorId, action: 'SALE_COMPLETED', entityType: 'sale', entityId: sale.id, metadata: { invoiceNumber, grandTotal: calculation.grandTotal.toString(), itemCount: calculation.lines.length }, ipAddress } });
      return tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: fullSaleInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  },
  async list(input: SalesListQuery) {
    const where: Prisma.SaleWhereInput = {
      status: input.status as SaleStatus | undefined,
      createdAt: input.dateFrom || input.dateTo ? { gte: input.dateFrom, lte: input.dateTo } : undefined,
      ...(input.search ? { OR: [
        { invoiceNumber: { contains: input.search, mode: 'insensitive' } },
        { customer: { name: { contains: input.search, mode: 'insensitive' } } },
        { customer: { mobile: { contains: input.search } } },
      ] } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.sale.findMany({ where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy: { createdAt: 'desc' }, include: { customer: { select: { id: true, name: true, mobile: true } }, payments: true, _count: { select: { items: true } } } }),
      prisma.sale.count({ where }),
    ]);
    return { items, total };
  },
  get(id: string) { return prisma.sale.findUnique({ where: { id }, include: { ...fullSaleInclude, returns: { include: { items: true, payments: true } } } }); },
  cancel(id: string, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "sales" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true, payments: true, returns: true } });
      if (!sale) return null;
      if (sale.status !== 'COMPLETED' || sale.returns.length) throw new ApiError(409, 'SALE_NOT_CANCELLABLE', 'Only a completed sale without returns can be cancelled.');
      if (sale.payments.some((payment) => payment.method === 'CASH')) {
        const session = sale.cashSessionId ? await tx.cashSession.findFirst({ where: { id: sale.cashSessionId, status: { in: ['OPEN', 'REOPENED'] } } }) : null;
        if (!session) throw new ApiError(409, 'ORIGINAL_CASH_SESSION_CLOSED', 'Cash sales can only be cancelled while their original cash session is open. Use a return instead.');
      }
      for (const item of sale.items) {
        const quantity = item.quantity - item.returnedQuantity;
        if (!quantity) continue;
        const variant = await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { increment: quantity } } });
        await tx.stockMovement.create({ data: { variantId: item.variantId, type: 'SALE_RETURN', quantity, balanceAfter: variant.stockQuantity, referenceType: 'cancelled_sale', referenceId: sale.id, notes: `Cancellation ${sale.invoiceNumber}` } });
      }
      const paid = sale.payments.filter((payment) => payment.kind === 'RECEIPT' && payment.method !== 'CREDIT');
      for (const payment of paid) await tx.payment.create({ data: { saleId: sale.id, customerId: sale.customerId, cashSessionId: payment.method === 'CASH' ? sale.cashSessionId : null, kind: 'REFUND', method: payment.method, amount: payment.amount, reference: `Cancellation ${sale.invoiceNumber}` } });
      if (sale.customerId) {
        await tx.customerLedgerEntry.create({ data: { customerId: sale.customerId, type: 'RETURN', amount: D(sale.grandTotal).negated(), referenceType: 'sale_cancellation', referenceId: sale.id, notes: sale.invoiceNumber } });
        const refunded = paid.reduce((sum, payment) => sum.plus(payment.amount), ZERO);
        if (refunded.gt(0)) await tx.customerLedgerEntry.create({ data: { customerId: sale.customerId, type: 'REFUND', amount: refunded, referenceType: 'sale_cancellation_refund', referenceId: sale.id, notes: sale.invoiceNumber } });
      }
      await tx.sale.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.auditLog.create({ data: { actorId, action: 'SALE_CANCELLED', entityType: 'sale', entityId: id, metadata: { invoiceNumber: sale.invoiceNumber, amount: sale.grandTotal.toString() }, ipAddress } });
      return tx.sale.findUniqueOrThrow({ where: { id }, include: fullSaleInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  },
};
