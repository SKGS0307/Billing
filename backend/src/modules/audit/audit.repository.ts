import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

type Db = PrismaClient | Prisma.TransactionClient;

export function writeAudit(
  data: { actorId?: string; action: string; entityType?: string; entityId?: string; metadata?: Prisma.InputJsonValue; ipAddress?: string },
  db: Db = prisma,
) {
  return db.auditLog.create({ data });
}
