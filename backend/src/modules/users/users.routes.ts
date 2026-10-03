import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { createUser, listUsers, updateUser } from './users.controller.js';

export const usersRoutes = Router();
usersRoutes.get('/', authenticate, requirePermission('users:read'), asyncHandler(listUsers));
usersRoutes.post('/', authenticate, requirePermission('users:manage'), asyncHandler(createUser));
usersRoutes.patch('/:id', authenticate, requirePermission('users:manage'), asyncHandler(updateUser));
