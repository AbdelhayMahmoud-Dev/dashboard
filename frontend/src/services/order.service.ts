import api from '@/lib/axios';
import { Order, OrderStatus, ApiResponse, PaginationMeta } from '@/types';

interface OrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  search?: string;
  sort?: string;
  startDate?: string;
  endDate?: string;
}

export const orderService = {
  getAll: (filters: OrderFilters = {}) =>
    api.get<ApiResponse<Order[]> & { meta: PaginationMeta }>('/orders', { params: filters })
      .then((r) => r.data),

  getOne: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`).then((r) => r.data.data),

  create: (data: Partial<Order>) =>
    api.post<ApiResponse<Order>>('/orders', data).then((r) => r.data.data),

  updateStatus: (id: string, status: OrderStatus, note?: string) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/status`, { status, note }).then((r) => r.data.data),

  delete: (id: string) => api.delete(`/orders/${id}`),

  getStats: () => api.get('/orders/stats').then((r) => r.data.data),
};
