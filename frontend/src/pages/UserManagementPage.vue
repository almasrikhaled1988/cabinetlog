<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '@/api/client';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'worker';
  active: boolean;
  created_at: string;
}

const users = ref<User[]>([]);
const loading = ref(true);
const search = ref('');
const showCreateModal = ref(false);
const showResetModal = ref(false);
const selectedUser = ref<User | null>(null);
const saving = ref(false);
const error = ref('');

const newUser = ref({ name: '', email: '', password: '', role: 'worker' as 'admin' | 'worker' });
const newPassword = ref('');

async function fetchUsers() {
  loading.value = true;
  try {
    const params: Record<string, string> = {};
    if (search.value) params.search = search.value;
    const res = await apiClient.get('/users', { params });
    users.value = res.data.data;
  } catch {
    error.value = 'Failed to load users';
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  saving.value = true;
  error.value = '';
  try {
    await apiClient.post('/users', newUser.value);
    showCreateModal.value = false;
    newUser.value = { name: '', email: '', password: '', role: 'worker' };
    await fetchUsers();
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to create user';
  } finally {
    saving.value = false;
  }
}

async function toggleActive(user: User) {
  try {
    await apiClient.put(`/users/${user._id}`, { active: !user.active });
    await fetchUsers();
  } catch {
    error.value = 'Failed to update user';
  }
}

async function changeRole(user: User, role: 'admin' | 'worker') {
  try {
    await apiClient.put(`/users/${user._id}`, { role });
    await fetchUsers();
  } catch {
    error.value = 'Failed to update role';
  }
}

async function resetPassword() {
  if (!selectedUser.value) return;
  saving.value = true;
  error.value = '';
  try {
    await apiClient.post(`/users/${selectedUser.value._id}/reset-password`, {
      password: newPassword.value,
    });
    showResetModal.value = false;
    newPassword.value = '';
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Failed to reset password';
  } finally {
    saving.value = false;
  }
}

function openResetModal(user: User) {
  selectedUser.value = user;
  newPassword.value = '';
  showResetModal.value = true;
}

onMounted(fetchUsers);
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
      <button @click="showCreateModal = true" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        New User
      </button>
    </div>

    <!-- Search -->
    <div class="mb-4">
      <input
        v-model="search"
        @input="fetchUsers"
        type="text"
        placeholder="Search users..."
        class="w-full max-w-sm px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green"
      />
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
      {{ error }}
    </div>

    <!-- Users table -->
    <div class="card dark:card-dark overflow-hidden">
      <div v-if="loading" class="p-8 text-center">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-se-green mx-auto"></div>
      </div>
      <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="u in users" :key="u._id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <td class="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{{ u.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ u.email }}</td>
            <td class="px-4 py-3">
              <select
                :value="u.role"
                @change="changeRole(u, ($event.target as HTMLSelectElement).value as 'admin' | 'worker')"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green"
              >
                <option value="admin">Admin</option>
                <option value="worker">Worker</option>
              </select>
            </td>
            <td class="px-4 py-3">
              <span
                :class="u.active !== false
                  ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-500/30'
                  : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-500/30'"
                class="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
              >
                {{ u.active !== false ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right space-x-2">
              <button
                @click="toggleActive(u)"
                class="text-xs text-gray-500 dark:text-gray-400 hover:text-se-green transition-colors"
              >
                {{ u.active !== false ? 'Deactivate' : 'Activate' }}
              </button>
              <button
                @click="openResetModal(u)"
                class="text-xs text-se-green hover:text-se-green-dark transition-colors"
              >
                Reset PW
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create User Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700 shadow-xl">
        <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create New User</h2>
        <form @submit.prevent="createUser" class="space-y-3">
          <input v-model="newUser.name" placeholder="Name" required class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green" />
          <input v-model="newUser.email" type="email" placeholder="Email" required class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green" />
          <input v-model="newUser.password" type="password" placeholder="Password (min 8 chars)" required minlength="8" class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green" />
          <select v-model="newUser.role" class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green">
            <option value="worker">Worker</option>
            <option value="admin">Admin</option>
          </select>
          <div class="flex gap-2 pt-2">
            <button type="submit" :disabled="saving" class="flex-1 btn-primary justify-center disabled:opacity-50">
              {{ saving ? 'Creating...' : 'Create' }}
            </button>
            <button type="button" @click="showCreateModal = false" class="flex-1 btn-secondary dark:btn-secondary-dark justify-center">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reset Password Modal -->
    <div v-if="showResetModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700 shadow-xl">
        <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Reset Password for {{ selectedUser?.name }}</h2>
        <form @submit.prevent="resetPassword" class="space-y-3">
          <input v-model="newPassword" type="password" placeholder="New password (min 8 chars)" required minlength="8" class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green" />
          <div class="flex gap-2 pt-2">
            <button type="submit" :disabled="saving" class="flex-1 btn-primary justify-center disabled:opacity-50">
              {{ saving ? 'Resetting...' : 'Reset' }}
            </button>
            <button type="button" @click="showResetModal = false" class="flex-1 btn-secondary dark:btn-secondary-dark justify-center">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
