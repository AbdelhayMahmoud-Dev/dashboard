import api from '@/lib/axios';
import { DashboardStats } from '@/types';

export const analyticsService = {
  getDashboard: () =>
    api.get<{ data: DashboardStats }>('/analytics/dashboard').then((r) => r.data.data),

  getRevenue: (params: { period?: string; year?: string } = {}) =>
    api.get('/analytics/revenue', { params }).then((r) => r.data.data),
};
