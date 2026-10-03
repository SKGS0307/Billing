import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const verifyMutationOrigin: RequestHandler = (req, _res, next) => {
  if (safeMethods.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) {
    if (env.NODE_ENV === 'production') return next(new ApiError(403, 'ORIGIN_REQUIRED', 'A trusted request origin is required.'));
    return next();
  }
  if (origin.replace(/\/$/, '') !== env.APP_URL) return next(new ApiError(403, 'INVALID_ORIGIN', 'Request origin is not allowed.'));
  next();
};
