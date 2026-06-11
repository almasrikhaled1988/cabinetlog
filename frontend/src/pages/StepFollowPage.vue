<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api/client';
import { useGuideSteps } from '@/composables/useGuideSteps';

interface Guide {
  _id: string;
  title: string;
  slug: string;
  cabinet_type: string;
  drive_model?: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
}

interface StepMedia {
  _id: string;
  build_step_id: string;
  file_type: 'image' | 'pdf';
  file_path: string;
  original_name: string;
  caption?: string;
  sort_order: number;
}

const route = useRoute();
const router = useRouter();

const guideId = computed(() => route.params.id as string);
const stepIdParam = computed(() => route.params.stepId as string);

const guide = ref<Guide | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const showStepList = ref(false);
const stepMedia = ref<StepMedia[]>([]);

const {
  steps,
  currentStepIndex,
  currentStep,
  isFirstStep,
  isLastStep,
  completedCount,
  totalSteps,
  progressPercent,
  markComplete,
  unmarkComplete,
  isStepCompleted,
  nextStep,
  prevStep,
  goToStep,
  goToStepById,
} = useGuideSteps(guideId.value);

// Fetch guide info
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

// Fetch all steps for the guide
async function fetchSteps() {
  try {
    const response = await apiClient.get(`/guides/${guideId.value}/steps`);
    steps.value = response.data;
  } catch {
    error.value = 'Failed to load steps.';
  }
}

// Fetch media for the current step
async function fetchStepMedia(stepId: string) {
  try {
    const response = await apiClient.get<StepMedia[]>(`/steps/${stepId}/media`);
    stepMedia.value = response.data;
  } catch {
    stepMedia.value = [];
  }
}

async function loadData() {
  loading.value = true;
  error.value = null;
  await Promise.all([fetchGuide(), fetchSteps()]);

  // Navigate to the step specified in the URL
  if (stepIdParam.value && steps.value.length > 0) {
    goToStepById(stepIdParam.value);
  }

  // Load media for current step
  if (currentStep.value) {
    await fetchStepMedia(currentStep.value._id);
  }

  loading.value = false;
}

// Update URL and fetch media when step changes
watch(currentStepIndex, async () => {
  if (currentStep.value) {
    router.replace({
      name: 'step-follow',
      params: { id: guideId.value, stepId: currentStep.value._id },
    });
    await fetchStepMedia(currentStep.value._id);
  }
});

function handleNext() {
  nextStep();
  showStepList.value = false;
}

function handlePrev() {
  prevStep();
  showStepList.value = false;
}

function handleGoToStep(index: number) {
  goToStep(index);
  showStepList.value = false;
}

function handleMarkComplete() {
  if (currentStep.value) {
    if (isStepCompleted(currentStep.value._id)) {
      unmarkComplete(currentStep.value._id);
    } else {
      // Enforce required checklist items
      if (!allRequiredChecked.value) {
        return; // Button is disabled but just in case
      }
      markComplete(currentStep.value._id);
    }
  }
}

function navigateBack() {
  router.push({ name: 'guide-detail', params: { id: guideId.value } });
}

function getMediaUrl(filePath: string): string {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  return `/uploads/${filePath}`;
}

const currentStepCompleted = computed(() => {
  if (!currentStep.value) return false;
  return isStepCompleted(currentStep.value._id);
});

// Checklist state
const checklistState = ref<Record<string, boolean>>({});

// Reset checklist when step changes
watch(currentStepIndex, () => {
  checklistState.value = {};
});

function toggleChecklistItem(index: number) {
  const key = `${currentStep.value?._id}-${index}`;
  checklistState.value[key] = !checklistState.value[key];
}

function isChecklistItemChecked(index: number): boolean {
  const key = `${currentStep.value?._id}-${index}`;
  return !!checklistState.value[key];
}

// All required checklist items must be checked before completing
const canMarkComplete = computed(() => {
  if (!currentStep.value) return false;
  const items = currentStep.value.checklist_items;
  if (!items || items.length === 0) return true;

  const requiredItems = items.filter(i => i.required);
  if (requiredItems.length === 0) return true;

  return requiredItems.every((_, index) => {
    const actualIndex = items.findIndex(i => i === requiredItems[index] ? true : false);
    // Find actual index in full list
    let reqIdx = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].required) {
        if (reqIdx === index) {
          return isChecklistItemChecked(i);
        }
        reqIdx++;
      }
    }
    return false;
  });
});

