import type { RequestHandler } from 'express';
import { ApiError } from '../lib/api-error.js';

export function requirePermission(...required: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.'));
    if (req.auth.mustChangePassword) return next(new ApiError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your temporary password before continuing.'));
    const allowed = required.every((permission) => req.auth?.permissions.includes(permission));
    if (!allowed) return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    next();
  };
}
