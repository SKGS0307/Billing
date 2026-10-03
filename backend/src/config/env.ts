import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32).max(512),
  APP_URL: z.string().url().transform((value) => value.replace(/\/$/, '')),
  STORE_TIMEZONE: z.string().default('Asia/Kolkata'),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(168).default(12),
  COOKIE_SECURE: booleanString.default('false'),
  SERVE_FRONTEND: booleanString.default('false'),
  ALLOW_DATABASE_RESTORE: booleanString.default('false'),
  API_RATE_LIMIT: z.coerce.number().int().min(100).max(10_000).default(1000),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && /replace|change.?me|development/i.test(value.AUTH_SECRET)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['AUTH_SECRET'], message: 'Production AUTH_SECRET must be a generated secret.' });
  }
});

export const env = schema.parse(process.env);
