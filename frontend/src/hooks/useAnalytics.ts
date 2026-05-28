'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics.service';
import { config } from '@/config';

const ANALYTICS_KEYS = {
  all: ['analytics'] as const,
  dashboard: () => [...ANALYTICS_KEYS.all, 'dashboard'] as const,
  revenue: (params: object) => [...ANALYTICS_KEYS.all, 'revenue', params] as const,
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ANALYTICS_KEYS.dashboard(),
    queryFn: analyticsService.getDashboard,
    staleTime: config.analyticsStaleTime,
    // Don't retry on permission/auth errors — surface them immediately.
    retry: false,
  });
};

export const useRevenueChart = (params: { period?: string; year?: string } = {}) => {
  return useQuery({
    queryKey: ANALYTICS_KEYS.revenue(params),
    queryFn: () => analyticsService.getRevenue(params),
    staleTime: config.analyticsStaleTime,
    retry: false,
  });
};

export { ANALYTICS_KEYS };
