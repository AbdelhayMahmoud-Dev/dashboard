'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { userService } from '@/services/user.service';
import { UserRole } from '@/types';
import { getErrorMessage } from '@/types/api';
import { config } from '@/config';

interface Filters {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

const USER_KEYS = {
  all: ['users'] as const,
  lists: () => [...USER_KEYS.all, 'list'] as const,
  list: (filters: Filters) => [...USER_KEYS.lists(), filters] as const,
  details: () => [...USER_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...USER_KEYS.details(), id] as const,
  auditLogs: (params: object) => [...USER_KEYS.all, 'audit-logs', params] as const,
};

export const useUsers = (filters: Filters = {}) => {
  return useQuery({
    queryKey: USER_KEYS.list(filters),
    queryFn: () => userService.getAll(filters),
    staleTime: config.queryStaleTime,
    placeholderData: (prev) => prev,
  });
};

export const useAuditLogs = (params: { page?: number; limit?: number } = {}) => {
  return useQuery({
    queryKey: USER_KEYS.auditLogs(params),
    queryFn: () => userService.getAuditLogs(params),
    staleTime: config.queryStaleTime,
    placeholderData: (prev) => prev,
  });
};

export const useToggleUserStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userService.toggleStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_KEYS.lists() });
      toast.success('User status updated');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to update user status')),
  });
};

export const useUpdateUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role, permissions }: { id: string; role: UserRole; permissions?: string[] }) =>
      userService.updateRole(id, role, permissions),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: USER_KEYS.lists() });
      qc.invalidateQueries({ queryKey: USER_KEYS.detail(id) });
      toast.success('User role updated');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to update user role')),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_KEYS.lists() });
      toast.success('User deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to delete user')),
  });
};

export { USER_KEYS };
