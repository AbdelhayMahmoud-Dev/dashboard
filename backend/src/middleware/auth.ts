import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';
import User, { UserRole } from '../models/User';

interface JwtPayload {
  id: string;
  role: UserRole;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        permissions: string[];
      };
    }
  }
}

export const protect = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new ApiError(401, 'Access denied. No token provided.');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    const user = await User.findById(decoded.id).select('role isActive permissions');
    if (!user || !user.isActive) {
      throw new ApiError(401, 'User not found or deactivated.');
    }

    req.user = { id: decoded.id, role: decoded.role, permissions: user.permissions };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, 'Invalid or expired token.'));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };
};

export const hasPermission = (...permissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated.'));
    }
    const roleHierarchy: Record<UserRole, number> = {
      super_admin: 4,
      admin: 3,
      manager: 2,
      viewer: 1,
    };
    if (roleHierarchy[req.user.role] >= 3) return next();
    const hasAll = permissions.every((p) => req.user!.permissions.includes(p));
    if (!hasAll) {
      return next(new ApiError(403, 'Insufficient permissions.'));
    }
    next();
  };
};
