import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { productsController } from './products.controller.js';

export const productsRoutes = Router();
productsRoutes.use(authenticate);
productsRoutes.get('/', requirePermission('products:read'), asyncHandler(productsController.list));
productsRoutes.get('/:id', requirePermission('products:read'), asyncHandler(productsController.get));
productsRoutes.post('/', requirePermission('products:manage'), asyncHandler(productsController.create));
productsRoutes.patch('/:id', requirePermission('products:manage'), asyncHandler(productsController.update));
productsRoutes.post('/:id/variants', requirePermission('products:manage'), asyncHandler(productsController.addVariant));
productsRoutes.patch('/:id/variants/:variantId', requirePermission('products:manage'), asyncHandler(productsController.updateVariant));
