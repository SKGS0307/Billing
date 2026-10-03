import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/api-error.js';
import { saleInputSchema, salesListQuerySchema } from './sales.schema.js';
import { salesService } from './sales.service.js';

const idSchema = z.string().uuid();
export const salesController = {
  async create(req: Request, res: Response) {
    const key = req.get('idempotency-key')?.trim();
    if (!key || key.length > 100) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Provide a valid Idempotency-Key header.');
    const sale = await salesService.create(saleInputSchema.parse(req.body), key, req.auth!.id, req.ip);
    res.status(201).json({ success: true, data: sale });
  },
  async list(req: Request, res: Response) {
    const query = salesListQuerySchema.parse(req.query); const { items, total } = await salesService.list(query);
    res.json({ success: true, data: items, meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) } });
  },
  async get(req: Request, res: Response) { res.json({ success: true, data: await salesService.get(idSchema.parse(req.params.id)) }); },
  async cancel(req: Request, res: Response) { res.json({ success: true, data: await salesService.cancel(idSchema.parse(req.params.id), req.auth!.id, req.ip) }); },
};
