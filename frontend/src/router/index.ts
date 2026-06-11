import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false, layout: 'none' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/pages/RegisterPage.vue'),
    meta: { requiresAuth: false, layout: 'none' },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/pages/DashboardPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/guides',
    name: 'guides',
    component: () => import('@/pages/GuidesListPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/guides/new',
    name: 'guide-create',
    component: () => import('@/pages/GuideEditPage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/guides/:id',
    name: 'guide-detail',
    component: () => import('@/pages/GuideDetailPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/guides/:id/edit',
    name: 'guide-edit',
    component: () => import('@/pages/GuideEditPage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/guides/:id/steps/:stepId',
    name: 'step-follow',
    component: () => import('@/pages/StepFollowPage.vue'),
    meta: { requiresAuth: true },
  },
  // New routes
  {
    path: '/users',
    name: 'user-management',
    component: () => import('@/pages/UserManagementPage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: () => import('@/pages/AnalyticsPage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/pages/SettingsPage.vue'),
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

export default router;
