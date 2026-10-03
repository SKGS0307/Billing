import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { D } from '../../lib/money.js';
import type { CustomerInput } from './customers.schema.js';

async function customerCode(tx: Prisma.TransactionClient) {
  const key = 'CUSTOMER'; await tx.invoiceSequence.upsert({ where: { key }, update: {}, create: { key, prefix: 'CUS', year: 0, nextNumber: 1 } });
  const sequence = await tx.invoiceSequence.update({ where: { key }, data: { nextNumber: { increment: 1 } } });
  return `CUS-${String(sequence.nextNumber - 1).padStart(6, '0')}`;
}

export const customersRepository = {
  async list(page: number, pageSize: number, search?: string) {
    const where: Prisma.CustomerWhereInput = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { mobile: { contains: search } }, { customerCode: { contains: search, mode: 'insensitive' } }] } : {};
    const [items, total] = await prisma.$transaction([prisma.customer.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { name: 'asc' }, include: { ledgerEntries: { select: { amount: true } }, _count: { select: { sales: true } } } }), prisma.customer.count({ where })]);
    return { items: items.map(({ ledgerEntries, ...item }) => ({ ...item, outstanding: ledgerEntries.reduce((sum, entry) => sum.plus(entry.amount), D(0)) })), total };
  },
  get(id: string) { return prisma.customer.findUnique({ where: { id }, include: { sales: { orderBy: { createdAt: 'desc' }, take: 20 }, payments: { orderBy: { createdAt: 'desc' }, take: 50 }, ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 100 } } }); },
  create(input: CustomerInput, actorId: string, ipAddress?: string) { return prisma.$transaction(async (tx) => { const { openingBalance, ...data } = input; const customer = await tx.customer.create({ data: { ...data, customerCode: await customerCode(tx) } }); if (D(openingBalance).gt(0)) await tx.customerLedgerEntry.create({ data: { customerId: customer.id, type: 'OPENING_BALANCE', amount: openingBalance, referenceType: 'customer', referenceId: customer.id } }); await tx.auditLog.create({ data: { actorId, action: 'CUSTOMER_CREATED', entityType: 'customer', entityId: customer.id, ipAddress } }); return customer; }); },
  update(id: string, data: Prisma.CustomerUpdateInput, actorId: string, ipAddress?: string) { return prisma.$transaction(async (tx) => { if (!await tx.customer.findUnique({ where: { id } })) return null; const customer = await tx.customer.update({ where: { id }, data }); await tx.auditLog.create({ data: { actorId, action: 'CUSTOMER_UPDATED', entityType: 'customer', entityId: id, ipAddress } }); return customer; }); },
  pay(id: string, input: { amount: string; method: string; cashSessionId?: string | null; reference?: string; notes?: string }, actorId: string, ipAddress?: string) { return prisma.$transaction(async (tx) => { const customer = await tx.customer.findFirst({ where: { id, isActive: true } }); if (!customer) return null; if (input.method === 'CASH' && !await tx.cashSession.findFirst({ where: { id: input.cashSessionId ?? '', status: { in: ['OPEN', 'REOPENED'] } } })) return { cashSessionInvalid: true as const }; const payment = await tx.payment.create({ data: { customerId: id, cashSessionId: input.method === 'CASH' ? input.cashSessionId : null, kind: 'RECEIPT', method: input.method as PaymentMethod, amount: input.amount, reference: input.reference, notes: input.notes } }); await tx.customerLedgerEntry.create({ data: { customerId: id, type: 'PAYMENT', amount: D(input.amount).negated(), referenceType: 'payment', referenceId: payment.id, notes: input.notes } }); await tx.auditLog.create({ data: { actorId, action: 'CUSTOMER_PAYMENT', entityType: 'payment', entityId: payment.id, ipAddress } }); return { cashSessionInvalid: false as const, payment }; }); },
};
