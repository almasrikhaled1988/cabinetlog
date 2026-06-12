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
    <section class="card dark:card-dark p-6 mb-6">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-5 uppercase tracking-wider">Appearance</h2>

      <div class="flex items-center justify-between mb-5">
        <span class="text-sm text-gray-700 dark:text-gray-300">Dark Mode</span>
        <button
          @click="darkModeStore.toggle()"
          :class="darkModeStore.isDark ? 'bg-se-green' : 'bg-gray-300'"
          class="relative w-11 h-6 rounded-full transition-colors"
          role="switch"
          :aria-checked="darkModeStore.isDark"
        >
          <span
            :class="darkModeStore.isDark ? 'translate-x-5' : 'translate-x-0.5'"
            class="inline-block w-5 h-5 bg-white rounded-full transform transition-transform mt-0.5 shadow-sm"
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
            :class="darkModeStore.fontSize === size
              ? 'bg-se-green-50 text-se-green border-se-green/30 dark:bg-se-green/10'
              : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'"
            class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
          >
            {{ size === 'normal' ? 'A' : size === 'large' ? 'A+' : 'A++' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Change Password -->
    <section class="card dark:card-dark p-6">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-5 uppercase tracking-wider">Change Password</h2>

      <div v-if="passwordError" class="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
        {{ passwordError }}
      </div>
      <div v-if="passwordSuccess" class="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-lg">
        {{ passwordSuccess }}
      </div>

      <form @submit.prevent="handleChangePassword" class="space-y-3">
        <input
          v-model="currentPassword"
          type="password"
          placeholder="Current password"
          required
          class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green"
        />
        <input
          v-model="newPassword"
          type="password"
          placeholder="New password (min 8 chars)"
          required
          minlength="8"
          class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green"
        />
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          required
          class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green"
        />
        <button
          type="submit"
          :disabled="saving"
          class="btn-primary disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Change Password' }}
        </button>
      </form>
    </section>
  </div>
</template>
