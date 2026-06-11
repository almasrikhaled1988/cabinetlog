import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiClient from '@/api/client';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'worker';
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  function restore() {
    const storedToken = localStorage.getItem('token');
    const storedRefreshToken = localStorage.getItem('refreshToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken) token.value = storedToken;
    if (storedRefreshToken) refreshToken.value = storedRefreshToken;

    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser);
      } catch {
        user.value = null;
        localStorage.removeItem('user');
      }
    }
  }

  async function login(email: string, password: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<{
        token: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/login', { email, password });

      const { token: newToken, refreshToken: newRefresh, user: newUser } = response.data;

      token.value = newToken;
      refreshToken.value = newRefresh;
      user.value = newUser;

      localStorage.setItem('token', newToken);
      localStorage.setItem('refreshToken', newRefresh);
      localStorage.setItem('user', JSON.stringify(newUser));
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        error.value = axiosErr.response?.data?.error?.message || 'Login failed';
      } else {
        error.value = 'Network error. Please try again.';
      }
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function refreshAccessToken(): Promise<boolean> {
    const storedRefresh = refreshToken.value || localStorage.getItem('refreshToken');
    if (!storedRefresh) return false;

    try {
      const response = await apiClient.post<{ token: string }>('/auth/refresh', {
        refreshToken: storedRefresh,
      });

      token.value = response.data.token;
      localStorage.setItem('token', response.data.token);
      return true;
    } catch {
      // Refresh failed — force logout
      logout();
      return false;
    }
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  }

  function logout() {
    const storedRefresh = refreshToken.value;
    if (storedRefresh) {
      apiClient.post('/auth/logout', { refreshToken: storedRefresh }).catch(() => {});
    }

    token.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  restore();

  return {
    token,
    refreshToken,
    user,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    restore,
    refreshAccessToken,
    changePassword,
  };
});
