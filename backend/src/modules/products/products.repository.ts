import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { ProductInput, ProductListQuery, ProductUpdate, VariantInput, VariantUpdate } from './products.schema.js';

const variantSelect = {
  id: true, sku: true, barcode: true, size: true, color: true, design: true, fabric: true, pattern: true,
  purchaseCost: true, mrp: true, retailPrice: true, wholesalePrice: true, stockQuantity: true,
  minStockLevel: true, status: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ProductVariantSelect;

export const productsRepository = {
  references(categoryId: string, brandId?: string | null, taxRateId?: string | null) {
    return Promise.all([
      prisma.category.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } }),
      brandId ? prisma.brand.findFirst({ where: { id: brandId, isActive: true }, select: { id: true } }) : Promise.resolve(null),
      taxRateId ? prisma.taxRate.findFirst({ where: { id: taxRateId, isActive: true }, select: { id: true } }) : Promise.resolve(null),
    ]);
  },
  async list(input: ProductListQuery) {
    const where: Prisma.ProductWhereInput = {
      ...(input.status ? { status: input.status as ProductStatus } : { status: { not: ProductStatus.ARCHIVED } }),
      categoryId: input.categoryId,
      brandId: input.brandId,
      ...(input.search ? { OR: [
        { name: { contains: input.search, mode: 'insensitive' } },
        { productCode: { contains: input.search, mode: 'insensitive' } },
        { category: { name: { contains: input.search, mode: 'insensitive' } } },
        { brand: { name: { contains: input.search, mode: 'insensitive' } } },
        { variants: { some: { OR: [
          { sku: { contains: input.search, mode: 'insensitive' } },
          { barcode: { contains: input.search, mode: 'insensitive' } },
        ] } } },
      ] } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where, skip: (input.page - 1) * input.pageSize, take: input.pageSize,
        orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
        include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } }, taxRate: true, variants: { select: variantSelect, orderBy: [{ color: 'asc' }, { size: 'asc' }] } },
      }),
      prisma.product.count({ where }),
    ]);
    return { items, total };
  },
  get(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } }, taxRate: true,
        variants: { select: variantSelect, orderBy: [{ color: 'asc' }, { size: 'asc' }] },
      },
    });
  },
  create(input: ProductInput, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: {
        productCode: input.productCode, name: input.name, description: input.description,
        hsnCode: input.hsnCode, categoryId: input.categoryId, brandId: input.brandId, taxRateId: input.taxRateId,
      } });
      for (const item of input.variants) {
        const { initialStock, ...variantData } = item;
        const variant = await tx.productVariant.create({ data: { productId: product.id, ...variantData, stockQuantity: initialStock } });
        if (initialStock > 0) {
          const adjustment = await tx.stockAdjustment.create({ data: { variantId: variant.id, quantityDelta: initialStock, reason: 'OPENING_STOCK', notes: 'Opening stock', createdById: actorId } });
          await tx.stockMovement.create({ data: {
            variantId: variant.id, type: 'OPENING_STOCK', quantity: initialStock, balanceAfter: initialStock,
            referenceType: 'stock_adjustment', referenceId: adjustment.id, stockAdjustmentId: adjustment.id, notes: 'Opening stock',
          } });
        }
      }
      await tx.auditLog.create({ data: { actorId, action: 'PRODUCT_CREATED', entityType: 'product', entityId: product.id, metadata: { variantCount: input.variants.length }, ipAddress } });
      return product;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
  update(id: string, input: ProductUpdate, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      if (!await tx.product.findUnique({ where: { id }, select: { id: true } })) return null;
      const product = await tx.product.update({ where: { id }, data: input });
      await tx.auditLog.create({ data: { actorId, action: 'PRODUCT_UPDATED', entityType: 'product', entityId: id, ipAddress } });
      return product;
    });
  },
  addVariant(productId: string, input: VariantInput, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      if (!await tx.product.findUnique({ where: { id: productId }, select: { id: true } })) return null;
      const { initialStock, ...variantData } = input;
      const variant = await tx.productVariant.create({ data: { productId, ...variantData, stockQuantity: initialStock } });
      if (initialStock > 0) {
        const adjustment = await tx.stockAdjustment.create({ data: { variantId: variant.id, quantityDelta: initialStock, reason: 'OPENING_STOCK', notes: 'Opening stock', createdById: actorId } });
        await tx.stockMovement.create({ data: { variantId: variant.id, type: 'OPENING_STOCK', quantity: initialStock, balanceAfter: initialStock, referenceType: 'stock_adjustment', referenceId: adjustment.id, stockAdjustmentId: adjustment.id, notes: 'Opening stock' } });
      }
      await tx.auditLog.create({ data: { actorId, action: 'VARIANT_CREATED', entityType: 'product_variant', entityId: variant.id, metadata: { productId }, ipAddress } });
      return variant;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
  updateVariant(productId: string, variantId: string, input: VariantUpdate, actorId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.productVariant.findFirst({ where: { id: variantId, productId } });
      if (!current) return null;
      const variant = await tx.productVariant.update({ where: { id: variantId }, data: input });
      const priceChanged = ['purchaseCost', 'mrp', 'retailPrice', 'wholesalePrice'].some((key) => input[key as keyof VariantUpdate] !== undefined && current[key as keyof typeof current]?.toString() !== input[key as keyof VariantUpdate]?.toString());
      if (priceChanged) {
        await tx.priceHistory.create({ data: {
          variantId, oldPurchaseCost: current.purchaseCost, newPurchaseCost: variant.purchaseCost,
          oldMrp: current.mrp, newMrp: variant.mrp, oldRetailPrice: current.retailPrice, newRetailPrice: variant.retailPrice,
          oldWholesalePrice: current.wholesalePrice, newWholesalePrice: variant.wholesalePrice, changedById: actorId,
        } });
      }
      await tx.auditLog.create({ data: { actorId, action: priceChanged ? 'VARIANT_PRICE_UPDATED' : 'VARIANT_UPDATED', entityType: 'product_variant', entityId: variantId, metadata: { productId }, ipAddress } });
      return variant;
    });
  },
};
