import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../lib/api-error.js';
import { asyncHandler } from '../lib/async-handler.js';
import { hashSessionToken, SESSION_COOKIE } from '../lib/security.js';

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          roles: {
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }

  const activeRoles = session.user.roles.filter(({ role }) => role.isActive);
  req.auth = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    mustChangePassword: session.user.mustChangePassword,
    roles: activeRoles.map(({ role }) => role.name),
    permissions: [...new Set(activeRoles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)))],
    sessionId: session.id,
  };
  next();
});
