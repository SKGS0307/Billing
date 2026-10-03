import type { Request, Response } from 'express';
import { z } from 'zod';
import { brandsService } from './brands.service.js';
import { brandInputSchema, brandQuerySchema, brandUpdateSchema } from './brands.schema.js';

const idSchema = z.string().uuid();

export const brandsController = {
  async list(req: Request, res: Response) {
    const query = brandQuerySchema.parse(req.query);
    res.json({ success: true, data: await brandsService.list(query.includeInactive) });
  },
  async create(req: Request, res: Response) {
    const input = brandInputSchema.parse(req.body);
    res.status(201).json({ success: true, data: await brandsService.create(input.name, req.auth!.id, req.ip) });
  },
  async update(req: Request, res: Response) {
    const brand = await brandsService.update(idSchema.parse(req.params.id), brandUpdateSchema.parse(req.body), req.auth!.id, req.ip);
    res.json({ success: true, data: brand });
  },
};
