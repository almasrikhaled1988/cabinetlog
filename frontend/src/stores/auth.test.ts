import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './auth';

// Mock the API client
vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

import apiClient from '@/api/client';

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with null token and user when localStorage is empty', () => {
      const store = useAuthStore();
      expect(store.token).toBeNull();
      expect(store.user).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(store.isAdmin).toBe(false);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('restores token and user from localStorage', () => {
      const mockUser = { _id: '123', name: 'Test', email: 'test@example.com', role: 'admin' as const };
      localStorage.setItem('token', 'stored-jwt-token');
      localStorage.setItem('user', JSON.stringify(mockUser));

      const store = useAuthStore();
      expect(store.token).toBe('stored-jwt-token');
      expect(store.user).toEqual(mockUser);
      expect(store.isAuthenticated).toBe(true);
      expect(store.isAdmin).toBe(true);
    });

    it('handles corrupted user JSON in localStorage gracefully', () => {
      localStorage.setItem('token', 'some-token');
      localStorage.setItem('user', 'not-valid-json');

      const store = useAuthStore();
      expect(store.token).toBe('some-token');
      expect(store.user).toBeNull();
    });
  });

  describe('login', () => {
    it('calls API and stores token and user on success', async () => {
      const mockResponse = {
        data: {
          token: 'new-jwt-token',
          user: { _id: '456', name: 'Admin', email: 'admin@example.com', role: 'admin' },
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const store = useAuthStore();
      await store.login('admin@example.com', 'password123');

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@example.com',
        password: 'password123',
      });
      expect(store.token).toBe('new-jwt-token');
      expect(store.user).toEqual(mockResponse.data.user);
      expect(store.isAuthenticated).toBe(true);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();

      // Verify localStorage persistence
      expect(localStorage.getItem('token')).toBe('new-jwt-token');
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockResponse.data.user));
    });

    it('sets error on failed login with server error message', async () => {
      const axiosError = {
        response: { data: { error: { message: 'Invalid credentials' } } },
      };
      vi.mocked(apiClient.post).mockRejectedValue(axiosError);

      const store = useAuthStore();
      await expect(store.login('bad@example.com', 'wrong')).rejects.toEqual(axiosError);

      expect(store.token).toBeNull();
      expect(store.user).toBeNull();
      expect(store.error).toBe('Invalid credentials');
      expect(store.loading).toBe(false);
    });

    it('sets generic error on network failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network Error'));

      const store = useAuthStore();
      await expect(store.login('test@example.com', 'pass')).rejects.toThrow('Network Error');

      expect(store.error).toBe('Network error. Please try again.');
    });

    it('sets loading to true during login', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(apiClient.post).mockReturnValue(pendingPromise as never);

      const store = useAuthStore();
      const loginPromise = store.login('test@example.com', 'pass');

      expect(store.loading).toBe(true);

      resolvePromise!({ data: { token: 'tok', user: { _id: '1', name: 'T', email: 'e', role: 'worker' } } });
      await loginPromise;

      expect(store.loading).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears token, user, and localStorage', async () => {
      localStorage.setItem('token', 'existing-token');
      localStorage.setItem('user', JSON.stringify({ _id: '1', name: 'U', email: 'u@e.com', role: 'worker' }));

      const store = useAuthStore();
      expect(store.isAuthenticated).toBe(true);

      store.logout();

      expect(store.token).toBeNull();
      expect(store.user).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('computed properties', () => {
    it('isAdmin returns true for admin role', () => {
      localStorage.setItem('token', 'tok');
      localStorage.setItem('user', JSON.stringify({ _id: '1', name: 'A', email: 'a@e.com', role: 'admin' }));

      const store = useAuthStore();
      expect(store.isAdmin).toBe(true);
    });

    it('isAdmin returns false for worker role', () => {
      localStorage.setItem('token', 'tok');
      localStorage.setItem('user', JSON.stringify({ _id: '1', name: 'W', email: 'w@e.com', role: 'worker' }));

      const store = useAuthStore();
      expect(store.isAdmin).toBe(false);
    });
  });
});
