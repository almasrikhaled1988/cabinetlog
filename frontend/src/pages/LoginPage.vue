<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const emailError = ref('');
const passwordError = ref('');

function validateForm(): boolean {
  let valid = true;
  emailError.value = '';
  passwordError.value = '';

  if (!email.value.trim()) {
    emailError.value = 'Email is required';
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    emailError.value = 'Please enter a valid email address';
    valid = false;
  }

  if (!password.value) {
    passwordError.value = 'Password is required';
    valid = false;
  } else if (password.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters';
    valid = false;
  }

  return valid;
}

async function handleSubmit() {
  if (!validateForm()) return;

  try {
    await authStore.login(email.value.trim(), password.value);
    const redirect = (route.query.redirect as string) || '/dashboard';
    router.push(redirect);
  } catch {
    // Error is already set in the store
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-gray-900/50 p-8 border border-gray-100 dark:border-gray-700">
        <div class="text-center mb-8">
          <div class="w-14 h-14 bg-se-green rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">WerkFlow</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">Sign in to your account</p>
        </div>

        <!-- Server error display -->
        <div
          v-if="authStore.error"
          class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
        >
          <p class="text-sm text-red-700 dark:text-red-400">{{ authStore.error }}</p>
        </div>

        <form @submit.prevent="handleSubmit" novalidate>
          <!-- Email field -->
          <div class="mb-4">
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              class="w-full px-4 py-2.5 border rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              :class="emailError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
              placeholder="you@example.com"
            />
            <p v-if="emailError" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ emailError }}</p>
          </div>

          <!-- Password field -->
          <div class="mb-6">
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="w-full px-4 py-2.5 border rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              :class="passwordError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
              placeholder="Enter your password"
            />
            <p v-if="passwordError" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ passwordError }}</p>
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="authStore.loading"
            class="w-full py-2.5 px-4 bg-se-green text-white font-medium rounded-lg hover:bg-se-green-dark focus:outline-none focus:ring-2 focus:ring-se-green focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <span v-if="authStore.loading">Signing in...</span>
            <span v-else>Sign in</span>
          </button>
        </form>

        <!-- Link to register -->
        <p class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Don't have an account?
          <router-link to="/register" class="text-se-green hover:text-se-green-dark font-medium">
            Create one
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
