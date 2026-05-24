<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api/client';
import StepEditor from '@/components/StepEditor.vue';
import FileUploader from '@/components/FileUploader.vue';

// Types
interface Tag {
  _id: string;
  name: string;
}

interface GuideForm {
  title: string;
  cabinet_type: string;
  drive_model: string;
  description: string;
  tags: string[];
}

interface GuideData extends GuideForm {
  _id: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  slug: string;
  created_at: string;
  updated_at: string;
}

interface ValidationErrors {
  title?: string;
  cabinet_type?: string;
  drive_model?: string;
  description?: string;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// State
const isNewGuide = computed(() => route.name === 'guide-create' || !route.params.id);
const guideId = computed(() => (isNewGuide.value ? null : route.params.id as string));
const loading = ref(false);
const saving = ref(false);
const saveError = ref<string | null>(null);
const lastSaved = ref<Date | null>(null);
const availableTags = ref<Tag[]>([]);
const guideStatus = ref<'draft' | 'published' | 'archived'>('draft');
const guideVersion = ref(1);
const statusTransitioning = ref(false);

const form = reactive<GuideForm>({
  title: '',
  cabinet_type: '',
  drive_model: '',
  description: '',
  tags: [],
});

const errors = reactive<ValidationErrors>({});
const touched = reactive<Record<string, boolean>>({});

// Validation rules matching backend (Requirements 3.5, 3.6, 3.7)
function validate(): boolean {
  let valid = true;
  errors.title = undefined;
  errors.cabinet_type = undefined;
  errors.drive_model = undefined;
  errors.description = undefined;

  // Title: 3-200 characters (Requirement 3.5)
  if (!form.title.trim()) {
    errors.title = 'Title is required';
    valid = false;
  } else if (form.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters';
    valid = false;
  } else if (form.title.trim().length > 200) {
    errors.title = 'Title must not exceed 200 characters';
    valid = false;
  }

  // Cabinet type: 1-100 characters (Requirement 3.7)
  if (!form.cabinet_type.trim()) {
    errors.cabinet_type = 'Cabinet type is required';
    valid = false;
  } else if (form.cabinet_type.trim().length > 100) {
    errors.cabinet_type = 'Cabinet type must not exceed 100 characters';
    valid = false;
  }

  // Description: max 5000 characters (Requirement 3.6)
  if (form.description.length > 5000) {
    errors.description = 'Description must not exceed 5000 characters';
    valid = false;
  }

  return valid;
}

// Validate a single field on blur
function validateField(field: keyof ValidationErrors) {
  touched[field] = true;

  switch (field) {
    case 'title':
      if (!form.title.trim()) {
        errors.title = 'Title is required';
      } else if (form.title.trim().length < 3) {
        errors.title = 'Title must be at least 3 characters';
      } else if (form.title.trim().length > 200) {
        errors.title = 'Title must not exceed 200 characters';
      } else {
        errors.title = undefined;
      }
      break;
    case 'cabinet_type':
      if (!form.cabinet_type.trim()) {
        errors.cabinet_type = 'Cabinet type is required';
      } else if (form.cabinet_type.trim().length > 100) {
        errors.cabinet_type = 'Cabinet type must not exceed 100 characters';
      } else {
        errors.cabinet_type = undefined;
      }
      break;
    case 'description':
      if (form.description.length > 5000) {
        errors.description = 'Description must not exceed 5000 characters';
      } else {
        errors.description = undefined;
      }
      break;
  }
}

// Auto-save with 2-second debounce
const debouncedSave = useDebounceFn(async () => {
  if (isNewGuide.value) return; // Don't auto-save new guides
  if (!validate()) return;

  await saveGuide();
}, 2000);

// Watch form changes for auto-save (only for existing guides)
watch(
  () => ({ ...form }),
  () => {
    if (!isNewGuide.value && !loading.value) {
      saving.value = true;
      saveError.value = null;
      debouncedSave();
    }
  },
  { deep: true }
);

// Save guide to backend
async function saveGuide() {
  saving.value = true;
  saveError.value = null;

  try {
    const payload = {
      title: form.title.trim(),
      cabinet_type: form.cabinet_type.trim(),
      drive_model: form.drive_model.trim(),
      description: form.description,
      tags: form.tags,
    };

    if (isNewGuide.value) {
      const response = await apiClient.post<GuideData>('/guides', payload);
      // Navigate to the edit page for the newly created guide
      router.replace({ name: 'guide-edit', params: { id: response.data._id } });
      guideStatus.value = response.data.status;
      guideVersion.value = response.data.version;
    } else {
      const response = await apiClient.put<GuideData>(`/guides/${guideId.value}`, payload);
      guideStatus.value = response.data.status;
      guideVersion.value = response.data.version;
    }

    lastSaved.value = new Date();
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
      saveError.value = axiosErr.response?.data?.error?.message
        || axiosErr.response?.data?.message
        || 'Failed to save guide';
    } else {
      saveError.value = 'Network error. Please try again.';
    }
  } finally {
    saving.value = false;
  }
}

