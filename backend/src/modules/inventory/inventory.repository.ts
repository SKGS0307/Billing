import { Prisma, StockMovementType } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { AdjustmentInput, InventoryListQuery, MovementListQuery } from './inventory.schema.js';

function stockFilter(status: InventoryListQuery['stockStatus']): Prisma.ProductVariantWhereInput {
  if (status === 'OUT') return { stockQuantity: 0 };
  if (status === 'LOW') return { stockQuantity: { gt: 0, lte: prisma.productVariant.fields.minStockLevel } };
  if (status === 'IN_STOCK') return { stockQuantity: { gt: prisma.productVariant.fields.minStockLevel } };
  return {};
}

export const inventoryRepository = {
  async list(input: InventoryListQuery) {
    const where: Prisma.ProductVariantWhereInput = {
      ...stockFilter(input.stockStatus),
      product: { status: { not: 'ARCHIVED' } },
      ...(input.search ? { OR: [
        { sku: { contains: input.search, mode: 'insensitive' } },
        { barcode: { contains: input.search, mode: 'insensitive' } },
        { product: { name: { contains: input.search, mode: 'insensitive' } } },
        { product: { productCode: { contains: input.search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const lowWhere: Prisma.ProductVariantWhereInput = { stockQuantity: { lte: prisma.productVariant.fields.minStockLevel }, product: { status: { not: 'ARCHIVED' } } };
    const [items, total, lowStock, outOfStock] = await prisma.$transaction([
      prisma.productVariant.findMany({
        where, skip: (input.page - 1) * input.pageSize, take: input.pageSize,
        orderBy: [{ stockQuantity: 'asc' }, { product: { name: 'asc' } }, { sku: 'asc' }],
        include: { product: { include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } } } },
      }),
      prisma.productVariant.count({ where }),
      prisma.productVariant.count({ where: lowWhere }),
      prisma.productVariant.count({ where: { stockQuantity: 0, product: { status: { not: 'ARCHIVED' } } } }),
    ]);
    return { items, total, lowStock, outOfStock };
  },
  async movements(input: MovementListQuery) {
    const where: Prisma.StockMovementWhereInput = { variantId: input.variantId, type: input.type as StockMovementType | undefined };
    const [items, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy: { createdAt: 'desc' },
        include: {
          variant: { select: { id: true, sku: true, size: true, color: true, product: { select: { id: true, name: true, productCode: true } } } },
          stockAdjustment: { select: { reason: true, notes: true, createdBy: { select: { id: true, name: true } } } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return { items, total };
  },
  adjust(input: AdjustmentInput, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "product_variants" WHERE "id" = ${input.variantId}::uuid FOR UPDATE`;
      const variant = await tx.productVariant.findUnique({ where: { id: input.variantId }, include: { product: { select: { name: true } } } });
      if (!variant) return null;
      const balanceAfter = variant.stockQuantity + input.quantityDelta;
      if (balanceAfter < 0) return { insufficient: true as const, variant, balanceAfter };
      const adjustment = await tx.stockAdjustment.create({ data: {
        variantId: input.variantId, quantityDelta: input.quantityDelta, reason: input.reason, notes: input.notes, createdById: actorId,
      } });
      const movementType: StockMovementType = input.reason === 'DAMAGED' ? 'DAMAGED'
        : input.reason === 'LOST' ? 'LOST'
          : input.reason === 'THEFT' ? 'THEFT'
            : input.quantityDelta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      await tx.productVariant.update({ where: { id: input.variantId }, data: { stockQuantity: balanceAfter } });
      const movement = await tx.stockMovement.create({ data: {
        variantId: input.variantId, type: movementType, quantity: input.quantityDelta, balanceAfter,
        referenceType: 'stock_adjustment', referenceId: adjustment.id, stockAdjustmentId: adjustment.id, notes: input.notes,
      } });
      await tx.auditLog.create({ data: {
        actorId, action: 'STOCK_ADJUSTED', entityType: 'product_variant', entityId: input.variantId,
        metadata: { adjustmentId: adjustment.id, quantityDelta: input.quantityDelta, balanceAfter, reason: input.reason }, ipAddress,
      } });
      return { insufficient: false as const, adjustment, movement, balanceAfter };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
};
