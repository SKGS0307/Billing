import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
const prisma = new PrismaClient();

const permissions = [
  ['dashboard:read', 'View the operational dashboard'],
  ['users:read', 'View users'],
  ['users:manage', 'Create and manage users'],
  ['roles:read', 'View roles and permissions'],
  ['roles:manage', 'Manage role permissions'],
  ['settings:manage', 'Manage critical application settings'],
  ['pos:access', 'Access the point of sale'],
  ['products:read', 'View the product catalogue'],
  ['products:manage', 'Create and manage products, categories, brands and variants'],
  ['inventory:read', 'View stock balances and movement history'],
  ['inventory:adjust', 'Create audited stock adjustments'],
  ['sales:read', 'View sales and invoices'],
  ['sales:create', 'Complete POS sales'],
  ['sales:return', 'Create sales returns and exchanges'],
  ['sales:cancel', 'Cancel eligible sales'],
  ['customers:read', 'View customers and ledgers'],
  ['customers:manage', 'Create and update customers'],
  ['customers:payment', 'Record customer payments'],
  ['suppliers:read', 'View suppliers and ledgers'],
  ['suppliers:manage', 'Create and update suppliers'],
  ['suppliers:payment', 'Record supplier payments'],
  ['purchases:read', 'View purchases'],
  ['purchases:manage', 'Create purchases'],
  ['purchases:return', 'Create purchase returns'],
  ['expenses:read', 'View expenses'],
  ['expenses:manage', 'Create and cancel expenses'],
  ['cash:manage', 'Open, operate and close cash sessions'],
  ['reports:read', 'View and export business reports'],
  ['taxes:manage', 'Manage GST tax rates'],
  ['coupons:manage', 'Manage coupons'],
  ['backup:manage', 'Create and inspect database backups'],
  ['data:import', 'Import validated product data'],
  ['data:export', 'Export business data'],
  ['audit:read', 'View security and business audit logs'],
] as const;

const rolePermissions: Record<string, string[]> = {
  Admin: permissions.map(([code]) => code),
  Manager: [
    'dashboard:read', 'pos:access', 'products:read', 'products:manage', 'inventory:read', 'inventory:adjust',
    'sales:read', 'sales:create', 'sales:return', 'sales:cancel', 'customers:read', 'customers:manage', 'customers:payment',
    'suppliers:read', 'suppliers:manage', 'suppliers:payment', 'purchases:read', 'purchases:manage', 'purchases:return',
    'expenses:read', 'expenses:manage', 'cash:manage', 'reports:read', 'data:export', 'audit:read',
  ],
  Cashier: [
    'dashboard:read', 'pos:access', 'products:read', 'inventory:read', 'sales:read', 'sales:create',
    'customers:read', 'customers:manage', 'customers:payment', 'cash:manage',
  ],
};

async function main() {
  for (const [code, description] of permissions) {
    await prisma.permission.upsert({ where: { code }, update: { description }, create: { code, description } });
  }
  for (const [name, codes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name }, update: { isActive: true },
      create: { name, isSystem: true, description: `${name} system role` },
    });
    const grants = await prisma.permission.findMany({ where: { code: { in: codes } }, select: { id: true } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: grants.map(({ id }) => ({ roleId: role.id, permissionId: id })) });
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@trendmart.local').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: 'Development Administrator', isActive: true },
    create: { email, name: 'Development Administrator', passwordHash, mustChangePassword: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {}, create: { userId: user.id, roleId: adminRole.id },
  });
  await prisma.setting.upsert({
    where: { key: 'store.profile' }, update: {},
    create: { key: 'store.profile', value: { name: 'The Trends Mart', city: 'Bareilly', state: 'Uttar Pradesh', currency: 'INR', timezone: 'Asia/Kolkata' } },
  });
  const taxRates = [['GST 0%', '0'], ['GST 5%', '5'], ['GST 12%', '12'], ['GST 18%', '18']] as const;
  for (const [name, rate] of taxRates) {
    await prisma.taxRate.upsert({ where: { name }, update: { rate, isActive: true }, create: { name, rate } });
  }
  for (const name of ['Rent', 'Electricity', 'Salary', 'Internet', 'Transport', 'Packaging', 'Marketing', 'Maintenance', 'Food', 'Miscellaneous']) {
    await prisma.expenseCategory.upsert({ where: { name }, update: { isActive: true }, create: { name } });
  }
  await prisma.setting.upsert({
    where: { key: 'invoice.configuration' }, update: {},
    create: { key: 'invoice.configuration', value: { prefix: 'TTM', returnPrefix: 'TTMR', purchasePrefix: 'PUR', purchaseReturnPrefix: 'PURR', footer: 'Thank you for shopping with The Trends Mart.', returnPolicy: 'Returns and exchanges are subject to store policy.' } },
  });
}

main().finally(() => prisma.$disconnect());
