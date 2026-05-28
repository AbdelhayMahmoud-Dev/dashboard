import api from '@/lib/axios';
import { User } from '@/types';

interface LoginData { email: string; password: string }
interface RegisterData { name: string; email: string; password: string }
interface AuthResponse { user: User; accessToken: string }

export const authService = {
  login: (data: LoginData) =>
    api.post<{ data: AuthResponse }>('/auth/login', data).then((r) => r.data.data),

  register: (data: RegisterData) =>
    api.post<{ data: AuthResponse }>('/auth/register', data).then((r) => r.data.data),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get<{ data: { user: User } }>('/auth/me').then((r) => r.data.data.user),

  refreshToken: () =>
    api.post<{ data: { accessToken: string } }>('/auth/refresh-token').then((r) => r.data.data),

  updateProfile: (data: Partial<User>) =>
    api.patch<{ data: { user: User } }>('/auth/me', data).then((r) => r.data.data.user),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch('/auth/change-password', data),

  deleteAccount: () => api.delete('/auth/me'),
};