// Simpler: just check all required items are done
const allRequiredChecked = computed(() => {
  if (!currentStep.value) return true;
  const items = currentStep.value.checklist_items;
  if (!items || items.length === 0) return true;

  for (let i = 0; i < items.length; i++) {
    if (items[i].required && !isChecklistItemChecked(i)) {
      return false;
    }
  }
  return true;
});

const currentStepImages = computed(() => {
  return stepMedia.value
    .filter((m) => m.file_type === 'image')
    .sort((a, b) => a.sort_order - b.sort_order);
});

onMounted(loadData);
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <div
          class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"
        ></div>
        <p class="mt-3 text-sm text-gray-500">Loading steps...</p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="py-16 text-center">
      <div class="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
        <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <p class="text-gray-700 font-medium">{{ error }}</p>
      <button
        @click="navigateBack"
        class="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Back to Guide
      </button>
    </div>

    <!-- Step Follow Content -->
    <div v-else-if="guide && currentStep" class="flex flex-col lg:flex-row gap-6">
      <!-- Main Content Area -->
      <div class="flex-1 min-w-0">
        <!-- Header with back button and progress -->
        <div class="flex items-center justify-between mb-4">
          <button
            @click="navigateBack"
            class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {{ guide.title }}
          </button>

          <!-- Progress indicator -->
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <span>{{ completedCount }}/{{ totalSteps }} completed</span>
            <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                class="h-full bg-green-500 rounded-full transition-all duration-300"
                :style="{ width: `${progressPercent}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Step number and title -->
        <div class="mb-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm font-medium text-blue-600">
              Step {{ currentStep.step_order }} of {{ totalSteps }}
            </span>
            <span
              v-if="currentStepCompleted"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              Completed
            </span>
          </div>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900">
            {{ currentStep.title }}
          </h1>
        </div>

        <!-- Large Image Area -->
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <div v-if="currentStepImages.length > 0" class="relative">
            <img
              :src="getMediaUrl(currentStepImages[0].file_path)"
              :alt="currentStepImages[0].caption || currentStep.title"
              class="w-full h-auto max-h-[500px] object-contain bg-gray-50"
            />
            <p
              v-if="currentStepImages[0].caption"
              class="px-4 py-2 text-sm text-gray-600 bg-gray-50 border-t border-gray-100"
            >
              {{ currentStepImages[0].caption }}
            </p>
          </div>
          <!-- Placeholder when no media -->
          <div
            v-else
            class="flex items-center justify-center h-64 bg-gray-50"
          >
            <div class="text-center text-gray-400">
              <svg
                class="w-16 h-16 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p class="text-sm">No image for this step</p>
            </div>
          </div>
        </div>

        <!-- Additional images -->
        <div
          v-if="currentStepImages.length > 1"
          class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4"
        >
          <div
            v-for="media in currentStepImages.slice(1)"
            :key="media._id"
            class="border border-gray-200 rounded-lg overflow-hidden"
          >
            <img
              :src="getMediaUrl(media.file_path)"
              :alt="media.caption || ''"
              class="w-full h-32 object-cover"
            />
          </div>
        </div>

        <!-- Warning notes -->
        <div
          v-if="currentStep.warning_notes"
          class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg"
        >
          <div class="flex items-start gap-2">
            <svg
              class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <p class="text-sm font-medium text-amber-800">Warning</p>
              <p class="text-sm text-amber-700 mt-1">{{ currentStep.warning_notes }}</p>
            </div>
          </div>
        </div>

        <!-- Step description -->
        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <p class="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {{ currentStep.description }}
          </p>
          <div
            v-if="currentStep.estimated_time"
            class="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Estimated time: {{ currentStep.estimated_time }} min
          </div>
        </div>

        <!-- Checklist panel -->
        <div
          v-if="currentStep.checklist_items && currentStep.checklist_items.length > 0"
          class="bg-white border border-gray-200 rounded-lg p-4 mb-6"
        >
          <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Checklist
            <span v-if="!allRequiredChecked" class="text-xs font-normal text-amber-600">
              (complete required items to finish step)
            </span>
          </h3>
          <div class="space-y-2">
            <label
              v-for="(item, index) in currentStep.checklist_items"
              :key="index"
              class="flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              :class="isChecklistItemChecked(index) ? 'bg-green-50' : ''"
            >
              <input
                type="checkbox"
                :checked="isChecklistItemChecked(index)"
                @change="toggleChecklistItem(index)"
                class="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                :disabled="currentStepCompleted"
              />
              <span
                class="text-sm"
                :class="[
                  isChecklistItemChecked(index) ? 'text-gray-500 line-through' : 'text-gray-800',
                  item.required ? 'font-medium' : ''
                ]"
              >
                {{ item.text }}
                <span v-if="item.required" class="text-red-500 text-xs ml-1">*</span>
              </span>
            </label>
          </div>
        </div>

        <!-- Navigation and Mark Complete (sticky on tablet) -->
        <div class="sticky bottom-0 bg-gray-50 dark:bg-gray-900 pt-3 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 border-t border-gray-200 dark:border-gray-700 mt-4">
          <div class="flex items-center justify-between gap-3">
          <!-- Previous button -->
          <button
            @click="handlePrev"
            :disabled="isFirstStep"
            class="flex items-center gap-1 px-4 py-3 text-sm sm:text-base font-medium rounded-lg border transition-colors"
            :class="
              isFirstStep
                ? 'text-gray-300 border-gray-200 cursor-not-allowed bg-gray-50'
                : 'text-gray-700 border-gray-300 hover:bg-gray-50 bg-white'
            "
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Previous
          </button>

          <!-- Mark Complete button -->
          <button
            @click="handleMarkComplete"
            :disabled="!currentStepCompleted && !allRequiredChecked"
            class="flex items-center gap-2 px-5 py-3 text-sm sm:text-base font-medium rounded-lg transition-colors"
            :class="
              currentStepCompleted
                ? 'text-green-700 bg-green-50 border border-green-200 hover:bg-green-100'
                : allRequiredChecked
                  ? 'text-white bg-green-600 hover:bg-green-700'
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed'
            "
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {{ currentStepCompleted ? 'Completed ✓' : allRequiredChecked ? 'Mark Complete' : 'Complete checklist first' }}
          </button>

          <!-- Next button -->
          <button
            @click="handleNext"
            :disabled="isLastStep"
            class="flex items-center gap-1 px-4 py-3 text-sm sm:text-base font-medium rounded-lg border transition-colors"
            :class="
              isLastStep
                ? 'text-gray-300 border-gray-200 cursor-not-allowed bg-gray-50'
                : 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700'
            "
          >
            Next
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          </div>
        </div>
      </div>

      <!-- Step List Sidebar (desktop) / Dropdown (mobile) -->
      <div class="lg:w-72 flex-shrink-0">
        <!-- Mobile toggle -->
        <button
          @click="showStepList = !showStepList"
          class="lg:hidden w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 mb-3"
        >
          <span>All Steps ({{ totalSteps }})</span>
          <svg
            class="w-4 h-4 transition-transform"
            :class="{ 'rotate-180': showStepList }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <!-- Step list -->
        <div
          class="bg-white border border-gray-200 rounded-lg overflow-hidden"
          :class="{ hidden: !showStepList, 'lg:block': true }"
        >
          <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 class="text-sm font-semibold text-gray-700">Steps</h3>
          </div>
          <nav class="max-h-[calc(100vh-200px)] overflow-y-auto">
            <button
              v-for="(step, index) in steps"
              :key="step._id"
              @click="handleGoToStep(index)"
              class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b border-gray-50 last:border-b-0 transition-colors"
              :class="
                index === currentStepIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              "
            >
              <!-- Step number / completed indicator -->
              <span
                class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium"
                :class="
                  isStepCompleted(step._id)
                    ? 'bg-green-100 text-green-700'
                    : index === currentStepIndex
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                "
              >
                <svg
                  v-if="isStepCompleted(step._id)"
                  class="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span v-else>{{ step.step_order }}</span>
              </span>
              <!-- Step title -->
              <span class="truncate">{{ step.title }}</span>
            </button>
          </nav>
        </div>
      </div>
    </div>

    <!-- Empty steps state -->
    <div v-else-if="guide && !currentStep" class="py-16 text-center">
      <p class="text-gray-500">This guide has no steps yet.</p>
      <button
        @click="navigateBack"
        class="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Back to Guide
      </button>
    </div>
  </div>
</template>
