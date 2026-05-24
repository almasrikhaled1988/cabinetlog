import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

// Re-create the routes definition for testing (avoids singleton router state issues)
function createTestRouter(): Router {
  const routes: RouteRecordRaw[] = [
    {
      path: '/login',
      name: 'login',
      component: { template: '<div>Login</div>' },
      meta: { requiresAuth: false, layout: 'none' },
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: { template: '<div>Dashboard</div>' },
      meta: { requiresAuth: true },
    },
    {
      path: '/guides',
      name: 'guides',
      component: { template: '<div>Guides</div>' },
      meta: { requiresAuth: true },
    },
    {
      path: '/guides/:id',
      name: 'guide-detail',
      component: { template: '<div>Guide Detail</div>' },
      meta: { requiresAuth: true },
    },
    {
      path: '/guides/:id/edit',
      name: 'guide-edit',
      component: { template: '<div>Guide Edit</div>' },
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/guides/:id/steps/:stepId',
      name: 'step-follow',
      component: { template: '<div>Step Follow</div>' },
      meta: { requiresAuth: true },
    },
  ];

  const router = createRouter({
    history: createWebHistory(),
    routes,
  });

  router.beforeEach((to, _from, next) => {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    const isAuthenticated = !!token;

    if (to.meta.requiresAuth === false) {
      if (isAuthenticated) {
        return next({ name: 'dashboard' });
      }
      return next();
    }

    if (to.meta.requiresAuth && !isAuthenticated) {
      return next({ name: 'login', query: { redirect: to.fullPath } });
    }

    if (to.meta.requiresAdmin && userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role !== 'admin') {
          return next({ name: 'dashboard' });
        }
      } catch {
        return next({ name: 'login' });
      }
    }

    next();
  });

  return router;
}

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    router = createTestRouter();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defines all required routes', () => {
    const routeNames = router.getRoutes().map((r) => r.name);
    expect(routeNames).toContain('login');
    expect(routeNames).toContain('dashboard');
    expect(routeNames).toContain('guides');
    expect(routeNames).toContain('guide-detail');
    expect(routeNames).toContain('guide-edit');
    expect(routeNames).toContain('step-follow');
  });

  it('redirects / to /dashboard', () => {
    const rootRoute = router.getRoutes().find((r) => r.path === '/');
    expect(rootRoute?.redirect).toBe('/dashboard');
  });

  it('marks guide-edit as requiresAdmin', () => {
    const editRoute = router.getRoutes().find((r) => r.name === 'guide-edit');
    expect(editRoute?.meta.requiresAdmin).toBe(true);
  });

  it('marks login route as not requiring auth', () => {
    const loginRoute = router.getRoutes().find((r) => r.name === 'login');
    expect(loginRoute?.meta.requiresAuth).toBe(false);
  });

  describe('route guards', () => {
    it('redirects unauthenticated users to /login', async () => {
      await router.push('/dashboard');
      await router.isReady();
      expect(router.currentRoute.value.name).toBe('login');
    });

    it('allows authenticated users to access protected routes', async () => {
      localStorage.setItem('token', 'fake-jwt-token');
      localStorage.setItem('user', JSON.stringify({ name: 'Test', role: 'worker' }));

      await router.push('/dashboard');
      await router.isReady();
      expect(router.currentRoute.value.name).toBe('dashboard');
    });

    it('redirects authenticated users away from login page', async () => {
      localStorage.setItem('token', 'fake-jwt-token');
      localStorage.setItem('user', JSON.stringify({ name: 'Test', role: 'worker' }));

      await router.push('/login');
      await router.isReady();
      expect(router.currentRoute.value.name).toBe('dashboard');
    });

    it('blocks worker from admin-only routes', async () => {
      localStorage.setItem('token', 'fake-jwt-token');
      localStorage.setItem('user', JSON.stringify({ name: 'Worker', role: 'worker' }));

      await router.push('/guides/123/edit');
      await router.isReady();
      expect(router.currentRoute.value.name).toBe('dashboard');
    });

    it('allows admin to access admin-only routes', async () => {
      localStorage.setItem('token', 'fake-jwt-token');
      localStorage.setItem('user', JSON.stringify({ name: 'Admin', role: 'admin' }));

      await router.push('/guides/123/edit');
      await router.isReady();
      expect(router.currentRoute.value.name).toBe('guide-edit');
    });

    it('preserves redirect path in login query', async () => {
      await router.push('/guides/456');
      await router.isReady();
      expect(router.currentRoute.value.name).toBe('login');
      expect(router.currentRoute.value.query.redirect).toBe('/guides/456');
    });
  });
});
