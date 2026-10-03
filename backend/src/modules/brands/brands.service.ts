import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/api-error.js';
import { brandsRepository } from './brands.repository.js';

function handleConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ApiError(409, 'BRAND_EXISTS', 'A brand with this name already exists.');
  }
  throw error;
}

export const brandsService = {
  list: brandsRepository.list,
  async create(name: string, actorId: string, ipAddress?: string) {
    try { return await brandsRepository.create(name, actorId, ipAddress); } catch (error) { return handleConflict(error); }
  },
  async update(id: string, data: { name?: string; isActive?: boolean }, actorId: string, ipAddress?: string) {
    try {
      const brand = await brandsRepository.update(id, data, actorId, ipAddress);
      if (!brand) throw new ApiError(404, 'BRAND_NOT_FOUND', 'Brand was not found.');
      return brand;
    } catch (error) { return handleConflict(error); }
  },
};
