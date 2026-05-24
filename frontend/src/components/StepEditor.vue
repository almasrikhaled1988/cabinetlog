<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '@/api/client';
import FileUploader from '@/components/FileUploader.vue';

export interface BuildStep {
  _id: string;
  cabinet_guide_id: string;
  title: string;
  description: string;
  step_order: number;
  estimated_time?: number;
  warning_notes?: string;
  created_at: string;
}

interface StepForm {
  title: string;
  description: string;
  estimated_time: number | null;
  warning_notes: string;
}

interface StepValidationErrors {
  title?: string;
  estimated_time?: string;
  warning_notes?: string;
}

const props = defineProps<{
  guideId: string;
}>();

const steps = ref<BuildStep[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const editingStepId = ref<string | null>(null);
const showAddForm = ref(false);
const expandedStepId = ref<string | null>(null);

const newStepForm = ref<StepForm>({
  title: '',
  description: '',
  estimated_time: null,
  warning_notes: '',
});

const editStepForm = ref<StepForm>({
  title: '',
  description: '',
  estimated_time: null,
  warning_notes: '',
});

const newStepErrors = ref<StepValidationErrors>({});
const editStepErrors = ref<StepValidationErrors>({});

// Validation (Requirements 5.5, 12.5, 12.6)
function validateStepForm(form: StepForm): StepValidationErrors {
  const errors: StepValidationErrors = {};

  if (!form.title.trim()) {
    errors.title = 'Title is required';
  } else if (form.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters';
  } else if (form.title.trim().length > 200) {
    errors.title = 'Title must not exceed 200 characters';
  }

  if (form.estimated_time !== null && form.estimated_time !== undefined) {
    if (form.estimated_time <= 0) {
      errors.estimated_time = 'Estimated time must be a positive number';
    } else if (form.estimated_time > 10080) {
      errors.estimated_time = 'Estimated time must not exceed 10080 minutes';
    }
  }

  if (form.warning_notes && form.warning_notes.length > 1000) {
    errors.warning_notes = 'Warning notes must not exceed 1000 characters';
  }

  return errors;
}

function hasErrors(errors: StepValidationErrors): boolean {
  return Object.values(errors).some((e) => !!e);
}

// Load steps from API
async function loadSteps() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get<BuildStep[]>(`/guides/${props.guideId}/steps`);
    steps.value = Array.isArray(response.data) ? response.data : [];
  } catch {
    error.value = 'Failed to load steps';
  } finally {
    loading.value = false;
  }
}

// Add a new step (Requirement 5.1)
async function addStep() {
  const errors = validateStepForm(newStepForm.value);
  newStepErrors.value = errors;
  if (hasErrors(errors)) return;

  saving.value = true;
  error.value = null;
  try {
    const payload: Record<string, unknown> = {
      title: newStepForm.value.title.trim(),
      description: newStepForm.value.description.trim(),
    };
    if (newStepForm.value.estimated_time !== null && newStepForm.value.estimated_time !== undefined) {
      payload.estimated_time = Number(newStepForm.value.estimated_time);
    }
    if (newStepForm.value.warning_notes.trim()) {
      payload.warning_notes = newStepForm.value.warning_notes.trim();
    }

    const response = await apiClient.post<BuildStep>(`/guides/${props.guideId}/steps`, payload);
    steps.value.push(response.data);
    resetNewForm();
    showAddForm.value = false;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
      error.value = axiosErr.response?.data?.error?.message
        || axiosErr.response?.data?.message
        || 'Failed to add step';
    } else {
      error.value = 'Network error. Please try again.';
    }
  } finally {
    saving.value = false;
  }
}

