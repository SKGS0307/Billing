import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/api-error.js';
import { categoriesRepository } from './categories.repository.js';

function handleConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ApiError(409, 'CATEGORY_EXISTS', 'A category with this name already exists.');
  }
  throw error;
}

export const categoriesService = {
  list: categoriesRepository.list,
  async create(data: { name: string; description?: string | null }, actorId: string, ipAddress?: string) {
    try { return await categoriesRepository.create(data, actorId, ipAddress); } catch (error) { return handleConflict(error); }
  },
  async update(id: string, data: { name?: string; description?: string | null; isActive?: boolean }, actorId: string, ipAddress?: string) {
    try {
      const category = await categoriesRepository.update(id, data, actorId, ipAddress);
      if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category was not found.');
      return category;
    } catch (error) { return handleConflict(error); }
  },
};
