import type { Request, Response } from 'express';
import { z } from 'zod';
import { categoriesService } from './categories.service.js';
import { categoryInputSchema, categoryQuerySchema, categoryUpdateSchema } from './categories.schema.js';

const idSchema = z.string().uuid();

export const categoriesController = {
  async list(req: Request, res: Response) {
    const query = categoryQuerySchema.parse(req.query);
    res.json({ success: true, data: await categoriesService.list(query.includeInactive) });
  },
  async create(req: Request, res: Response) {
    const category = await categoriesService.create(categoryInputSchema.parse(req.body), req.auth!.id, req.ip);
    res.status(201).json({ success: true, data: category });
  },
  async update(req: Request, res: Response) {
    const category = await categoriesService.update(idSchema.parse(req.params.id), categoryUpdateSchema.parse(req.body), req.auth!.id, req.ip);
    res.json({ success: true, data: category });
  },
};
