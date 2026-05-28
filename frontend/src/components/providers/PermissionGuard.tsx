'use client';

import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

interface PermissionGuardProps {
  children: React.ReactNode;
  roles?: UserRole[];
  permissions?: string[];
  fallback?: React.ReactNode;
  requireAll?: boolean;
}

export function PermissionGuard({
  children,
  roles,
  permissions,
  fallback = null,
  requireAll = false,
}: PermissionGuardProps) {
  const { user } = useAuthStore();

  if (!user) return <>{fallback}</>;

  if (roles && roles.length > 0) {
    const hasRole = roles.includes(user.role);
    if (!hasRole) return <>{fallback}</>;
  }

  if (permissions && permissions.length > 0) {
    const check = requireAll
      ? permissions.every((p) => user.permissions.includes(p))
      : permissions.some((p) => user.permissions.includes(p));
    if (!check) return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function usePermissions() {
  const { user } = useAuthStore();

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const hasPermission = (...permissions: string[]) => {
    if (!user) return false;
    return permissions.every((p) => user.permissions.includes(p));
  };

  const hasAnyPermission = (...permissions: string[]) => {
    if (!user) return false;
    return permissions.some((p) => user.permissions.includes(p));
  };

  const isAdmin = () => hasRole('admin', 'super_admin');
  const isSuperAdmin = () => hasRole('super_admin');

  return { hasRole, hasPermission, hasAnyPermission, isAdmin, isSuperAdmin, user };
}
