import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { inventoryController } from './inventory.controller.js';

export const inventoryRoutes = Router();
inventoryRoutes.use(authenticate);
inventoryRoutes.get('/', requirePermission('inventory:read'), asyncHandler(inventoryController.list));
inventoryRoutes.get('/movements', requirePermission('inventory:read'), asyncHandler(inventoryController.movements));
inventoryRoutes.post('/adjustments', requirePermission('inventory:adjust'), asyncHandler(inventoryController.adjust));
