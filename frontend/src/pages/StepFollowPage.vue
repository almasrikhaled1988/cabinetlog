<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
    const response = await apiClient.get(`/guides/${guideId.value}/steps`);
    steps.value = response.data;
  } catch {
    error.value = 'Failed to load steps.';
  }
}

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

  if (stepIdParam.value && steps.value.length > 0) {
    goToStepById(stepIdParam.value);
  }

  if (currentStep.value) {
    await fetchStepMedia(currentStep.value._id);
  }

  loading.value = false;
}

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
      if (!allRequiredChecked.value) return;
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

const checklistState = ref<Record<string, boolean>>({});

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

// Image viewer state
const activeImageIndex = ref(0);
const lightboxOpen = ref(false);
const lightboxIndex = ref(0);
const lightboxZoomed = ref(false);

// Reset active image when step changes
watch(currentStepIndex, () => {
  activeImageIndex.value = 0;
  lightboxOpen.value = false;
  lightboxZoomed.value = false;
});

function openLightbox(index: number) {
  lightboxIndex.value = index;
  lightboxZoomed.value = false;
  lightboxOpen.value = true;
}

function closeLightbox() {
  lightboxOpen.value = false;
  lightboxZoomed.value = false;
}

function lightboxPrev() {
  if (lightboxIndex.value > 0) {
    lightboxIndex.value--;
    lightboxZoomed.value = false;
  }
}

function lightboxNext() {
  if (lightboxIndex.value < currentStepImages.value.length - 1) {
    lightboxIndex.value++;
    lightboxZoomed.value = false;
  }
}

function toggleZoom() {
  lightboxZoomed.value = !lightboxZoomed.value;
}

// Keyboard navigation for lightbox
function handleLightboxKeydown(e: KeyboardEvent) {
  if (!lightboxOpen.value) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lightboxPrev();
  if (e.key === 'ArrowRight') lightboxNext();
}

