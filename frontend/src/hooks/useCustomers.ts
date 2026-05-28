'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customerService } from '@/services/customer.service';
import { Customer } from '@/types';
import { getErrorMessage } from '@/types/api';
import { config } from '@/config';

interface Filters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
}

const CUSTOMER_KEYS = {
  all: ['customers'] as const,
  lists: () => [...CUSTOMER_KEYS.all, 'list'] as const,
  list: (filters: Filters) => [...CUSTOMER_KEYS.lists(), filters] as const,
  details: () => [...CUSTOMER_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CUSTOMER_KEYS.details(), id] as const,
};

export const useCustomers = (filters: Filters = {}) => {
  return useQuery({
    queryKey: CUSTOMER_KEYS.list(filters),
    queryFn: () => customerService.getAll(filters),
    staleTime: config.queryStaleTime,
    placeholderData: (prev) => prev,
  });
};

export const useCustomer = (id: string) => {
  return useQuery({
    queryKey: CUSTOMER_KEYS.detail(id),
    queryFn: () => customerService.getOne(id),
    enabled: !!id,
  });
};

export const useCreateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Customer>) => customerService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      toast.success('Customer created');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to create customer')),
  });
};

export const useUpdateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      customerService.update(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: CUSTOMER_KEYS.detail(id) });
      const previous = qc.getQueryData<Customer>(CUSTOMER_KEYS.detail(id));
      if (previous) {
        qc.setQueryData(CUSTOMER_KEYS.detail(id), { ...previous, ...data });
      }
      return { previous };
    },
    onError: (error, { id }, context) => {
      if (context?.previous) {
        qc.setQueryData(CUSTOMER_KEYS.detail(id), context.previous);
      }
      toast.error(getErrorMessage(error, 'Failed to update customer'));
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.detail(id) });
      toast.success('Customer updated');
    },
  });
};

export const useDeleteCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: customerService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      toast.success('Customer deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to delete customer')),
  });
};

export { CUSTOMER_KEYS };