// Handle form submission (for new guides or explicit save)
async function handleSubmit() {
  // Mark all fields as touched
  touched.title = true;
  touched.cabinet_type = true;
  touched.description = true;

  if (!validate()) return;
  await saveGuide();
}

// Status transitions (Requirement 4.1)
async function transitionStatus(targetStatus: 'published' | 'archived' | 'draft') {
  if (!guideId.value) return;

  statusTransitioning.value = true;
  saveError.value = null;

  try {
    const response = await apiClient.put<GuideData>(`/guides/${guideId.value}/status`, {
      status: targetStatus,
    });
    guideStatus.value = response.data.status;
    guideVersion.value = response.data.version;
    lastSaved.value = new Date();
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
      saveError.value = axiosErr.response?.data?.error?.message
        || axiosErr.response?.data?.message
        || 'Failed to update status';
    } else {
      saveError.value = 'Network error. Please try again.';
    }
  } finally {
    statusTransitioning.value = false;
  }
}

// Tag management
function toggleTag(tagId: string) {
  const index = form.tags.indexOf(tagId);
  if (index === -1) {
    form.tags.push(tagId);
  } else {
    form.tags.splice(index, 1);
  }
}

function isTagSelected(tagId: string): boolean {
  return form.tags.includes(tagId);
}

// Load existing guide data
async function loadGuide() {
  if (isNewGuide.value) return;

  loading.value = true;
  try {
    const response = await apiClient.get<GuideData>(`/guides/${guideId.value}`);
    const guide = response.data;

    form.title = guide.title;
    form.cabinet_type = guide.cabinet_type;
    form.drive_model = guide.drive_model || '';
    form.description = guide.description || '';
    form.tags = guide.tags || [];
    guideStatus.value = guide.status;
    guideVersion.value = guide.version;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        router.push({ name: 'guides' });
        return;
      }
    }
    saveError.value = 'Failed to load guide';
  } finally {
    loading.value = false;
  }
}

// Load available tags
async function loadTags() {
  try {
    const response = await apiClient.get<{ data: Tag[] }>('/tags');
    availableTags.value = response.data.data;
  } catch {
    // Tags are optional, don't block the form
    availableTags.value = [];
  }
}

