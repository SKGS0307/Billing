import { execFile } from 'node:child_process';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';

const run = promisify(execFile); const backupDirectory = path.resolve(process.cwd(), process.env.BACKUP_PATH ?? './storage/backups');
const databaseUrl = new URL(env.DATABASE_URL);
const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
const databaseUser = decodeURIComponent(databaseUrl.username);
const pgEnvironment = {
  ...process.env,
  PGHOST: databaseUrl.hostname,
  PGPORT: databaseUrl.port || '5432',
  PGUSER: databaseUser,
  PGPASSWORD: decodeURIComponent(databaseUrl.password),
  PGDATABASE: databaseName,
  ...(databaseUrl.searchParams.get('sslmode') ? { PGSSLMODE: databaseUrl.searchParams.get('sslmode')! } : {}),
};
const composeDirectory = path.basename(process.cwd()) === 'backend' ? path.resolve(process.cwd(), '..') : process.cwd();
function safeName(input: string) { const name = path.basename(input); if (!/^trends-mart-[\dT-]+\.dump$/.test(name)) throw new ApiError(400, 'INVALID_BACKUP_NAME', 'Invalid backup filename.'); return name; }
async function dockerContainer() { const result = await run('docker', ['compose', '--project-directory', composeDirectory, 'ps', '-q', 'postgres']); const id = result.stdout.trim(); if (!id) throw new Error('PostgreSQL Docker container is not running.'); return id; }
async function createDump(target: string, name: string) { try { await run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', target], { timeout: 120_000, env: pgEnvironment }); } catch (error) { if (!(error instanceof Error) || !error.message.includes('version mismatch')) throw error; const container = await dockerContainer(); const temporary = `/tmp/${name}`; await run('docker', ['exec', container, 'pg_dump', '--username', databaseUser, '--dbname', databaseName, '--format=custom', '--no-owner', '--no-privileges', '--file', temporary], { timeout: 120_000 }); await run('docker', ['cp', `${container}:${temporary}`, target], { timeout: 120_000 }); await run('docker', ['exec', container, 'rm', temporary]); } }
async function restoreDump(target: string, name: string) { try { await run('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', databaseName, target], { timeout: 300_000, env: pgEnvironment }); } catch (error) { const message = error instanceof Error ? error.message : ''; if (!message.includes('unsupported version') && !message.includes('version mismatch')) throw error; const container = await dockerContainer(); const temporary = `/tmp/${name}`; await run('docker', ['cp', target, `${container}:${temporary}`], { timeout: 120_000 }); try { await run('docker', ['exec', container, 'pg_restore', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--username', databaseUser, '--dbname', databaseName, temporary], { timeout: 300_000 }); } finally { await run('docker', ['exec', container, 'rm', temporary]).catch(() => undefined); } } }

export const backupRoutes = Router(); backupRoutes.use(authenticate, requirePermission('backup:manage'));
backupRoutes.get('/', asyncHandler(async (_req, res) => { await mkdir(backupDirectory, { recursive: true }); const names = await readdir(backupDirectory); const files = await Promise.all(names.filter((name) => name.endsWith('.dump')).map(async (name) => { const info = await stat(path.join(backupDirectory, name)); return { name, size: info.size, createdAt: info.birthtime }; })); res.json({ success: true, data: files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) }); }));
backupRoutes.get('/:name/download', asyncHandler(async (req, res) => { const name = safeName(z.string().parse(req.params.name)); const target = path.join(backupDirectory, name); await stat(target).catch(() => { throw new ApiError(404, 'BACKUP_NOT_FOUND', 'Backup was not found.'); }); res.download(target, name); }));
backupRoutes.post('/', asyncHandler(async (req, res) => { await mkdir(backupDirectory, { recursive: true }); const name = `trends-mart-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.dump`; const target = path.join(backupDirectory, name); try { await createDump(target, name); } catch (error) { await unlink(target).catch(() => undefined); logger.error({ operation: 'database_backup', errorType: error instanceof Error ? error.name : 'unknown' }, 'Database backup failed'); throw new ApiError(500, 'BACKUP_FAILED', 'Database backup failed. Check the server logs and PostgreSQL tools.'); } await prisma.auditLog.create({ data: { actorId: req.auth!.id, action: 'DATABASE_BACKUP_CREATED', entityType: 'backup', entityId: name, ipAddress: req.ip } }); const info = await stat(target); res.status(201).json({ success: true, data: { name, size: info.size, createdAt: info.birthtime } }); }));
backupRoutes.post('/:name/restore', asyncHandler(async (req, res) => { if (!env.ALLOW_DATABASE_RESTORE) throw new ApiError(403, 'DATABASE_RESTORE_DISABLED', 'Database restore is disabled on this deployment.'); const name = safeName(z.string().parse(req.params.name)); const input = z.object({ confirmation: z.string() }).parse(req.body); if (input.confirmation !== `RESTORE ${name}`) throw new ApiError(400, 'RESTORE_CONFIRMATION_REQUIRED', `Type RESTORE ${name} to confirm.`); const target = path.join(backupDirectory, name); await stat(target).catch(() => { throw new ApiError(404, 'BACKUP_NOT_FOUND', 'Backup was not found.'); }); try { await restoreDump(target, name); } catch (error) { logger.error({ operation: 'database_restore', errorType: error instanceof Error ? error.name : 'unknown' }, 'Database restore failed'); throw new ApiError(500, 'RESTORE_FAILED', 'Database restore failed. Check the server logs and PostgreSQL tools.'); } res.json({ success: true, data: { restored: name } }); }));
