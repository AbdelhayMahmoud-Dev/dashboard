'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { orderService } from '@/services/order.service';
import { Order, OrderStatus } from '@/types';
import { getErrorMessage } from '@/types/api';
import { config } from '@/config';

interface Filters {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  search?: string;
  sort?: string;
  startDate?: string;
  endDate?: string;
}

const ORDER_KEYS = {
  all: ['orders'] as const,
  lists: () => [...ORDER_KEYS.all, 'list'] as const,
  list: (filters: Filters) => [...ORDER_KEYS.lists(), filters] as const,
  details: () => [...ORDER_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...ORDER_KEYS.details(), id] as const,
  stats: () => [...ORDER_KEYS.all, 'stats'] as const,
};

export const useOrders = (filters: Filters = {}) => {
  return useQuery({
    queryKey: ORDER_KEYS.list(filters),
    queryFn: () => orderService.getAll(filters),
    staleTime: config.queryStaleTime,
    placeholderData: (prev) => prev,
  });
};

export const useOrder = (id: string) => {
  return useQuery({
    queryKey: ORDER_KEYS.detail(id),
    queryFn: () => orderService.getOne(id),
    enabled: !!id,
  });
};

export const useOrderStats = () => {
  return useQuery({
    queryKey: ORDER_KEYS.stats(),
    queryFn: orderService.getStats,
    staleTime: config.analyticsStaleTime,
  });
};

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) =>
      orderService.updateStatus(id, status, note),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ORDER_KEYS.detail(id) });
      const previous = qc.getQueryData<Order>(ORDER_KEYS.detail(id));
      if (previous) {
        qc.setQueryData(ORDER_KEYS.detail(id), { ...previous, status });
      }
      return { previous };
    },
    onError: (error, { id }, context) => {
      if (context?.previous) {
        qc.setQueryData(ORDER_KEYS.detail(id), context.previous);
      }
      toast.error(getErrorMessage(error, 'Failed to update order'));
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      qc.invalidateQueries({ queryKey: ORDER_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ORDER_KEYS.stats() });
      toast.success('Order status updated');
    },
  });
};

export const useDeleteOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orderService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDER_KEYS.lists() });
      qc.invalidateQueries({ queryKey: ORDER_KEYS.stats() });
      toast.success('Order deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to delete order')),
  });
};

export { ORDER_KEYS };
