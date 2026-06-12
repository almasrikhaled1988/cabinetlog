<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import GuideCard from '@/components/GuideCard.vue';
import SearchBar from '@/components/SearchBar.vue';
import type { Guide } from '@/components/GuideCard.vue';

const router = useRouter();
const authStore = useAuthStore();

// State
const guides = ref<Guide[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Pagination
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);
const itemsPerPage = ref(20);
const itemsPerPageOptions = [10, 20, 50];

// Filters
const searchQuery = ref('');
const cabinetTypeFilter = ref('');
const statusFilter = ref('');

const cabinetTypeOptions = ['VSD', 'MCC', 'Control Panel', 'Custom'];
const statusOptions = ['draft', 'published', 'archived'];

const isAdmin = computed(() => authStore.isAdmin);

// Fetch guides from API
async function fetchGuides() {
  loading.value = true;
  error.value = null;

  try {
    if (searchQuery.value.trim()) {
      const params: Record<string, string> = {
        q: searchQuery.value.trim(),
      };
      if (cabinetTypeFilter.value) {
        params.cabinetType = cabinetTypeFilter.value;
      }
      const response = await apiClient.get('/guides/search', { params });
      guides.value = response.data.data || [];
      totalCount.value = guides.value.length;
      totalPages.value = 1;
      currentPage.value = 1;
    } else {
      const params: Record<string, string | number> = {
        page: currentPage.value,
        limit: itemsPerPage.value,
      };
      if (cabinetTypeFilter.value) {
        params.cabinetType = cabinetTypeFilter.value;
      }
      if (statusFilter.value && isAdmin.value) {
        params.status = statusFilter.value;
      }
      const response = await apiClient.get('/guides', { params });
      guides.value = response.data.data || [];
      totalCount.value = response.data.total || 0;
      totalPages.value = response.data.totalPages || 1;
      currentPage.value = response.data.page || 1;
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      error.value = axiosErr.response?.data?.error?.message || 'Failed to load guides';
    } else {
      error.value = 'Network error. Please try again.';
    }
  } finally {
    loading.value = false;
  }
}

function goToGuide(guide: Guide) {
  router.push({ name: 'guide-detail', params: { id: guide._id } });
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

function onItemsPerPageChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  itemsPerPage.value = Number(target.value);
  currentPage.value = 1;
}

function onSearch(query: string) {
  searchQuery.value = query;
  currentPage.value = 1;
}

function onCabinetTypeChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  cabinetTypeFilter.value = target.value;
  currentPage.value = 1;
}

function onStatusChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  statusFilter.value = target.value;
  currentPage.value = 1;
}

const paginationPages = computed(() => {
  const pages: (number | '...')[] = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }
  return pages;
});

watch([currentPage, itemsPerPage, cabinetTypeFilter, statusFilter], () => {
  fetchGuides();
});

watch(searchQuery, () => {
  fetchGuides();
});

onMounted(() => {
  fetchGuides();
});
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Assembly Guides</h1>
      <div v-if="isAdmin" class="flex items-center gap-2">
        <router-link
          :to="{ name: 'guide-import' }"
          class="btn-secondary dark:btn-secondary-dark"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Import .md
        </router-link>
        <router-link
          :to="{ name: 'guide-edit', params: { id: 'new' } }"
          class="btn-primary"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Guide
        </router-link>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <div class="flex-1">
        <SearchBar
          :model-value="searchQuery"
          placeholder="Search guides by title, drive model..."
          @search="onSearch"
        />
      </div>

      <div class="flex gap-3">
        <div>
          <label for="cabinet-type-filter" class="sr-only">Filter by cabinet type</label>
          <select
            id="cabinet-type-filter"
            :value="cabinetTypeFilter"
            class="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green"
            @change="onCabinetTypeChange"
          >
            <option value="">All Types</option>
            <option v-for="type in cabinetTypeOptions" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </div>

        <div v-if="isAdmin">
          <label for="status-filter" class="sr-only">Filter by status</label>
          <select
            id="status-filter"
            :value="statusFilter"
            class="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green"
            @change="onStatusChange"
          >
            <option value="">All Statuses</option>
            <option v-for="status in statusOptions" :key="status" :value="status">
              {{ status.charAt(0).toUpperCase() + status.slice(1) }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-se-green" role="status">
        <span class="sr-only">Loading...</span>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
      <p class="text-red-700 dark:text-red-400 text-sm">{{ error }}</p>
      <button
        class="mt-2 text-sm text-se-green underline hover:text-se-green-dark"
        @click="fetchGuides"
      >
        Try again
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="guides.length === 0" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No guides found</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ searchQuery ? 'Try adjusting your search or filters.' : 'No assembly guides available yet.' }}
      </p>
    </div>

    <!-- Guide Grid -->
    <div v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <GuideCard
          v-for="guide in guides"
          :key="guide._id"
          :guide="guide"
          @click="goToGuide"
        />
      </div>

      <!-- Pagination -->
      <div
        v-if="!searchQuery.trim() && totalPages > 1"
        class="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <label for="items-per-page">Show</label>
          <select
            id="items-per-page"
            :value="itemsPerPage"
            class="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-se-green"
            @change="onItemsPerPageChange"
          >
            <option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">
              {{ opt }}
            </option>
          </select>
          <span>per page</span>
          <span class="ml-2 text-gray-400">|</span>
          <span class="ml-2">{{ totalCount }} total</span>
        </div>

        <nav aria-label="Pagination" class="flex items-center gap-1">
          <button
            :disabled="currentPage <= 1"
            class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
            @click="goToPage(currentPage - 1)"
          >
            ←
          </button>

          <template v-for="(page, index) in paginationPages" :key="index">
            <span v-if="page === '...'" class="px-2 py-1 text-sm text-gray-400 dark:text-gray-500">...</span>
            <button
              v-else
              :class="[
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                page === currentPage
                  ? 'bg-se-green text-white border-se-green'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'
              ]"
              :aria-current="page === currentPage ? 'page' : undefined"
              :aria-label="`Page ${page}`"
              @click="goToPage(page as number)"
            >
              {{ page }}
            </button>
          </template>

          <button
            :disabled="currentPage >= totalPages"
            class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
            @click="goToPage(currentPage + 1)"
          >
            →
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>
