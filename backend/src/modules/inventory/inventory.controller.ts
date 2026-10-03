import type { Request, Response } from 'express';
import { inventoryService } from './inventory.service.js';
import { adjustmentSchema, inventoryListQuerySchema, movementListQuerySchema } from './inventory.schema.js';

export const inventoryController = {
  async list(req: Request, res: Response) {
    const query = inventoryListQuerySchema.parse(req.query);
    const { items, total, lowStock, outOfStock } = await inventoryService.list(query);
    res.json({ success: true, data: items, meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize), lowStock, outOfStock } });
  },
  async movements(req: Request, res: Response) {
    const query = movementListQuerySchema.parse(req.query);
    const { items, total } = await inventoryService.movements(query);
    res.json({ success: true, data: items, meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) } });
  },
  async adjust(req: Request, res: Response) {
    const result = await inventoryService.adjust(adjustmentSchema.parse(req.body), req.auth!.id, req.ip);
    res.status(201).json({ success: true, data: result });
  },
};
