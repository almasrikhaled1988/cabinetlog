<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDarkModeStore } from '@/stores/darkMode';

const router = useRouter();
const darkModeStore = useDarkModeStore();
const mobileMenuOpen = ref(false);

const user = computed(() => {
  const userJson = localStorage.getItem('user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
});

const isAdmin = computed(() => user.value?.role === 'admin');

const userInitials = computed(() => {
  if (!user.value?.name) return '??';
  const parts = user.value.name.split(' ');
  return parts.map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
});

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  router.push({ name: 'login' });
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value;
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
    <!-- Navigation Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <router-link to="/dashboard" class="flex items-center gap-3 shrink-0">
            <div class="w-10 h-10 bg-se-green rounded-lg flex items-center justify-center shadow-sm">
              <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <span class="text-lg font-bold text-gray-900 dark:text-white">WerkFlow</span>
              <span class="text-[10px] text-gray-400 block -mt-1">by Schneider Electric</span>
            </div>
          </router-link>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-1">
            <router-link
              to="/dashboard"
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700 transition-colors"
              active-class="!text-se-green !bg-se-green-50 dark:!bg-se-green/10"
            >
              Dashboard
            </router-link>
            <router-link
              to="/guides"
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700 transition-colors"
              active-class="!text-se-green !bg-se-green-50 dark:!bg-se-green/10"
            >
              Guides
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/analytics"
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700 transition-colors"
              active-class="!text-se-green !bg-se-green-50 dark:!bg-se-green/10"
            >
              Analytics
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/users"
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700 transition-colors"
              active-class="!text-se-green !bg-se-green-50 dark:!bg-se-green/10"
            >
              Users
            </router-link>
          </nav>

          <!-- Right side -->
          <div class="hidden md:flex items-center gap-3">
            <router-link
              v-if="isAdmin"
              to="/guides/new"
              class="btn-primary"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              New Guide
            </router-link>

            <!-- Dark mode toggle -->
            <button
              @click="darkModeStore.toggle()"
              class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :aria-label="darkModeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              <svg v-if="darkModeStore.isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>

            <router-link
              to="/settings"
              class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Settings"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </router-link>

            <!-- User pill -->
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 bg-se-green-50 dark:bg-se-green/20 rounded-full flex items-center justify-center">
                <span class="text-sm font-semibold text-se-green">{{ userInitials }}</span>
              </div>
              <div class="text-sm">
                <span class="font-medium text-gray-700 dark:text-gray-300">{{ user?.name }}</span>
                <span
                  v-if="isAdmin"
                  class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-se-green-50 text-se-green dark:bg-se-green/20"
                >
                  Admin
                </span>
              </div>
            </div>

            <button
              @click="logout"
              class="px-3 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>

          <!-- Mobile Menu Button -->
          <button
            @click="toggleMobileMenu"
            class="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Toggle navigation menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                v-if="!mobileMenuOpen"
                stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
              <path
                v-else
                stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <div v-if="mobileMenuOpen" class="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div class="px-4 py-3 space-y-1">
          <router-link to="/dashboard" class="block px-3 py-2.5 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700" active-class="!text-se-green !bg-se-green-50" @click="mobileMenuOpen = false">Dashboard</router-link>
          <router-link to="/guides" class="block px-3 py-2.5 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700" active-class="!text-se-green !bg-se-green-50" @click="mobileMenuOpen = false">Guides</router-link>
          <router-link v-if="isAdmin" to="/analytics" class="block px-3 py-2.5 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700" active-class="!text-se-green !bg-se-green-50" @click="mobileMenuOpen = false">Analytics</router-link>
          <router-link v-if="isAdmin" to="/users" class="block px-3 py-2.5 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700" active-class="!text-se-green !bg-se-green-50" @click="mobileMenuOpen = false">Users</router-link>
          <router-link to="/settings" class="block px-3 py-2.5 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:text-se-green hover:bg-se-green-50 dark:hover:bg-gray-700" active-class="!text-se-green !bg-se-green-50" @click="mobileMenuOpen = false">Settings</router-link>
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 bg-se-green-50 rounded-full flex items-center justify-center">
              <span class="text-sm font-semibold text-se-green">{{ userInitials }}</span>
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-300">
              <span class="font-medium">{{ user?.name }}</span>
              <span v-if="isAdmin" class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-se-green-50 text-se-green">Admin</span>
            </div>
          </div>
          <button @click="logout" class="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">Logout</button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <slot />
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 bg-se-green rounded flex items-center justify-center">
              <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <span class="text-xs text-gray-500">WerkFlow v2.1.0</span>
          </div>
          <p class="text-xs text-gray-400">Schneider Electric • Internal Use</p>
        </div>
      </div>
    </footer>
  </div>
</template>
