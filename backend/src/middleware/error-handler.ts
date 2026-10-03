import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { ApiError } from '../lib/api-error.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} was not found.`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  void next;
  const requestError = error as { status?: unknown; type?: unknown };
  if (requestError.status === 413) {
    res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' } });
    return;
  }
  if (requestError.status === 400 && requestError.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'The request body must contain valid JSON.' } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'The request contains invalid data.', details: error.flatten() },
    });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002' || error.code === 'P2003') {
      res.status(409).json({ success: false, error: { code: 'DATA_CONFLICT', message: 'The request conflicts with existing data.' } });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'The requested record was not found.' } });
      return;
    }
    if (error.code === 'P2034') {
      res.status(409).json({ success: false, error: { code: 'TRANSACTION_CONFLICT', message: 'The data changed during this request. Please retry.' } });
      return;
    }
  }
  logger.error({ err: error, requestId: req.id }, 'Unhandled request error');
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
};