// Status badge styling
const statusBadgeClass = computed(() => {
  switch (guideStatus.value) {
    case 'draft':
      return 'bg-yellow-100 text-yellow-800';
    case 'published':
      return 'bg-green-100 text-green-800';
    case 'archived':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
});

// Save status text
const saveStatusText = computed(() => {
  if (saving.value) return 'Saving...';
  if (lastSaved.value) {
    return `Last saved ${lastSaved.value.toLocaleTimeString()}`;
  }
  return '';
});

// Page title
const pageTitle = computed(() => (isNewGuide.value ? 'Create New Guide' : 'Edit Guide'));

onMounted(async () => {
  await Promise.all([loadGuide(), loadTags()]);
});
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <button
          @click="router.push({ name: 'guides' })"
          class="text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Back to guides"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-2xl font-bold text-gray-900">{{ pageTitle }}</h1>
      </div>

      <!-- Status badge and save status -->
      <div class="flex items-center gap-3">
        <span v-if="saveStatusText" class="text-sm text-gray-500">
          {{ saveStatusText }}
        </span>
        <span
          v-if="!isNewGuide"
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
          :class="statusBadgeClass"
        >
          {{ guideStatus }}
        </span>
        <span v-if="!isNewGuide" class="text-xs text-gray-400">
          v{{ guideVersion }}
        </span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="handleSubmit" novalidate>
      <!-- Error banner -->
      <div
        v-if="saveError"
        class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
        role="alert"
      >
        <p class="text-sm text-red-700">{{ saveError }}</p>
      </div>

      <div class="space-y-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <!-- Title -->
        <div>
          <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
            Title <span class="text-red-500">*</span>
          </label>
          <input
            id="title"
            v-model="form.title"
            type="text"
            @blur="validateField('title')"
            class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            :class="touched.title && errors.title ? 'border-red-300' : 'border-gray-300'"
            placeholder="e.g. ATV630 VSD Cabinet Assembly"
            maxlength="200"
          />
          <div class="flex justify-between mt-1">
            <p v-if="touched.title && errors.title" class="text-sm text-red-600">{{ errors.title }}</p>
            <span v-else></span>
            <span class="text-xs text-gray-400">{{ form.title.length }}/200</span>
          </div>
        </div>

        <!-- Cabinet Type -->
        <div>
          <label for="cabinet_type" class="block text-sm font-medium text-gray-700 mb-1">
            Cabinet Type <span class="text-red-500">*</span>
          </label>
          <input
            id="cabinet_type"
            v-model="form.cabinet_type"
            type="text"
            @blur="validateField('cabinet_type')"
            class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            :class="touched.cabinet_type && errors.cabinet_type ? 'border-red-300' : 'border-gray-300'"
            placeholder="e.g. VSD, MCC, Control Panel, Custom"
            maxlength="100"
          />
          <div class="flex justify-between mt-1">
            <p v-if="touched.cabinet_type && errors.cabinet_type" class="text-sm text-red-600">{{ errors.cabinet_type }}</p>
            <span v-else></span>
            <span class="text-xs text-gray-400">{{ form.cabinet_type.length }}/100</span>
          </div>
        </div>

        <!-- Drive Model -->
        <div>
          <label for="drive_model" class="block text-sm font-medium text-gray-700 mb-1">
            Drive Model
          </label>
          <input
            id="drive_model"
            v-model="form.drive_model"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. ATV630, ATV930, PowerFlex 525"
          />
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            v-model="form.description"
            rows="5"
            @blur="validateField('description')"
            class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            :class="touched.description && errors.description ? 'border-red-300' : 'border-gray-300'"
            placeholder="Describe the assembly procedure, tools needed, and any prerequisites..."
            maxlength="5000"
          ></textarea>
          <div class="flex justify-between mt-1">
            <p v-if="touched.description && errors.description" class="text-sm text-red-600">{{ errors.description }}</p>
            <span v-else></span>
            <span class="text-xs text-gray-400">{{ form.description.length }}/5000</span>
          </div>
        </div>

        <!-- Tags -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div v-if="availableTags.length > 0" class="flex flex-wrap gap-2">
            <button
              v-for="tag in availableTags"
              :key="tag._id"
              type="button"
              @click="toggleTag(tag._id)"
              class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors"
              :class="isTagSelected(tag._id)
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'"
            >
              {{ tag.name }}
              <svg
                v-if="isTagSelected(tag._id)"
                class="ml-1 w-3 h-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <p v-else class="text-sm text-gray-500">No tags available</p>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="mt-6 flex items-center justify-between">
        <!-- Left: Create/Save button for new guides -->
        <div>
          <button
            v-if="isNewGuide"
            type="submit"
            :disabled="saving"
            class="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="saving">Creating...</span>
            <span v-else>Create Guide</span>
          </button>
        </div>

        <!-- Right: Status action buttons for existing guides (admin only) -->
        <div v-if="!isNewGuide && authStore.isAdmin" class="flex items-center gap-3">
          <!-- Publish button (from draft) -->
          <button
            v-if="guideStatus === 'draft'"
            type="button"
            :disabled="statusTransitioning"
            @click="transitionStatus('published')"
            class="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="statusTransitioning">Publishing...</span>
            <span v-else>Publish</span>
          </button>

          <!-- Archive button (from draft or published) -->
          <button
            v-if="guideStatus === 'draft' || guideStatus === 'published'"
            type="button"
            :disabled="statusTransitioning"
            @click="transitionStatus('archived')"
            class="px-4 py-2 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="statusTransitioning">Archiving...</span>
            <span v-else>Archive</span>
          </button>

          <!-- Reopen button (from archived) -->
          <button
            v-if="guideStatus === 'archived'"
            type="button"
            :disabled="statusTransitioning"
            @click="transitionStatus('draft')"
            class="px-4 py-2 bg-yellow-600 text-white font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="statusTransitioning">Reopening...</span>
            <span v-else>Reopen as Draft</span>
          </button>
        </div>
      </div>
    </form>

    <!-- Build Steps Section (only for existing guides) -->
    <div v-if="!isNewGuide && !loading" class="mt-8">
      <StepEditor :guide-id="guideId!" />
    </div>
  </div>
</template>
