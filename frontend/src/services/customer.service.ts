import api from '@/lib/axios';
import { Customer, ApiResponse, PaginationMeta } from '@/types';

interface CustomerFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
}

export const customerService = {
  getAll: (filters: CustomerFilters = {}) =>
    api.get<ApiResponse<Customer[]> & { meta: PaginationMeta }>('/customers', { params: filters })
      .then((r) => r.data),

  getOne: (id: string) =>
    api.get<ApiResponse<{ customer: Customer; recentOrders: unknown[] }>>(`/customers/${id}`)
      .then((r) => r.data.data),

  create: (data: Partial<Customer>) =>
    api.post<ApiResponse<Customer>>('/customers', data).then((r) => r.data.data),

  update: (id: string, data: Partial<Customer>) =>
    api.patch<ApiResponse<Customer>>(`/customers/${id}`, data).then((r) => r.data.data),

  delete: (id: string) => api.delete(`/customers/${id}`),
};
