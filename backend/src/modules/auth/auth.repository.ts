import { prisma } from '../../config/prisma.js';

export const authRepository = {
  findUserForLogin(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  recordFailedLogin(id: string, shouldLock: boolean) {
    return prisma.user.update({
      where: { id },
      data: {
        failedLoginCount: shouldLock ? 0 : { increment: 1 },
        ...(shouldLock ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {}),
      },
    });
  },
  async createSuccessfulSession(input: { userId: string; tokenHash: string; expiresAt: Date; ipAddress?: string; userAgent?: string }) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      await tx.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      const session = await tx.session.create({ data: input });
      await tx.auditLog.create({
        data: { actorId: input.userId, action: 'LOGIN', entityType: 'session', entityId: session.id, ipAddress: input.ipAddress },
      });
      return session;
    });
  },
  async revokeSession(sessionId: string, userId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { id: sessionId, userId } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'LOGOUT', entityType: 'session', entityId: sessionId, ipAddress } });
    });
  },
  findUserPassword(userId: string) {
    return prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  },
  changePassword(userId: string, sessionId: string, passwordHash: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
      await tx.session.deleteMany({ where: { userId, id: { not: sessionId } } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'PASSWORD_CHANGED', entityType: 'user', entityId: userId, ipAddress } });
    });
  },
};
