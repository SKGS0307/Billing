import { ApiError } from '../../lib/api-error.js';
import { inventoryRepository } from './inventory.repository.js';
import type { AdjustmentInput, InventoryListQuery, MovementListQuery } from './inventory.schema.js';

export const inventoryService = {
  list: (input: InventoryListQuery) => inventoryRepository.list(input),
  movements: (input: MovementListQuery) => inventoryRepository.movements(input),
  async adjust(input: AdjustmentInput, actorId: string, ipAddress?: string) {
    const result = await inventoryRepository.adjust(input, actorId, ipAddress);
    if (!result) throw new ApiError(404, 'VARIANT_NOT_FOUND', 'Product variant was not found.');
    if (result.insufficient) {
      const label = [result.variant.color, result.variant.size].filter(Boolean).join(' / ') || result.variant.sku;
      throw new ApiError(409, 'INSUFFICIENT_STOCK', `${result.variant.product.name} (${label}) has only ${result.variant.stockQuantity} pieces available.`);
    }
    return result;
  },
};
