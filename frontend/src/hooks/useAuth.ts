'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/types/api';
import { User } from '@/types';

export const useAuth = () => {
  const { user, isAuthenticated, setAuth, setUser, clearAuth } = useAuthStore();
  const router = useRouter();

  /**
   * WHY useQueryClient() instead of the singleton import:
   *   After moving QueryClient creation into useState inside Providers, the
   *   singleton no longer exists. Even if it did, calling methods on a
   *   different instance than the one the Provider is using would silently
   *   no-op (e.g. queryClient.clear() would clear a shadow cache, not the
   *   real one). useQueryClient() always returns the instance provided by the
   *   nearest QueryClientProvider — guaranteed to be the same one that holds
   *   the live cache.
   */
  const qc = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      toast.success(`Welcome back, ${data.user.name}!`);
      router.push('/dashboard');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Login failed'));
    },
  });

  const registerMutation = useMutation({
    mutationFn: authService.register,
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      toast.success('Account created successfully!');
      router.push('/dashboard');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Registration failed'));
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      clearAuth();
      qc.clear(); // clears the real cache held by the active QueryClientProvider
      router.push('/login');
      toast.success('Logged out successfully');
    },
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: authService.getMe,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  // TanStack Query v5 removed onError from useQuery — handle via useEffect.
  // If /me fails while we think we're authenticated, clear stale auth state.
  // 401 is handled upstream: the axios interceptor attempts a token refresh and
  // calls forceLogout() on failure. This guard covers the remaining cases:
  // account deactivated (403), account deleted (404), unexpected server errors.
  useEffect(() => {
    if (meQuery.isError && isAuthenticated) {
      clearAuth();
    }
  }, [meQuery.isError, isAuthenticated, clearAuth]);

  const updateProfileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (data: User) => {
      setUser(data);
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Update failed'));
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: authService.deleteAccount,
    onSuccess: () => {
      clearAuth();
      qc.clear();
      router.push('/login');
      toast.success('Account deleted successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete account'));
    },
  });

  return {
    user: meQuery.data || user,
    isAuthenticated,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    updateProfile: updateProfileMutation.mutate,
    deleteAccount: deleteAccountMutation.mutate,
    isDeletingAccount: deleteAccountMutation.isPending,
  };
};
