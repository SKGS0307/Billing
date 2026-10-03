import { PaymentMethod, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

const inputSchema = z.object({ categoryId: z.string().uuid(), amount: z.coerce.number().finite().positive().max(100_000_000), method: z.enum(['CASH', 'UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER']), description: z.string().trim().min(2).max(500), expenseDate: z.coerce.date().default(() => new Date()), cashSessionId: z.string().uuid().optional() });
const categorySchema = z.object({ name: z.string().trim().min(2).max(100) });

export const expensesRoutes = Router(); expensesRoutes.use(authenticate);
expensesRoutes.get('/categories', requirePermission('expenses:read'), asyncHandler(async (_req, res) => res.json({ success: true, data: await prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } }) })));
expensesRoutes.post('/categories', requirePermission('expenses:manage'), asyncHandler(async (req, res) => { const input = categorySchema.parse(req.body); const item = await prisma.expenseCategory.create({ data: input }); res.status(201).json({ success: true, data: item }); }));
expensesRoutes.get('/', requirePermission('expenses:read'), asyncHandler(async (req, res) => {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined; const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined;
  const data = await prisma.expense.findMany({ where: { expenseDate: from || to ? { gte: from, lte: to } : undefined }, take: 500, orderBy: { expenseDate: 'desc' }, include: { category: true, createdBy: { select: { id: true, name: true } } } }); res.json({ success: true, data });
}));
expensesRoutes.post('/', requirePermission('expenses:manage'), asyncHandler(async (req, res) => {
  const input = inputSchema.parse(req.body); const category = await prisma.expenseCategory.findFirst({ where: { id: input.categoryId, isActive: true } }); if (!category) throw new ApiError(400, 'INVALID_EXPENSE_CATEGORY', 'Choose an active expense category.');
  if (input.method === 'CASH' && (!input.cashSessionId || !await prisma.cashSession.findFirst({ where: { id: input.cashSessionId, status: { in: ['OPEN', 'REOPENED'] } } }))) throw new ApiError(400, 'CASH_SESSION_REQUIRED', 'An open cash session is required for cash expenses.');
  const expense = await prisma.$transaction(async (tx) => { const item = await tx.expense.create({ data: { ...input, method: input.method as PaymentMethod, cashSessionId: input.method === 'CASH' ? input.cashSessionId : null, createdById: req.auth!.id } }); await tx.auditLog.create({ data: { actorId: req.auth!.id, action: 'EXPENSE_RECORDED', entityType: 'expense', entityId: item.id, metadata: { amount: input.amount, category: category.name }, ipAddress: req.ip } }); return item; });
  res.status(201).json({ success: true, data: expense });
}));
expensesRoutes.post('/:id/cancel', requirePermission('expenses:manage'), asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id); const item = await prisma.$transaction(async (tx) => { const current = await tx.expense.findUnique({ where: { id } }); if (!current) throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Expense was not found.'); if (current.status === 'CANCELLED') throw new ApiError(409, 'EXPENSE_ALREADY_CANCELLED', 'Expense is already cancelled.'); const updated = await tx.expense.update({ where: { id }, data: { status: 'CANCELLED' } }); await tx.auditLog.create({ data: { actorId: req.auth!.id, action: 'EXPENSE_CANCELLED', entityType: 'expense', entityId: id, metadata: { amount: current.amount.toString() }, ipAddress: req.ip } }); return updated; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); res.json({ success: true, data: item });
}));
