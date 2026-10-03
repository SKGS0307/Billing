import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { customerInputSchema, customerListSchema, customerUpdateSchema, partyPaymentSchema } from './customers.schema.js';
import { customersService } from './customers.service.js';

const id = z.string().uuid(); export const customersRoutes = Router(); customersRoutes.use(authenticate);
customersRoutes.get('/', requirePermission('customers:read'), asyncHandler(async (req, res) => { const q = customerListSchema.parse(req.query); const result = await customersService.list(q.page, q.pageSize, q.search); res.json({ success: true, data: result.items, meta: { ...q, total: result.total, pageCount: Math.ceil(result.total / q.pageSize) } }); }));
customersRoutes.get('/:id', requirePermission('customers:read'), asyncHandler(async (req, res) => res.json({ success: true, data: await customersService.get(id.parse(req.params.id)) })));
customersRoutes.post('/', requirePermission('customers:manage'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await customersService.create(customerInputSchema.parse(req.body), req.auth!.id, req.ip) })));
customersRoutes.patch('/:id', requirePermission('customers:manage'), asyncHandler(async (req, res) => res.json({ success: true, data: await customersService.update(id.parse(req.params.id), customerUpdateSchema.parse(req.body), req.auth!.id, req.ip) })));
customersRoutes.post('/:id/payments', requirePermission('customers:payment'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await customersService.pay(id.parse(req.params.id), partyPaymentSchema.parse(req.body), req.auth!.id, req.ip) })));
