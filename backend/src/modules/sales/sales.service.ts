import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/api-error.js';
import { salesRepository } from './sales.repository.js';
import type { SaleInput, SalesListQuery } from './sales.schema.js';

export const salesService = {
  async create(input: SaleInput, idempotencyKey: string, actorId: string, ipAddress?: string) {
    const existing = await salesRepository.findByIdempotency(idempotencyKey);
    if (existing) return existing;
    try { return await salesRepository.create(input, idempotencyKey, actorId, ipAddress); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await salesRepository.findByIdempotency(idempotencyKey);
        if (replay) return replay;
      }
      throw error;
    }
  },
  list: (input: SalesListQuery) => salesRepository.list(input),
  async get(id: string) {
    const sale = await salesRepository.get(id);
    if (!sale) throw new ApiError(404, 'SALE_NOT_FOUND', 'Sale was not found.');
    return sale;
  },
  async cancel(id: string, actorId: string, ipAddress?: string) {
    const sale = await salesRepository.cancel(id, actorId, ipAddress);
    if (!sale) throw new ApiError(404, 'SALE_NOT_FOUND', 'Sale was not found.');
    return sale;
  },
};
