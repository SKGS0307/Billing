import type { Request, Response } from 'express';
import { createUserSchema, updateUserSchema, userIdSchema, userListQuerySchema } from './users.schema.js';
import { usersService } from './users.service.js';

export async function listUsers(req: Request, res: Response) {
  const query = userListQuerySchema.parse(req.query);
  const { items, total } = await usersService.list(query);
  res.json({
    success: true,
    data: items,
    meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) },
  });
}

export async function createUser(req: Request, res: Response) {
  const input = createUserSchema.parse(req.body);
  const user = await usersService.create(input, { id: req.auth!.id, ipAddress: req.ip });
  res.status(201).json({ success: true, data: user });
}

export async function updateUser(req: Request, res: Response) {
  const id = userIdSchema.parse(req.params.id);
  const input = updateUserSchema.parse(req.body);
  const user = await usersService.update({ id, ...input }, { id: req.auth!.id, ipAddress: req.ip });
  res.json({ success: true, data: user });
}
