import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/api-error.js';
import { productsRepository } from './products.repository.js';
import type { ProductInput, ProductListQuery, ProductUpdate, VariantInput, VariantUpdate } from './products.schema.js';

function normalizeVariant<T extends VariantInput | VariantUpdate>(variant: T): T {
  return {
    ...variant,
    ...(variant.sku !== undefined ? { sku: variant.sku.trim().toUpperCase() } : {}),
    ...(variant.barcode !== undefined ? { barcode: variant.barcode?.trim() || null } : {}),
  } as T;
}

function mapConstraint(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');
    if (target.includes('sku')) throw new ApiError(409, 'DUPLICATE_SKU', 'This SKU is already assigned to another variant.');
    if (target.includes('barcode')) throw new ApiError(409, 'DUPLICATE_BARCODE', 'This barcode is already assigned to another variant.');
    if (target.includes('product_code')) throw new ApiError(409, 'DUPLICATE_PRODUCT_CODE', 'This product code already exists.');
    throw new ApiError(409, 'DUPLICATE_VALUE', 'A unique catalogue value is already in use.');
  }
  throw error;
}

async function validateReferences(categoryId: string, brandId?: string | null, taxRateId?: string | null) {
  const [category, brand, taxRate] = await productsRepository.references(categoryId, brandId, taxRateId);
  if (!category) throw new ApiError(400, 'INVALID_CATEGORY', 'Choose an active category.');
  if (brandId && !brand) throw new ApiError(400, 'INVALID_BRAND', 'Choose an active brand.');
  if (taxRateId && !taxRate) throw new ApiError(400, 'INVALID_TAX_RATE', 'Choose an active tax rate.');
}

export const productsService = {
  async list(input: ProductListQuery) {
    const result = await productsRepository.list(input);
    return {
      ...result,
      items: result.items.map((product) => ({
        ...product,
        totalStock: product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0),
        lowStockVariants: product.variants.filter((variant) => variant.stockQuantity <= variant.minStockLevel).length,
      })),
    };
  },
  async get(id: string) {
    const product = await productsRepository.get(id);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
    return product;
  },
  async create(input: ProductInput, actorId: string, ipAddress?: string) {
    await validateReferences(input.categoryId, input.brandId, input.taxRateId);
    const normalized = { ...input, productCode: input.productCode.toUpperCase(), variants: input.variants.map(normalizeVariant) };
    const skus = normalized.variants.map((variant) => variant.sku);
    const barcodes = normalized.variants.map((variant) => variant.barcode).filter(Boolean);
    if (new Set(skus).size !== skus.length) throw new ApiError(400, 'DUPLICATE_SKU', 'Each variant must have a different SKU.');
    if (new Set(barcodes).size !== barcodes.length) throw new ApiError(400, 'DUPLICATE_BARCODE', 'Each barcode must be unique.');
    try {
      const product = await productsRepository.create(normalized, actorId, ipAddress);
      return productsRepository.get(product.id);
    } catch (error) { return mapConstraint(error); }
  },
  async update(id: string, input: ProductUpdate, actorId: string, ipAddress?: string) {
    if (input.categoryId !== undefined || input.brandId !== undefined || input.taxRateId !== undefined) {
      const current = await productsRepository.get(id);
      if (!current) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
      await validateReferences(input.categoryId ?? current.category.id, input.brandId === undefined ? current.brand?.id : input.brandId, input.taxRateId === undefined ? current.taxRate?.id : input.taxRateId);
    }
    const normalized = { ...input, ...(input.productCode ? { productCode: input.productCode.toUpperCase() } : {}) };
    try {
      const product = await productsRepository.update(id, normalized, actorId, ipAddress);
      if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
      return productsRepository.get(product.id);
    } catch (error) { return mapConstraint(error); }
  },
  async addVariant(productId: string, input: VariantInput, actorId: string, ipAddress?: string) {
    try {
      const variant = await productsRepository.addVariant(productId, normalizeVariant(input), actorId, ipAddress);
      if (!variant) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
      return variant;
    } catch (error) { return mapConstraint(error); }
  },
  async updateVariant(productId: string, variantId: string, input: VariantUpdate, actorId: string, ipAddress?: string) {
    try {
      const variant = await productsRepository.updateVariant(productId, variantId, normalizeVariant(input), actorId, ipAddress);
      if (!variant) throw new ApiError(404, 'VARIANT_NOT_FOUND', 'Product variant was not found.');
      return variant;
    } catch (error) { return mapConstraint(error); }
  },
};
