import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id for this request — set by the requestId middleware. */
      id?: string;
    }
  }
}

/**
 * Assigns every request a correlation id and echoes it back as `X-Request-Id`.
 *
 * If an upstream proxy / the client already sent an `X-Request-Id`, we honour
 * it so a single id can be traced across services and into the client's network
 * tab. Otherwise we mint a UUID. The error handler and any structured log can
 * then stamp `req.id`, making "find every log line for this one failed request"
 * a trivial grep instead of guesswork.
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers['x-request-id'];
  const id = (Array.isArray(incoming) ? incoming[0] : incoming)?.trim() || randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};
