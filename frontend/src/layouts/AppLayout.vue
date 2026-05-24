<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
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

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push({ name: 'login' });
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value;
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- Navigation Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-14 sm:h-16">
          <!-- Logo -->
          <router-link to="/dashboard" class="flex items-center gap-2 shrink-0">
            <div
              class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"
            >
              <span class="text-white font-bold text-sm">CL</span>
            </div>
            <span class="text-lg font-semibold text-gray-900 hidden sm:inline"
              >CabinetLog</span
            >
          </router-link>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-1">
            <router-link
              to="/dashboard"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              active-class="text-blue-600 bg-blue-50"
            >
              Dashboard
            </router-link>
            <router-link
              to="/guides"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              active-class="text-blue-600 bg-blue-50"
            >
              Guides
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/guides/new"
              class="px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              + New Guide
            </router-link>
          </nav>

          <!-- User Menu (Desktop) -->
          <div class="hidden md:flex items-center gap-3">
            <div class="text-sm text-gray-600">
              <span class="font-medium">{{ user?.name }}</span>
              <span
                v-if="isAdmin"
                class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
              >
                Admin
              </span>
            </div>
            <button
              @click="logout"
              class="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>

          <!-- Mobile Menu Button -->
          <button
            @click="toggleMobileMenu"
            class="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Toggle navigation menu"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                v-if="!mobileMenuOpen"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden border-t border-gray-200 bg-white"
      >
        <div class="px-4 py-3 space-y-1">
          <router-link
            to="/dashboard"
            class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
            active-class="text-blue-600 bg-blue-50"
            @click="mobileMenuOpen = false"
          >
            Dashboard
          </router-link>
          <router-link
            to="/guides"
            class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
            active-class="text-blue-600 bg-blue-50"
            @click="mobileMenuOpen = false"
          >
            Guides
          </router-link>
        </div>
        <div class="border-t border-gray-200 px-4 py-3">
          <div class="text-sm text-gray-600 mb-2">
            <span class="font-medium">{{ user?.name }}</span>
            <span
              v-if="isAdmin"
              class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
            >
              Admin
            </span>
          </div>
          <button
            @click="logout"
            class="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
          >
            Logout
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <slot />
      </div>
    </main>
  </div>
</template>
