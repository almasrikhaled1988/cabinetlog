<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api/client';

const router = useRouter();
const authStore = useAuthStore();

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

const nameError = ref('');
const emailError = ref('');
const passwordError = ref('');
const confirmError = ref('');

function validate(): boolean {
  let valid = true;
  nameError.value = '';
  emailError.value = '';
  passwordError.value = '';
  confirmError.value = '';

  if (!name.value.trim()) {
    nameError.value = 'Name is required';
    valid = false;
  } else if (name.value.trim().length < 2) {
    nameError.value = 'Name must be at least 2 characters';
    valid = false;
  }

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

  if (password.value !== confirmPassword.value) {
    confirmError.value = 'Passwords do not match';
    valid = false;
  }

  return valid;
}

async function handleSubmit() {
  if (!validate()) return;

  loading.value = true;
  error.value = null;

  try {
    const response = await apiClient.post('/auth/register', {
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
    });

    const { token, refreshToken, user } = response.data;
    authStore.token = token;
    authStore.refreshToken = refreshToken;
    authStore.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    router.push('/dashboard');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      error.value = axiosErr.response?.data?.error?.message || 'Registration failed';
    } else {
      error.value = 'Network error. Please try again.';
    }
  } finally {
    loading.value = false;
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
          <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">Create your account</p>
        </div>

        <!-- Server error display -->
        <div
          v-if="error"
          class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
        >
          <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
        </div>

        <form @submit.prevent="handleSubmit" novalidate>
          <!-- Name field -->
          <div class="mb-4">
            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
            <input
              id="name"
              v-model="name"
              type="text"
              autocomplete="name"
              class="w-full px-4 py-2.5 border rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              :class="nameError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
              placeholder="Your full name"
            />
            <p v-if="nameError" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ nameError }}</p>
          </div>

          <!-- Email field -->
          <div class="mb-4">
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
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
          <div class="mb-4">
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              class="w-full px-4 py-2.5 border rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              :class="passwordError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
              placeholder="At least 8 characters"
            />
            <p v-if="passwordError" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ passwordError }}</p>
          </div>

          <!-- Confirm Password field -->
          <div class="mb-6">
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm Password</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              class="w-full px-4 py-2.5 border rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              :class="confirmError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
              placeholder="Repeat your password"
            />
            <p v-if="confirmError" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ confirmError }}</p>
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 px-4 bg-se-green text-white font-medium rounded-lg hover:bg-se-green-dark focus:outline-none focus:ring-2 focus:ring-se-green focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <span v-if="loading">Creating account...</span>
            <span v-else>Create Account</span>
          </button>
        </form>

        <!-- Link to login -->
        <p class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?
          <router-link to="/login" class="text-se-green hover:text-se-green-dark font-medium">
            Sign in
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
