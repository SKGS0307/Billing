import { prisma } from '../../config/prisma.js';

export const brandsRepository = {
  list(includeInactive: boolean) {
    return prisma.brand.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  },
  create(name: string, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({ data: { name } });
      await tx.auditLog.create({ data: { actorId, action: 'BRAND_CREATED', entityType: 'brand', entityId: brand.id, ipAddress } });
      return brand;
    });
  },
  update(id: string, data: { name?: string; isActive?: boolean }, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      if (!await tx.brand.findUnique({ where: { id }, select: { id: true } })) return null;
      const brand = await tx.brand.update({ where: { id }, data });
      await tx.auditLog.create({ data: { actorId, action: 'BRAND_UPDATED', entityType: 'brand', entityId: id, ipAddress } });
      return brand;
    });
  },
};
