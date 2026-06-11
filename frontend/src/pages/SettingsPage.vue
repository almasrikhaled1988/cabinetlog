<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useDarkModeStore } from '@/stores/darkMode';

const authStore = useAuthStore();
const darkModeStore = useDarkModeStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const passwordSuccess = ref('');
const saving = ref(false);

async function handleChangePassword() {
  passwordError.value = '';
  passwordSuccess.value = '';

  if (newPassword.value.length < 8) {
    passwordError.value = 'New password must be at least 8 characters';
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match';
    return;
  }

  saving.value = true;
  try {
    await authStore.changePassword(currentPassword.value, newPassword.value);
    passwordSuccess.value = 'Password changed successfully';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (e: any) {
    passwordError.value = e.response?.data?.error?.message || 'Failed to change password';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

    <!-- Appearance -->
    <section class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 mb-6">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Appearance</h2>

      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-700 dark:text-gray-300">Dark Mode</span>
        <button
          @click="darkModeStore.toggle()"
          :class="darkModeStore.isDark ? 'bg-blue-600' : 'bg-gray-300'"
          class="relative w-11 h-6 rounded-full transition-colors"
          role="switch"
          :aria-checked="darkModeStore.isDark"
        >
          <span
            :class="darkModeStore.isDark ? 'translate-x-5' : 'translate-x-0.5'"
            class="inline-block w-5 h-5 bg-white rounded-full transform transition-transform mt-0.5"
          ></span>
        </button>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-700 dark:text-gray-300">Font Size</span>
        <div class="flex gap-1">
          <button
            v-for="size in (['normal', 'large', 'xlarge'] as const)"
            :key="size"
            @click="darkModeStore.setFontSize(size)"
            :class="darkModeStore.fontSize === size ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'"
            class="px-3 py-1 rounded text-xs font-medium"
          >
            {{ size === 'normal' ? 'A' : size === 'large' ? 'A+' : 'A++' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Change Password -->
    <section class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Change Password</h2>

      <div v-if="passwordError" class="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded">
        {{ passwordError }}
      </div>
      <div v-if="passwordSuccess" class="mb-3 p-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded">
        {{ passwordSuccess }}
      </div>

      <form @submit.prevent="handleChangePassword" class="space-y-3">
        <input
          v-model="currentPassword"
          type="password"
          placeholder="Current password"
          required
          class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
        />
        <input
          v-model="newPassword"
          type="password"
          placeholder="New password (min 8 chars)"
          required
          minlength="8"
          class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
        />
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          required
          class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
        />
        <button
          type="submit"
          :disabled="saving"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Change Password' }}
        </button>
      </form>
    </section>
  </div>
</template>
