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
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  // Restore token and user from localStorage on store creation
  function restore() {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken) {
      token.value = storedToken;
    }

    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser);
      } catch {
        user.value = null;
        localStorage.removeItem('user');
      }
    }
  }

  // Login action
  async function login(email: string, password: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<{ token: string; user: AuthUser }>(
        '/auth/login',
        { email, password }
      );

      const { token: newToken, user: newUser } = response.data;

      // Update state
      token.value = newToken;
      user.value = newUser;

      // Persist to localStorage
      localStorage.setItem('token', newToken);
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

  // Logout action
  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  // Initialize on creation
  restore();

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    restore,
  };
});
