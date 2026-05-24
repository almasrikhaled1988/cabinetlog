import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to test the interceptor logic, so we'll test the module behavior
describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('creates an axios instance with /api baseURL', async () => {
    const { default: apiClient } = await import('./client');
    expect(apiClient.defaults.baseURL).toBe('/api');
  });

  it('attaches Authorization header when token exists in localStorage', async () => {
    localStorage.setItem('token', 'test-jwt-token');

    // Re-import to get fresh module
    vi.resetModules();
    const { default: apiClient } = await import('./client');

    // Create a mock adapter to intercept the request
    const mockAdapter = vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} });
    apiClient.defaults.adapter = mockAdapter;

    await apiClient.get('/test');

    expect(mockAdapter).toHaveBeenCalled();
    const requestConfig = mockAdapter.mock.calls[0][0];
    expect(requestConfig.headers.Authorization).toBe('Bearer test-jwt-token');
  });

  it('does not attach Authorization header when no token in localStorage', async () => {
    vi.resetModules();
    const { default: apiClient } = await import('./client');

    const mockAdapter = vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} });
    apiClient.defaults.adapter = mockAdapter;

    await apiClient.get('/test');

    const requestConfig = mockAdapter.mock.calls[0][0];
    expect(requestConfig.headers.Authorization).toBeUndefined();
  });

  it('clears localStorage on 401 response', async () => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', '{"_id":"1"}');

    vi.resetModules();

    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { pathname: '/dashboard', href: '' },
      writable: true,
    });

    const { default: apiClient } = await import('./client');

    const mockAdapter = vi.fn().mockRejectedValue({
      response: { status: 401, data: { error: { message: 'Unauthorized' } } },
    });
    apiClient.defaults.adapter = mockAdapter;

    await expect(apiClient.get('/protected')).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();

    // Restore
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });
});
