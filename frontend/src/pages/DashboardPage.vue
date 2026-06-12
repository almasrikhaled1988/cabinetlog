<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api/client';

interface Guide {
  _id: string;
  title: string;
  cabinet_type: string;
  drive_model: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  updated_at: string;
}

interface PaginatedResponse {
  data: Guide[];
  total: number;
  page: number;
  totalPages: number;
}

const router = useRouter();
const authStore = useAuthStore();

const recentGuides = ref<Guide[]>([]);
const stats = ref({ total: 0, published: 0, draft: 0 });
const loading = ref(true);

const isAdmin = computed(() => authStore.isAdmin);
const userName = computed(() => authStore.user?.name || 'User');

async function fetchDashboardData() {
  loading.value = true;
  try {
    const response = await apiClient.get<PaginatedResponse>('/guides', {
      params: { limit: 6 },
    });
    recentGuides.value = response.data.data;
    stats.value.total = response.data.total;

    if (isAdmin.value) {
      const publishedRes = await apiClient.get<PaginatedResponse>('/guides', {
        params: { status: 'published', limit: 1 },
      });
      const draftRes = await apiClient.get<PaginatedResponse>('/guides', {
        params: { status: 'draft', limit: 1 },
      });
      stats.value.published = publishedRes.data.total;
      stats.value.draft = draftRes.data.total;
    } else {
      stats.value.published = response.data.total;
    }
  } catch {
    // Silently handle
  } finally {
    loading.value = false;
  }
}

function goToGuide(guide: Guide) {
  router.push({ name: 'guide-detail', params: { id: guide._id } });
}

function goToGuides() {
  router.push({ name: 'guides' });
}

function createNewGuide() {
  router.push({ name: 'guide-create' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const statusColors: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

onMounted(fetchDashboardData);
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <!-- Welcome Header -->
    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
        Welcome back, {{ userName }}
      </h1>
      <p class="mt-1 text-gray-500 dark:text-gray-400">
        {{ isAdmin ? 'Manage your assembly guides and track production knowledge.' : 'Find and follow assembly guides for your production tasks.' }}
      </p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      <div class="stat-card dark:stat-card-dark">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 bg-se-green-50 dark:bg-se-green/10 rounded-xl flex items-center justify-center">
            <svg class="w-5 h-5 text-se-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Total Guides</p>
          </div>
        </div>
      </div>

      <div class="stat-card dark:stat-card-dark">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
            <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.published }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Published</p>
          </div>
        </div>
      </div>

      <div v-if="isAdmin" class="stat-card dark:stat-card-dark">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.draft }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Drafts</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="flex flex-wrap gap-3 mb-8">
      <button
        v-if="isAdmin"
        @click="createNewGuide"
        class="btn-primary"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create New Guide
      </button>
      <router-link
        v-if="isAdmin"
        to="/guides/import"
        class="btn-secondary dark:btn-secondary-dark"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import .md
      </router-link>
      <button
        @click="goToGuides"
        class="btn-secondary dark:btn-secondary-dark"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        Browse All Guides
      </button>
    </div>

    <!-- Recent Guides -->
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Guides</h2>
        <button
          @click="goToGuides"
          class="text-sm text-se-green hover:text-se-green-dark font-medium transition-colors"
        >
          View all →
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-se-green"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="recentGuides.length === 0" class="card dark:card-dark border-dashed p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p class="text-gray-500 dark:text-gray-400 text-sm">No guides yet.</p>
        <button
          v-if="isAdmin"
          @click="createNewGuide"
          class="mt-3 text-sm text-se-green hover:text-se-green-dark font-medium"
        >
          Create your first guide →
        </button>
      </div>

      <!-- Guide grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="guide in recentGuides"
          :key="guide._id"
          @click="goToGuide(guide)"
          class="card dark:card-dark p-4 hover:shadow-md dark:hover:border-se-green/30 transition-all duration-200 cursor-pointer"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{{ guide.title }}</h3>
            <span
              :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', statusColors[guide.status]]"
            >
              {{ guide.status }}
            </span>
          </div>
          <div class="space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <p><span class="font-medium text-gray-700 dark:text-gray-300">Type:</span> {{ guide.cabinet_type }}</p>
            <p v-if="guide.drive_model"><span class="font-medium text-gray-700 dark:text-gray-300">Drive:</span> {{ guide.drive_model }}</p>
            <p class="mt-2 text-gray-400 dark:text-gray-500">Updated {{ formatDate(guide.updated_at) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
