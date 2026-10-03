import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { salesController } from './sales.controller.js';

export const salesRoutes = Router();
salesRoutes.use(authenticate);
salesRoutes.get('/', requirePermission('sales:read'), asyncHandler(salesController.list));
salesRoutes.get('/:id', requirePermission('sales:read'), asyncHandler(salesController.get));
salesRoutes.post('/', requirePermission('sales:create'), asyncHandler(salesController.create));
salesRoutes.post('/:id/cancel', requirePermission('sales:cancel'), asyncHandler(salesController.cancel));
