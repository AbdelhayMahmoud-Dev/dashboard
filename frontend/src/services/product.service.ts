import api from '@/lib/axios';
import { Product, ApiResponse, PaginationMeta } from '@/types';

interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
}

export const productService = {
  getAll: (filters: ProductFilters = {}) =>
    api.get<ApiResponse<Product[]> & { meta: PaginationMeta }>('/products', { params: filters })
      .then((r) => r.data),

  getOne: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/${id}`).then((r) => r.data.data),

  create: (data: Partial<Product>) =>
    api.post<ApiResponse<Product>>('/products', data).then((r) => r.data.data),

  update: (id: string, data: Partial<Product>) =>
    api.patch<ApiResponse<Product>>(`/products/${id}`, data).then((r) => r.data.data),

  delete: (id: string) => api.delete(`/products/${id}`),

  getCategories: () =>
    api.get<ApiResponse<string[]>>('/products/categories').then((r) => r.data.data),

  uploadImages: (files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('images', f));
    return api.post<ApiResponse<{ urls: string[] }>>('/products/upload/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data.urls);
  },
};
