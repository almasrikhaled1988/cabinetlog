<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api/client';
import StepCard from '@/components/StepCard.vue';

interface Guide {
  _id: string;
  title: string;
  slug: string;
  cabinet_type: string;
  drive_model?: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  tags: Array<{ _id: string; name: string }>;
  created_by?: { _id: string; name: string };
  created_at: string;
  updated_at: string;
}

interface BuildStep {
  _id: string;
  cabinet_guide_id: string;
  title: string;
  description: string;
  step_order: number;
  estimated_time?: number;
  warning_notes?: string;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const guide = ref<Guide | null>(null);
const steps = ref<BuildStep[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const statusLoading = ref(false);
const deleteLoading = ref(false);
const showDeleteConfirm = ref(false);

const guideId = computed(() => route.params.id as string);
const isAdmin = computed(() => authStore.isAdmin);

const statusBadgeClass = computed(() => {
  if (!guide.value) return '';
  switch (guide.value.status) {
    case 'published':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'draft':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'archived':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
});

const canPublish = computed(() => {
  return guide.value?.status === 'draft' && steps.value.length > 0;
});

const canArchive = computed(() => {
  return guide.value?.status === 'draft' || guide.value?.status === 'published';
});

const canReopen = computed(() => {
  return guide.value?.status === 'archived';
});

async function fetchGuide() {
  try {
    const response = await apiClient.get<Guide>(`/guides/${guideId.value}`);
    guide.value = response.data;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        error.value = 'Guide not found.';
      } else {
        error.value = 'Failed to load guide.';
      }
    } else {
      error.value = 'Network error. Please try again.';
    }
  }
}

async function fetchSteps() {
  try {
    const response = await apiClient.get<BuildStep[]>(`/guides/${guideId.value}/steps`);
    steps.value = response.data;
  } catch {
    // Steps may fail independently; don't block the page
    steps.value = [];
  }
}

async function loadData() {
  loading.value = true;
  error.value = null;
  await Promise.all([fetchGuide(), fetchSteps()]);
  loading.value = false;
}

async function transitionStatus(targetStatus: string) {
  if (!guide.value) return;
  statusLoading.value = true;
  try {
    const response = await apiClient.put<Guide>(
      `/guides/${guideId.value}/status`,
      { status: targetStatus }
    );
    guide.value = response.data;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosErr.response?.data?.error?.message || 'Status transition failed.');
    }
  } finally {
    statusLoading.value = false;
  }
}

async function deleteGuide() {
  deleteLoading.value = true;
  try {
    await apiClient.delete(`/guides/${guideId.value}`);
    router.push({ name: 'guides' });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosErr.response?.data?.error?.message || 'Failed to delete guide.');
    }
  } finally {
    deleteLoading.value = false;
    showDeleteConfirm.value = false;
  }
}

function navigateToEdit() {
  router.push({ name: 'guide-edit', params: { id: guideId.value } });
}

function startFollowing() {
  if (steps.value.length > 0) {
    router.push({
      name: 'step-follow',
      params: { id: guideId.value, stepId: steps.value[0]._id },
    });
  }
}

onMounted(loadData);
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <div
          class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"
        ></div>
        <p class="mt-3 text-sm text-gray-500">Loading guide...</p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="py-16 text-center">
      <div class="inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
        <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p class="text-gray-700 dark:text-gray-300 font-medium">{{ error }}</p>
      <button
        @click="router.push({ name: 'guides' })"
        class="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
      >
        ← Back to Guides
      </button>
    </div>

    <!-- Guide content -->
    <div v-else-if="guide">
      <!-- Back link -->
      <button
        @click="router.push({ name: 'guides' })"
        class="mb-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Guides
      </button>

      <!-- Guide Header -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-2">
              <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {{ guide.title }}
              </h1>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
                :class="statusBadgeClass"
              >
                {{ guide.status }}
              </span>
            </div>

            <!-- Meta info -->
            <div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
              <span class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {{ guide.cabinet_type }}
              </span>
              <span v-if="guide.drive_model" class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {{ guide.drive_model }}
              </span>
              <span class="flex items-center gap-1">
                v{{ guide.version }}
              </span>
            </div>

            <!-- Tags -->
            <div v-if="guide.tags && guide.tags.length > 0" class="mt-3 flex flex-wrap gap-1.5">
              <span
                v-for="tag in guide.tags"
                :key="tag._id"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              >
                {{ tag.name }}
              </span>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Admin actions -->
            <template v-if="isAdmin">
              <button
                @click="navigateToEdit"
                class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Edit
              </button>
              <button
                v-if="canPublish"
                @click="transitionStatus('published')"
                :disabled="statusLoading"
                class="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Publish
              </button>
              <button
                v-if="canArchive"
                @click="transitionStatus('archived')"
                :disabled="statusLoading"
                class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                Archive
              </button>
              <button
                v-if="canReopen"
                @click="transitionStatus('draft')"
                :disabled="statusLoading"
                class="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                Reopen
              </button>
              <button
                @click="showDeleteConfirm = true"
                class="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </template>

            <!-- Worker action -->
            <template v-else>
              <button
                v-if="steps.length > 0"
                @click="startFollowing"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Start Following
              </button>
            </template>
          </div>
        </div>

        <!-- Description -->
        <div v-if="guide.description" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{{ guide.description }}</p>
        </div>
      </div>

      <!-- Build Steps Section -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            Build Steps
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400">({{ steps.length }})</span>
          </h2>
        </div>

        <!-- Empty state -->
        <div
          v-if="steps.length === 0"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-dashed rounded-lg p-8 text-center"
        >
          <svg class="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p class="text-sm text-gray-500 dark:text-gray-400">No build steps yet.</p>
          <p v-if="isAdmin" class="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Go to the edit page to add steps.
          </p>
        </div>

        <!-- Step list -->
        <div v-else class="space-y-3">
          <StepCard
            v-for="step in steps"
            :key="step._id"
            :step-id="step._id"
            :step-order="step.step_order"
            :title="step.title"
            :description="step.description"
            :estimated-time="step.estimated_time"
            :warning-notes="step.warning_notes"
          />
        </div>
      </div>

      <!-- Delete confirmation modal -->
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showDeleteConfirm = false"
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4 w-full">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Guide</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Are you sure you want to delete "{{ guide.title }}"? This will permanently remove the guide, all its build steps, and associated media files. This action cannot be undone.
          </p>
          <div class="flex justify-end gap-2">
            <button
              @click="showDeleteConfirm = false"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              @click="deleteGuide"
              :disabled="deleteLoading"
              class="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {{ deleteLoading ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
