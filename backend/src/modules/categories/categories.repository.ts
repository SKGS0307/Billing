import { prisma } from '../../config/prisma.js';

export const categoriesRepository = {
  list(includeInactive: boolean) {
    return prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  },
  create(data: { name: string; description?: string | null }, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      const category = await tx.category.create({ data });
      await tx.auditLog.create({ data: { actorId, action: 'CATEGORY_CREATED', entityType: 'category', entityId: category.id, ipAddress } });
      return category;
    });
  },
  update(id: string, data: { name?: string; description?: string | null; isActive?: boolean }, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return null;
      const category = await tx.category.update({ where: { id }, data });
      await tx.auditLog.create({ data: { actorId, action: 'CATEGORY_UPDATED', entityType: 'category', entityId: id, ipAddress } });
      return category;
    });
  },
};
