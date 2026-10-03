import { z } from 'zod';

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const createUserSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
  roles: z.array(z.string().trim().min(1).max(50)).min(1),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
  roles: z.array(z.string().trim().min(1).max(50)).min(1).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const userIdSchema = z.string().uuid();
