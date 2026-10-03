import { PaymentKind, PaymentMethod, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { D, money, ZERO } from '../../lib/money.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

const amount = z.coerce.number().finite().min(0).max(100_000_000);
const openSchema = z.object({ openingCash: amount, notes: z.string().trim().max(500).optional() });
const movementSchema = z.object({ type: z.enum(['CASH_IN', 'CASH_OUT']), amount: amount.positive(), description: z.string().trim().min(2).max(500) });
const closeSchema = z.object({ actualCash: amount, notes: z.string().trim().max(500).optional() });

async function expectedCash(sessionId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const session = await tx.cashSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new ApiError(404, 'CASH_SESSION_NOT_FOUND', 'Cash session was not found.');
  const [payments, movements, expenses] = await Promise.all([
    tx.payment.findMany({ where: { cashSessionId: sessionId, method: PaymentMethod.CASH }, select: { amount: true, kind: true } }),
    tx.cashMovement.findMany({ where: { cashSessionId: sessionId }, select: { amount: true, type: true } }),
    tx.expense.findMany({ where: { cashSessionId: sessionId, method: PaymentMethod.CASH, status: 'RECORDED' }, select: { amount: true } }),
  ]);
  const cashPayments = payments.reduce((total, item) => {
    const incoming = item.kind === PaymentKind.RECEIPT || item.kind === PaymentKind.SUPPLIER_REFUND;
    return incoming ? total.plus(item.amount) : total.minus(item.amount);
  }, ZERO);
  const movementTotal = movements.reduce((total, item) => item.type === 'CASH_IN' ? total.plus(item.amount) : total.minus(item.amount), ZERO);
  const expenseTotal = expenses.reduce((total, item) => total.plus(item.amount), ZERO);
  return money(D(session.openingCash).plus(cashPayments).plus(movementTotal).minus(expenseTotal));
}

export const cashRoutes = Router();
cashRoutes.use(authenticate, requirePermission('cash:manage'));
cashRoutes.get('/current', asyncHandler(async (req, res) => {
  const session = await prisma.cashSession.findFirst({ where: { openedById: req.auth!.id, status: { in: ['OPEN', 'REOPENED'] } }, orderBy: { openedAt: 'desc' }, include: { movements: { orderBy: { createdAt: 'desc' } } } });
  res.json({ success: true, data: session ? { ...session, expectedCash: await expectedCash(session.id) } : null });
}));
cashRoutes.get('/', asyncHandler(async (_req, res) => {
  const sessions = await prisma.cashSession.findMany({ take: 100, orderBy: { openedAt: 'desc' }, include: { openedBy: { select: { id: true, name: true } }, closedBy: { select: { id: true, name: true } } } });
  res.json({ success: true, data: sessions });
}));
cashRoutes.post('/open', asyncHandler(async (req, res) => {
  const input = openSchema.parse(req.body);
  const existing = await prisma.cashSession.findFirst({ where: { openedById: req.auth!.id, status: { in: ['OPEN', 'REOPENED'] } } });
  if (existing) throw new ApiError(409, 'CASH_SESSION_ALREADY_OPEN', 'Close your current cash session before opening another.');
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.cashSession.create({ data: { openingCash: input.openingCash, notes: input.notes, openedById: req.auth!.id } });
    await tx.auditLog.create({ data: { actorId: req.auth!.id, action: 'CASH_SESSION_OPENED', entityType: 'cash_session', entityId: created.id, metadata: { openingCash: input.openingCash }, ipAddress: req.ip } });
    return created;
  });
  res.status(201).json({ success: true, data: session });
}));
cashRoutes.post('/:id/movements', asyncHandler(async (req, res) => {
  const sessionId = z.string().uuid().parse(req.params.id); const input = movementSchema.parse(req.body);
  const session = await prisma.cashSession.findFirst({ where: { id: sessionId, status: { in: ['OPEN', 'REOPENED'] } } });
  if (!session) throw new ApiError(400, 'CASH_SESSION_CLOSED', 'Choose an open cash session.');
  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.cashMovement.create({ data: { cashSessionId: sessionId, type: input.type, amount: input.amount, description: input.description, createdById: req.auth!.id } });
    await tx.auditLog.create({ data: { actorId: req.auth!.id, action: input.type, entityType: 'cash_movement', entityId: created.id, metadata: { amount: input.amount, cashSessionId: sessionId }, ipAddress: req.ip } });
    return created;
  });
  res.status(201).json({ success: true, data: movement });
}));
cashRoutes.post('/:id/close', asyncHandler(async (req, res) => {
  const sessionId = z.string().uuid().parse(req.params.id); const input = closeSchema.parse(req.body);
  const session = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "cash_sessions" WHERE "id" = ${sessionId}::uuid FOR UPDATE`;
    const current = await tx.cashSession.findUnique({ where: { id: sessionId } });
    if (!current || !['OPEN', 'REOPENED'].includes(current.status)) throw new ApiError(400, 'CASH_SESSION_CLOSED', 'This cash session is already closed.');
    const expected = await expectedCash(sessionId, tx); const difference = money(D(input.actualCash).minus(expected));
    const closed = await tx.cashSession.update({ where: { id: sessionId }, data: { status: 'CLOSED', actualCash: input.actualCash, expectedCash: expected, difference, closedAt: new Date(), closedById: req.auth!.id, notes: input.notes ?? current.notes } });
    await tx.auditLog.create({ data: { actorId: req.auth!.id, action: 'CASH_SESSION_CLOSED', entityType: 'cash_session', entityId: sessionId, metadata: { expected: expected.toString(), actual: input.actualCash, difference: difference.toString() }, ipAddress: req.ip } });
    return closed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ success: true, data: session });
}));