// Update an existing step
async function updateStep(stepId: string) {
  const errors = validateStepForm(editStepForm.value);
  editStepErrors.value = errors;
  if (hasErrors(errors)) return;

  saving.value = true;
  error.value = null;
  try {
    const payload: Record<string, unknown> = {
      title: editStepForm.value.title.trim(),
      description: editStepForm.value.description.trim(),
    };
    if (editStepForm.value.estimated_time !== null && editStepForm.value.estimated_time !== undefined) {
      payload.estimated_time = Number(editStepForm.value.estimated_time);
    } else {
      payload.estimated_time = null;
    }
    payload.warning_notes = editStepForm.value.warning_notes.trim() || '';

    const response = await apiClient.put<BuildStep>(`/steps/${stepId}`, payload);
    const index = steps.value.findIndex((s) => s._id === stepId);
    if (index !== -1) {
      steps.value[index] = response.data;
    }
    editingStepId.value = null;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
      error.value = axiosErr.response?.data?.error?.message
        || axiosErr.response?.data?.message
        || 'Failed to update step';
    } else {
      error.value = 'Network error. Please try again.';
    }
  } finally {
    saving.value = false;
  }
}

// Delete a step (Requirement 5.4)
async function deleteStep(stepId: string) {
  if (!confirm('Are you sure you want to delete this step? All associated media will also be removed.')) {
    return;
  }

  saving.value = true;
  error.value = null;
  try {
    await apiClient.delete(`/steps/${stepId}`);
    steps.value = steps.value.filter((s) => s._id !== stepId);
    // Re-number steps locally after deletion
    steps.value.forEach((s, i) => {
      s.step_order = i + 1;
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
      error.value = axiosErr.response?.data?.error?.message
        || axiosErr.response?.data?.message
        || 'Failed to delete step';
    } else {
      error.value = 'Network error. Please try again.';
    }
  } finally {
    saving.value = false;
  }
}

// Move step up/down (Requirement 5.2 - reorder via API)
async function moveStep(index: number, direction: 'up' | 'down') {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= steps.value.length) return;

  // Swap locally
  const temp = steps.value[index];
  steps.value[index] = steps.value[targetIndex];
  steps.value[targetIndex] = temp;

  // Update step_order locally
  steps.value.forEach((s, i) => {
    s.step_order = i + 1;
  });

  // Call reorder API with new order
  const stepIds = steps.value.map((s) => s._id);
  error.value = null;
  try {
    await apiClient.put(`/guides/${props.guideId}/steps/reorder`, { stepIds });
  } catch (err: unknown) {
    // Revert on failure
    await loadSteps();
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
      error.value = axiosErr.response?.data?.error?.message
        || axiosErr.response?.data?.message
        || 'Failed to reorder steps';
    } else {
      error.value = 'Network error. Please try again.';
    }
  }
}

// Start editing a step
function startEditing(step: BuildStep) {
  editingStepId.value = step._id;
  editStepForm.value = {
    title: step.title,
    description: step.description || '',
    estimated_time: step.estimated_time ?? null,
    warning_notes: step.warning_notes || '',
  };
  editStepErrors.value = {};
}

// Cancel editing
function cancelEditing() {
  editingStepId.value = null;
  editStepErrors.value = {};
}

// Reset new step form
function resetNewForm() {
  newStepForm.value = {
    title: '',
    description: '',
    estimated_time: null,
    warning_notes: '',
  };
  newStepErrors.value = {};
}

// Cancel add form
function cancelAdd() {
  showAddForm.value = false;
  resetNewForm();
}

onMounted(() => {
  loadSteps();
});

