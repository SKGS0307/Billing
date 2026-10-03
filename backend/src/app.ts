import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { verifyMutationOrigin } from './middleware/origin-check.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { brandsRoutes } from './modules/brands/brands.routes.js';
import { categoriesRoutes } from './modules/categories/categories.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { productsRoutes } from './modules/products/products.routes.js';
import { rolesRoutes } from './modules/roles/roles.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { customersRoutes } from './modules/customers/customers.routes.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { suppliersRoutes } from './modules/suppliers/suppliers.routes.js';
import { cashRoutes } from './modules/cash/cash.routes.js';
import { purchasesRoutes } from './modules/purchases/purchases.routes.js';
import { purchaseReturnsRoutes, saleReturnsRoutes } from './modules/returns/returns.routes.js';
import { expensesRoutes } from './modules/expenses/expenses.routes.js';
import { auditRoutes, settingsRoutes } from './modules/settings/settings.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { dataRoutes } from './modules/data/data.routes.js';
import { backupRoutes } from './modules/backup/backup.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(helmet({ contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false }));
  app.use(cors({ origin: env.APP_URL, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(verifyMutationOrigin);

  app.get('/api/health', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ success: true, data: { status: 'ok', database: 'connected', timestamp: new Date().toISOString() } });
    } catch (error) { next(error); }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/roles', rolesRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/brands', brandsRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/suppliers', suppliersRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/cash-sessions', cashRoutes);
  app.use('/api/purchases', purchasesRoutes);
  app.use('/api/sale-returns', saleReturnsRoutes);
  app.use('/api/purchase-returns', purchaseReturnsRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/data', dataRoutes);
  app.use('/api/backups', backupRoutes);

  if (env.NODE_ENV === 'production') {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
    app.use(express.static(dist));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
