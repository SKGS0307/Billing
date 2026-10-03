import type { Request, Response } from 'express';
import { productsService } from './products.service.js';
import { idSchema, productInputSchema, productListQuerySchema, productUpdateSchema, variantInputSchema, variantUpdateSchema } from './products.schema.js';

export const productsController = {
  async list(req: Request, res: Response) {
    const query = productListQuerySchema.parse(req.query);
    const { items, total } = await productsService.list(query);
    res.json({ success: true, data: items, meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) } });
  },
  async get(req: Request, res: Response) {
    res.json({ success: true, data: await productsService.get(idSchema.parse(req.params.id)) });
  },
  async create(req: Request, res: Response) {
    const product = await productsService.create(productInputSchema.parse(req.body), req.auth!.id, req.ip);
    res.status(201).json({ success: true, data: product });
  },
  async update(req: Request, res: Response) {
    const product = await productsService.update(idSchema.parse(req.params.id), productUpdateSchema.parse(req.body), req.auth!.id, req.ip);
    res.json({ success: true, data: product });
  },
  async addVariant(req: Request, res: Response) {
    const variant = await productsService.addVariant(idSchema.parse(req.params.id), variantInputSchema.parse(req.body), req.auth!.id, req.ip);
    res.status(201).json({ success: true, data: variant });
  },
  async updateVariant(req: Request, res: Response) {
    const variant = await productsService.updateVariant(idSchema.parse(req.params.id), idSchema.parse(req.params.variantId), variantUpdateSchema.parse(req.body), req.auth!.id, req.ip);
    res.json({ success: true, data: variant });
  },
};
