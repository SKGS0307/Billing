import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { categoriesController } from './categories.controller.js';

export const categoriesRoutes = Router();
categoriesRoutes.use(authenticate);
categoriesRoutes.get('/', requirePermission('products:read'), asyncHandler(categoriesController.list));
categoriesRoutes.post('/', requirePermission('products:manage'), asyncHandler(categoriesController.create));
categoriesRoutes.patch('/:id', requirePermission('products:manage'), asyncHandler(categoriesController.update));
