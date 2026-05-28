'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { productService } from '@/services/product.service';
import { Product } from '@/types';
import { getErrorMessage } from '@/types/api';
import { config } from '@/config';

interface Filters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
}

const PRODUCT_KEYS = {
  all: ['products'] as const,
  lists: () => [...PRODUCT_KEYS.all, 'list'] as const,
  list: (filters: Filters) => [...PRODUCT_KEYS.lists(), filters] as const,
  details: () => [...PRODUCT_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PRODUCT_KEYS.details(), id] as const,
  categories: () => [...PRODUCT_KEYS.all, 'categories'] as const,
};

export const useProducts = (filters: Filters = {}) => {
  return useQuery({
    queryKey: PRODUCT_KEYS.list(filters),
    queryFn: () => productService.getAll(filters),
    staleTime: config.queryStaleTime,
    placeholderData: (prev) => prev,
  });
};

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: PRODUCT_KEYS.detail(id),
    queryFn: () => productService.getOne(id),
    enabled: !!id,
  });
};

export const useProductCategories = () => {
  return useQuery({
    queryKey: PRODUCT_KEYS.categories(),
    queryFn: productService.getCategories,
    staleTime: 1000 * 60 * 30,
  });
};

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) => productService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.categories() });
      toast.success('Product created successfully');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to create product')),
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productService.update(id, data),
    onMutate: async ({ id, data }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: PRODUCT_KEYS.detail(id) });
      const previous = qc.getQueryData<Product>(PRODUCT_KEYS.detail(id));
      if (previous) {
        qc.setQueryData(PRODUCT_KEYS.detail(id), { ...previous, ...data });
      }
      return { previous };
    },
    onError: (error, { id }, context) => {
      if (context?.previous) {
        qc.setQueryData(PRODUCT_KEYS.detail(id), context.previous);
      }
      toast.error(getErrorMessage(error, 'Failed to update product'));
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.detail(id) });
      toast.success('Product updated successfully');
    },
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.categories() });
      toast.success('Product deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to delete product')),
  });
};

export { PRODUCT_KEYS };