onMounted(() => {
  loadData();
  document.addEventListener('keydown', handleLightboxKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleLightboxKeydown);
});
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <div class="w-8 h-8 border-4 border-se-green border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-3 text-sm text-gray-500">Loading steps...</p>
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
      <button @click="navigateBack" class="mt-4 text-sm text-se-green hover:text-se-green-dark font-medium">← Back to Guide</button>
    </div>

    <!-- Step Follow Content -->
    <div v-else-if="guide && currentStep">
      <!-- Header bar -->
      <div class="card dark:card-dark mb-6 overflow-hidden">
        <div class="bg-gradient-to-r from-se-green to-se-green-dark px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <button @click="navigateBack" class="text-white/70 hover:text-white transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div>
                <p class="text-green-100 text-xs font-medium">Step {{ currentStep.step_order }} of {{ totalSteps }}</p>
                <h1 class="text-white text-lg font-bold">{{ currentStep.title }}</h1>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-white/80 text-sm hidden sm:inline">{{ completedCount }}/{{ totalSteps }}</span>
              <div class="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
                <div class="h-full bg-white rounded-full transition-all duration-300" :style="{ width: `${progressPercent}%` }"></div>
              </div>
              <span
                v-if="currentStepCompleted"
                class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-white"
              >
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                Done
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Main Content Area -->
        <div class="flex-1 min-w-0">
          <!-- Large Image Area -->
          <div class="card dark:card-dark overflow-hidden mb-5">
            <div v-if="currentStepImages.length > 0" class="relative">
              <img
                :src="getMediaUrl(currentStepImages[activeImageIndex].file_path)"
                :alt="currentStepImages[activeImageIndex].caption || currentStep.title"
                class="w-full h-auto max-h-[500px] object-contain bg-gray-50 dark:bg-gray-900 cursor-zoom-in"
                @click="openLightbox(activeImageIndex)"
              />
              <!-- Image counter -->
              <div v-if="currentStepImages.length > 1" class="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                {{ activeImageIndex + 1 }} / {{ currentStepImages.length }}
              </div>
              <!-- Zoom icon -->
              <button
                @click="openLightbox(activeImageIndex)"
                class="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
                aria-label="Zoom image"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                </svg>
              </button>
              <p v-if="currentStepImages[activeImageIndex].caption" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                {{ currentStepImages[activeImageIndex].caption }}
              </p>
            </div>
            <div v-else class="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900">
              <div class="text-center text-gray-400 dark:text-gray-600">
                <svg class="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="text-sm">No image for this step</p>
              </div>
            </div>
          </div>

          <!-- Image thumbnails (when multiple) -->
          <div v-if="currentStepImages.length > 1" class="flex gap-2 mb-5 overflow-x-auto pb-2">
            <button
              v-for="(media, idx) in currentStepImages"
              :key="media._id"
              @click="activeImageIndex = idx"
              class="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all"
              :class="idx === activeImageIndex ? 'border-se-green shadow-md' : 'border-gray-200 dark:border-gray-700 hover:border-se-green/50'"
            >
              <img :src="getMediaUrl(media.file_path)" :alt="media.caption || ''" class="w-full h-full object-cover" />
            </button>
          </div>

          <!-- Warning notes -->
          <div v-if="currentStep.warning_notes" class="mb-5 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-start gap-3">
            <div class="w-8 h-8 bg-amber-100 dark:bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-amber-800 dark:text-amber-400">Warning</p>
              <p class="text-sm text-amber-700 dark:text-amber-300/70 mt-0.5">{{ currentStep.warning_notes }}</p>
            </div>
          </div>

          <!-- Step description -->
          <div class="card dark:card-dark p-5 mb-5">
            <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {{ currentStep.description }}
            </p>
            <div v-if="currentStep.estimated_time" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Estimated time: {{ currentStep.estimated_time }} min
            </div>
          </div>

          <!-- Checklist -->
          <div v-if="currentStep.checklist_items && currentStep.checklist_items.length > 0" class="card dark:card-dark p-5 mb-5">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-se-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Checklist
              <span v-if="!allRequiredChecked" class="text-xs font-normal text-amber-600 dark:text-amber-400">
                (complete required items to finish step)
              </span>
            </h3>
            <div class="space-y-2">
              <label
                v-for="(item, index) in currentStep.checklist_items"
                :key="index"
                class="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                :class="isChecklistItemChecked(index) ? 'bg-green-50 dark:bg-green-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'"
              >
                <input
                  type="checkbox"
                  :checked="isChecklistItemChecked(index)"
                  @change="toggleChecklistItem(index)"
                  class="mt-0.5 h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-se-green focus:ring-se-green dark:bg-gray-700"
                  :disabled="currentStepCompleted"
                />
                <span
                  class="text-sm"
                  :class="[
                    isChecklistItemChecked(index) ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200',
                    item.required ? 'font-medium' : ''
                  ]"
                >
                  {{ item.text }}
                  <span v-if="item.required" class="text-red-500 text-xs ml-1">*</span>
                </span>
              </label>
            </div>
          </div>

          <!-- Navigation (sticky) -->
          <div class="sticky bottom-0 bg-gray-50 dark:bg-gray-900 pt-4 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 border-t border-gray-200 dark:border-gray-700 mt-4">
            <div class="flex items-center justify-between gap-3">
              <button
                @click="handlePrev"
                :disabled="isFirstStep"
                class="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-lg border transition-colors"
                :class="isFirstStep ? 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                Previous
              </button>

              <button
                @click="handleMarkComplete"
                :disabled="!currentStepCompleted && !allRequiredChecked"
                class="flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-lg transition-colors"
                :class="currentStepCompleted
                  ? 'text-se-green bg-se-green-50 dark:bg-se-green/10 border border-se-green/30 hover:bg-se-green-100 dark:hover:bg-se-green/20'
                  : allRequiredChecked
                    ? 'text-white bg-se-green hover:bg-se-green-dark shadow-sm'
                    : 'text-gray-400 dark:text-gray-600 bg-gray-200 dark:bg-gray-700 cursor-not-allowed'"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                {{ currentStepCompleted ? 'Completed ✓' : allRequiredChecked ? 'Mark Complete' : 'Complete checklist first' }}
              </button>

              <button
                @click="handleNext"
                :disabled="isLastStep"
                class="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
                :class="isLastStep ? 'text-gray-300 dark:text-gray-600 border border-gray-200 dark:border-gray-700 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 'text-white bg-se-green hover:bg-se-green-dark shadow-sm'"
              >
                Next
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Step List Sidebar -->
        <div class="lg:w-72 flex-shrink-0">
          <!-- Mobile toggle -->
          <button
            @click="showStepList = !showStepList"
            class="lg:hidden w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 mb-3"
          >
            <span>All Steps ({{ totalSteps }})</span>
            <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showStepList }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Step list -->
          <div class="card dark:card-dark overflow-hidden" :class="{ hidden: !showStepList, 'lg:block': true }">
            <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Steps</h3>
            </div>
            <nav class="max-h-[calc(100vh-200px)] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/30">
              <button
                v-for="(step, index) in steps"
                :key="step._id"
                @click="handleGoToStep(index)"
                class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors"
                :class="index === currentStepIndex
                  ? 'bg-se-green-50 dark:bg-se-green/10 text-se-green border-l-2 border-se-green'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-2 border-transparent'"
              >
                <span
                  class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium"
                  :class="isStepCompleted(step._id)
                    ? 'bg-se-green/10 text-se-green dark:bg-se-green/20'
                    : index === currentStepIndex
                      ? 'bg-se-green text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
                >
                  <svg v-if="isStepCompleted(step._id)" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <span v-else>{{ step.step_order }}</span>
                </span>
                <span class="truncate">{{ step.title }}</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty steps state -->
    <div v-else-if="guide && !currentStep" class="py-16 text-center">
      <p class="text-gray-500 dark:text-gray-400">This guide has no steps yet.</p>
      <button @click="navigateBack" class="mt-4 text-sm text-se-green hover:text-se-green-dark font-medium">← Back to Guide</button>
    </div>

    <!-- Image Lightbox -->
    <div
      v-if="lightboxOpen && currentStepImages.length > 0"
      class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      @click.self="closeLightbox"
    >
      <!-- Close button -->
      <button
        @click="closeLightbox"
        class="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
        aria-label="Close"
      >
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <!-- Image counter -->
      <div class="absolute top-4 left-4 text-white/70 text-sm z-10">
        {{ lightboxIndex + 1 }} / {{ currentStepImages.length }}
      </div>

      <!-- Zoom toggle -->
      <button
        @click="toggleZoom"
        class="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-sm z-10 flex items-center gap-1.5"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path v-if="!lightboxZoomed" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/>
        </svg>
        {{ lightboxZoomed ? 'Zoom out' : 'Zoom in' }}
      </button>

      <!-- Previous button -->
      <button
        v-if="lightboxIndex > 0"
        @click="lightboxPrev"
        class="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors z-10"
        aria-label="Previous image"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <!-- Next button -->
      <button
        v-if="lightboxIndex < currentStepImages.length - 1"
        @click="lightboxNext"
        class="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors z-10"
        aria-label="Next image"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      <!-- Image -->
      <div
        class="max-w-full max-h-full overflow-auto p-4"
        :class="lightboxZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'"
        @click="toggleZoom"
      >
        <img
          :src="getMediaUrl(currentStepImages[lightboxIndex].file_path)"
          :alt="currentStepImages[lightboxIndex].caption || 'Step image'"
          class="transition-transform duration-200"
          :class="lightboxZoomed ? 'max-w-none w-auto h-auto' : 'max-w-[90vw] max-h-[85vh] object-contain mx-auto'"
          :style="lightboxZoomed ? 'min-width: 150%; min-height: 150%' : ''"
        />
      </div>

      <!-- Caption -->
      <div
        v-if="currentStepImages[lightboxIndex].caption"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-lg max-w-md text-center z-10"
      >
        {{ currentStepImages[lightboxIndex].caption }}
      </div>

      <!-- Thumbnail strip at bottom -->
      <div
        v-if="currentStepImages.length > 1"
        class="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 z-10"
      >
        <button
          v-for="(media, idx) in currentStepImages"
          :key="media._id"
          @click.stop="lightboxIndex = idx"
          class="w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0"
          :class="idx === lightboxIndex ? 'border-white shadow-lg scale-110' : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'"
        >
          <img :src="getMediaUrl(media.file_path)" :alt="''" class="w-full h-full object-cover" />
        </button>
      </div>
    </div>
  </div>
</template>
