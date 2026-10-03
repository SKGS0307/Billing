import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { brandsController } from './brands.controller.js';

export const brandsRoutes = Router();
brandsRoutes.use(authenticate);
brandsRoutes.get('/', requirePermission('products:read'), asyncHandler(brandsController.list));
brandsRoutes.post('/', requirePermission('products:manage'), asyncHandler(brandsController.create));
brandsRoutes.patch('/:id', requirePermission('products:manage'), asyncHandler(brandsController.update));
