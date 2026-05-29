import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authorize, hasPermission } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import type { UserRole } from '../models/User';

type ReqUser = { id: string; role: UserRole; permissions: string[] };

function run(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  user?: ReqUser
): { err: unknown; passed: boolean } {
  const req = { user } as unknown as Request;
  const next = vi.fn() as unknown as NextFunction;
  middleware(req, {} as Response, next);
  const calls = (next as unknown as ReturnType<typeof vi.fn>).mock.calls;
  const arg = calls[0]?.[0];
  return { err: arg, passed: calls.length > 0 && arg === undefined };
}

describe('authorize(...roles)', () => {
  it('allows a user whose role is in the list', () => {
    const { passed } = run(authorize('admin', 'super_admin'), {
      id: '1',
      role: 'admin',
      permissions: [],
    });
    expect(passed).toBe(true);
  });

  it('rejects a user whose role is not in the list with 403', () => {
    const { err } = run(authorize('admin'), { id: '1', role: 'viewer', permissions: [] });
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(403);
  });

  it('rejects an unauthenticated request', () => {
    const { err } = run(authorize('admin'));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(403);
  });
});

describe('hasPermission(...permissions)', () => {
  it('lets admins through regardless of explicit permissions (role hierarchy >= 3)', () => {
    const { passed } = run(hasPermission('products:delete'), {
      id: '1',
      role: 'admin',
      permissions: [],
    });
    expect(passed).toBe(true);
  });

  it('allows a viewer that holds every required permission', () => {
    const { passed } = run(hasPermission('products:read', 'orders:read'), {
      id: '1',
      role: 'viewer',
      permissions: ['products:read', 'orders:read'],
    });
    expect(passed).toBe(true);
  });

  it('rejects a viewer missing a required permission with 403', () => {
    const { err } = run(hasPermission('products:read', 'products:delete'), {
      id: '1',
      role: 'viewer',
      permissions: ['products:read'],
    });
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(403);
  });

  it('rejects an unauthenticated request with 401', () => {
    const { err } = run(hasPermission('products:read'));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(401);
  });
});