// Expose for testing
defineExpose({ steps, loading, error, addStep, deleteStep, moveStep, loadSteps });
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900">Build Steps</h2>
      <button
        v-if="!showAddForm"
        type="button"
        @click="showAddForm = true"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Step
      </button>
    </div>

    <!-- Error banner -->
    <div
      v-if="error"
      class="p-3 bg-red-50 border border-red-200 rounded-lg"
      role="alert"
    >
      <p class="text-sm text-red-700">{{ error }}</p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>

    <!-- Steps list -->
    <div v-else-if="steps.length > 0" class="space-y-3">
      <div
        v-for="(step, index) in steps"
        :key="step._id"
        class="bg-white border border-gray-200 rounded-lg p-4"
      >
        <!-- View mode -->
        <div v-if="editingStepId !== step._id">
          <div class="flex items-start gap-3">
            <!-- Step number badge -->
            <div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">
              {{ step.step_order }}
            </div>

            <!-- Step content -->
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-medium text-gray-900">{{ step.title }}</h3>
              <p v-if="step.description" class="mt-1 text-sm text-gray-600">{{ step.description }}</p>

              <div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span v-if="step.estimated_time" class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ step.estimated_time }} min
                </span>
              </div>

              <!-- Warning notes -->
              <div
                v-if="step.warning_notes"
                class="mt-2 flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800"
              >
                <svg class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>{{ step.warning_notes }}</span>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex-shrink-0 flex items-center gap-1">
              <!-- Move up -->
              <button
                type="button"
                :disabled="index === 0"
                @click="moveStep(index, 'up')"
                class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                :aria-label="`Move step ${step.step_order} up`"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <!-- Move down -->
              <button
                type="button"
                :disabled="index === steps.length - 1"
                @click="moveStep(index, 'down')"
                class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                :aria-label="`Move step ${step.step_order} down`"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <!-- Edit -->
              <button
                type="button"
                @click="startEditing(step)"
                class="p-1 text-gray-400 hover:text-blue-600"
                :aria-label="`Edit step ${step.step_order}`"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <!-- Delete -->
              <button
                type="button"
                @click="deleteStep(step._id)"
                class="p-1 text-gray-400 hover:text-red-600"
                :aria-label="`Delete step ${step.step_order}`"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- File Upload Section (toggle) -->
          <div class="mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              @click="expandedStepId = expandedStepId === step._id ? null : step._id"
              class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors"
              :class="expandedStepId === step._id
                ? 'text-blue-700 bg-blue-50 border border-blue-200'
                : 'text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {{ expandedStepId === step._id ? 'Hide Images & Files' : 'Upload Images & Files' }}
            </button>
            <div v-if="expandedStepId === step._id" class="mt-4">
              <FileUploader :build-step-id="step._id" />
            </div>
          </div>
        </div>

        <!-- Edit mode -->
        <div v-else class="space-y-3">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">
              {{ step.step_order }}
            </div>
            <span class="text-sm font-medium text-gray-500">Editing step</span>
          </div>

          <!-- Title -->
          <div>
            <label :for="`edit-title-${step._id}`" class="block text-sm font-medium text-gray-700 mb-1">
              Title <span class="text-red-500">*</span>
            </label>
            <input
              :id="`edit-title-${step._id}`"
              v-model="editStepForm.title"
              type="text"
              class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              :class="editStepErrors.title ? 'border-red-300' : 'border-gray-300'"
              maxlength="200"
            />
            <p v-if="editStepErrors.title" class="mt-1 text-xs text-red-600">{{ editStepErrors.title }}</p>
          </div>

          <!-- Description -->
          <div>
            <label :for="`edit-desc-${step._id}`" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              :id="`edit-desc-${step._id}`"
              v-model="editStepForm.description"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
            ></textarea>
          </div>

          <!-- Estimated time -->
          <div>
            <label :for="`edit-time-${step._id}`" class="block text-sm font-medium text-gray-700 mb-1">Estimated Time (minutes)</label>
            <input
              :id="`edit-time-${step._id}`"
              v-model.number="editStepForm.estimated_time"
              type="number"
              min="1"
              max="10080"
              class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              :class="editStepErrors.estimated_time ? 'border-red-300' : 'border-gray-300'"
              placeholder="Optional"
            />
            <p v-if="editStepErrors.estimated_time" class="mt-1 text-xs text-red-600">{{ editStepErrors.estimated_time }}</p>
          </div>

          <!-- Warning notes -->
          <div>
            <label :for="`edit-warn-${step._id}`" class="block text-sm font-medium text-gray-700 mb-1">Warning Notes</label>
            <textarea
              :id="`edit-warn-${step._id}`"
              v-model="editStepForm.warning_notes"
              rows="2"
              class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
              :class="editStepErrors.warning_notes ? 'border-red-300' : 'border-gray-300'"
              maxlength="1000"
              placeholder="Optional safety warnings or important notes"
            ></textarea>
            <p v-if="editStepErrors.warning_notes" class="mt-1 text-xs text-red-600">{{ editStepErrors.warning_notes }}</p>
          </div>

          <!-- Edit actions -->
          <div class="flex items-center gap-2 pt-2">
            <button
              type="button"
              :disabled="saving"
              @click="updateStep(step._id)"
              class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
            <button
              type="button"
              @click="cancelEditing"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>

          <!-- File Upload in Edit Mode -->
          <div class="mt-4 pt-4 border-t border-gray-200">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Step Images & Files</h4>
            <FileUploader :build-step-id="step._id" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && !showAddForm" class="text-center py-8 text-gray-500">
      <svg class="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p class="text-sm">No build steps yet. Add your first step to get started.</p>
    </div>

    <!-- Add step form -->
    <div v-if="showAddForm" class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 class="text-sm font-medium text-gray-700">New Step</h3>

      <!-- Title -->
      <div>
        <label for="new-step-title" class="block text-sm font-medium text-gray-700 mb-1">
          Title <span class="text-red-500">*</span>
        </label>
        <input
          id="new-step-title"
          v-model="newStepForm.title"
          type="text"
          class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          :class="newStepErrors.title ? 'border-red-300' : 'border-gray-300'"
          placeholder="e.g. Mount DIN Rails"
          maxlength="200"
        />
        <p v-if="newStepErrors.title" class="mt-1 text-xs text-red-600">{{ newStepErrors.title }}</p>
      </div>

      <!-- Description -->
      <div>
        <label for="new-step-desc" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          id="new-step-desc"
          v-model="newStepForm.description"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
          placeholder="Describe what needs to be done in this step..."
        ></textarea>
      </div>

      <!-- Estimated time -->
      <div>
        <label for="new-step-time" class="block text-sm font-medium text-gray-700 mb-1">Estimated Time (minutes)</label>
        <input
          id="new-step-time"
          v-model.number="newStepForm.estimated_time"
          type="number"
          min="1"
          max="10080"
          class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          :class="newStepErrors.estimated_time ? 'border-red-300' : 'border-gray-300'"
          placeholder="Optional"
        />
        <p v-if="newStepErrors.estimated_time" class="mt-1 text-xs text-red-600">{{ newStepErrors.estimated_time }}</p>
      </div>

      <!-- Warning notes -->
      <div>
        <label for="new-step-warn" class="block text-sm font-medium text-gray-700 mb-1">Warning Notes</label>
        <textarea
          id="new-step-warn"
          v-model="newStepForm.warning_notes"
          rows="2"
          class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
          :class="newStepErrors.warning_notes ? 'border-red-300' : 'border-gray-300'"
          maxlength="1000"
          placeholder="Optional safety warnings or important notes"
        ></textarea>
        <p v-if="newStepErrors.warning_notes" class="mt-1 text-xs text-red-600">{{ newStepErrors.warning_notes }}</p>
      </div>

      <!-- Add form actions -->
      <div class="flex items-center justify-between pt-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="saving"
            @click="addStep"
            class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ saving ? 'Adding...' : 'Add Step' }}
          </button>
          <button
            type="button"
            @click="cancelAdd"
            class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
        <p class="text-xs text-gray-400 italic">
          💡 You can upload images after saving the step
        </p>
      </div>
    </div>
  </div>
</template>
