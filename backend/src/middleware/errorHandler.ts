import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
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
    if (!error.isOperational) {
      logger.error('Non-operational error', { error: error.message, path: req.path, stack: error.stack });
    }
    return res.status(error.statusCode).json({
      success: false,
      code: error.code ?? 'ERROR',
      message: error.message,
      ...(error.errors?.length && { errors: error.errors }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }

  logger.error('Unhandled error', { error: err.message, path: req.path, stack: err.stack });
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`, [], true, '', 'RESOURCE_NOT_FOUND'));
};
