import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

export const rolesRoutes = Router();
rolesRoutes.get('/', authenticate, requirePermission('roles:read'), asyncHandler(async (_req, res) => {
  const roles = await prisma.role.findMany({
    where: { isActive: true }, orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, permissions: { select: { permission: { select: { code: true } } } } },
  });
  res.json({ success: true, data: roles.map(({ permissions, ...role }) => ({ ...role, permissions: permissions.map((p) => p.permission.code) })) });
}));
