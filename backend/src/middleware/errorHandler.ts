import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { captureException } from '../config/monitoring';
import mongoose from 'mongoose';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error = err;

  // ── Mongoose cast error (invalid ObjectId) ─────────────────────────────
  if (err instanceof mongoose.Error.CastError) {
    error = new ApiError(400, `Invalid ${err.path}: ${err.value}`, [], true, '', 'VALIDATION_INVALID_ID');
  }
  // ── Mongo duplicate key ────────────────────────────────────────────────
  else if ((err as NodeJS.ErrnoException).code === '11000') {
    const field = Object.keys(((err as unknown) as { keyValue?: Record<string, unknown> }).keyValue ?? {})[0] ?? 'field';
    error = new ApiError(409, `${field} already exists`, [], true, '', 'RESOURCE_CONFLICT');
  }
  // ── Mongoose validation error ──────────────────────────────────────────
  else if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(400, 'Validation failed', messages, true, '', 'VALIDATION_FAILED');
  }

  if (error instanceof ApiError) {
    // Operational errors (validation, 404, auth) are expected — don't alert on
    // them. Server-side faults (non-operational, or any 5xx) are real incidents:
    // log with the correlation id and forward to monitoring.
    if (!error.isOperational || error.statusCode >= 500) {
      logger.error('Non-operational error', {
        requestId: req.id,
        error: error.message,
        path: req.path,
        stack: error.stack,
      });
      captureException(error, { requestId: req.id, path: req.path });
    }
    return res.status(error.statusCode).json({
      success: false,
      code: error.code ?? 'ERROR',
      message: error.message,
      requestId: req.id,
      ...(error.errors?.length && { errors: error.errors }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }

  logger.error('Unhandled error', { requestId: req.id, error: err.message, path: req.path, stack: err.stack });
  captureException(err, { requestId: req.id, path: req.path });
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`, [], true, '', 'RESOURCE_NOT_FOUND'));
};
