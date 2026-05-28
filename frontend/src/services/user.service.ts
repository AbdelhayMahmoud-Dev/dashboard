import api from '@/lib/axios';
import { User, AuditLog, UserRole, ApiResponse, PaginationMeta } from '@/types';

export const userService = {
  getAll: (params: { page?: number; limit?: number; search?: string; role?: string } = {}) =>
    api.get<ApiResponse<User[]> & { meta: PaginationMeta }>('/users', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<ApiResponse<User>>(`/users/${id}`).then((r) => r.data.data),

  updateRole: (id: string, role: UserRole, permissions?: string[]) =>
    api.patch<ApiResponse<User>>(`/users/${id}/role`, { role, permissions }).then((r) => r.data.data),

  toggleStatus: (id: string) =>
    api.patch<ApiResponse<User>>(`/users/${id}/toggle-status`).then((r) => r.data.data),

  delete: (id: string) => api.delete(`/users/${id}`),

  getAuditLogs: (params: { page?: number; limit?: number } = {}) =>
    api.get<ApiResponse<AuditLog[]> & { meta: PaginationMeta }>('/users/audit-logs', { params })
      .then((r) => r.data),
};
