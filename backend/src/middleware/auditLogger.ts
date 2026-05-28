import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';

export const auditLog = (action: string, resource: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (req.user) {
      try {
        await AuditLog.create({
          user: req.user.id,
          action,
          resource,
          resourceId: req.params.id as string | undefined,
          details: { body: req.body, query: req.query as Record<string, string> },
          ipAddress: (req.ip || '').toString(),
          userAgent: String(req.headers['user-agent'] || ''),
        });
      } catch {
        // Audit logging should not block request flow
      }
    }
    next();
  };
};
