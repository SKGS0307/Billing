import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export const usersRepository = {
  async list(input: { page: number; pageSize: number; search?: string }) {
    const where: Prisma.UserWhereInput = input.search
      ? { OR: [{ name: { contains: input.search, mode: 'insensitive' } }, { email: { contains: input.search, mode: 'insensitive' } }] }
      : {};
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, isActive: true, mustChangePassword: true, lastLoginAt: true, createdAt: true,
          roles: { select: { role: { select: { name: true } } } },
        },
        orderBy: { name: 'asc' }, skip: (input.page - 1) * input.pageSize, take: input.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return { items: items.map(({ roles, ...user }) => ({ ...user, roles: roles.map(({ role }) => role.name) })), total };
  },
  findActiveRoles(names: string[]) {
    return prisma.role.findMany({ where: { name: { in: names }, isActive: true }, select: { id: true, name: true } });
  },
  create(input: { email: string; name: string; passwordHash: string; roleIds: string[]; actorId: string; ipAddress?: string }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
          mustChangePassword: true,
          roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
        },
        select: { id: true, email: true, name: true, isActive: true, mustChangePassword: true, createdAt: true },
      });
      await tx.auditLog.create({ data: { actorId: input.actorId, action: 'USER_CREATED', entityType: 'user', entityId: user.id, ipAddress: input.ipAddress } });
      return user;
    });
  },
  update(input: { id: string; name?: string; isActive?: boolean; roleIds?: string[]; actorId: string; ipAddress?: string }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: input.id }, select: { id: true } });
      if (!existing) return null;
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: input.id } });
        await tx.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId: input.id, roleId })) });
      }
      const user = await tx.user.update({
        where: { id: input.id },
        data: { name: input.name, isActive: input.isActive },
        select: { id: true, email: true, name: true, isActive: true, mustChangePassword: true, updatedAt: true },
      });
      if (input.isActive === false) await tx.session.deleteMany({ where: { userId: input.id } });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'USER_UPDATED',
          entityType: 'user',
          entityId: input.id,
          metadata: { nameChanged: input.name !== undefined, statusChanged: input.isActive !== undefined, rolesChanged: input.roleIds !== undefined },
          ipAddress: input.ipAddress,
        },
      });
      return user;
    });
  },
};
