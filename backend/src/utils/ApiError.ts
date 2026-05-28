import type { ErrorCode } from '../constants/errorCodes';
import { ERROR_CODES } from '../constants/errorCodes';

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors?: string[];
  public code?: string;

  constructor(
    statusCode: number,
    message: string,
    errors?: string[],
    isOperational = true,
    stack = '',
    code?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    this.code = code;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Factory: build from a typed error code registry entry */
  static fromCode(errorCode: ErrorCode, messageOverride?: string, errors?: string[]): ApiError {
    const entry = ERROR_CODES[errorCode];
    return new ApiError(
      entry.status,
      messageOverride ?? entry.code.replace(/_/g, ' ').toLowerCase(),
      errors,
      true,
      '',
      entry.code
    );
  }
}
