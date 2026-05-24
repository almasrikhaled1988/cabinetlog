import { ref, computed } from 'vue';

export interface BuildStep {
  _id: string;
  cabinet_guide_id: string;
  title: string;
  description: string;
  step_order: number;
  estimated_time?: number;
  warning_notes?: string;
}

export function useGuideSteps(guideId: string) {
  const steps = ref<BuildStep[]>([]);
  const currentStepIndex = ref(0);
  const completedStepIds = ref<string[]>([]);

  const storageKey = `guide-progress-${guideId}`;

  // Load progress from localStorage
  function loadProgress() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          completedStepIds.value = parsed;
        } else {
          completedStepIds.value = [];
        }
      }
    } catch {
      completedStepIds.value = [];
    }
  }

  // Save progress to localStorage
  function saveProgress() {
    localStorage.setItem(storageKey, JSON.stringify(completedStepIds.value));
  }

  // Mark a step as complete
  function markComplete(stepId: string) {
    if (!completedStepIds.value.includes(stepId)) {
      completedStepIds.value = [...completedStepIds.value, stepId];
      saveProgress();
    }
  }

  // Unmark a step (toggle)
  function unmarkComplete(stepId: string) {
    completedStepIds.value = completedStepIds.value.filter((id) => id !== stepId);
    saveProgress();
  }

  // Check if a step is completed
  function isStepCompleted(stepId: string): boolean {
    return completedStepIds.value.includes(stepId);
  }

  // Navigate to next step
  function nextStep() {
    if (currentStepIndex.value < steps.value.length - 1) {
      currentStepIndex.value++;
    }
  }

  // Navigate to previous step
  function prevStep() {
    if (currentStepIndex.value > 0) {
      currentStepIndex.value--;
    }
  }

  // Jump to a specific step by index
  function goToStep(index: number) {
    if (index >= 0 && index < steps.value.length) {
      currentStepIndex.value = index;
    }
  }

  // Jump to a specific step by ID
  function goToStepById(stepId: string) {
    const index = steps.value.findIndex((s) => s._id === stepId);
    if (index !== -1) {
      currentStepIndex.value = index;
    }
  }

  // Computed properties
  const currentStep = computed(() => steps.value[currentStepIndex.value] || null);
  const isFirstStep = computed(() => currentStepIndex.value === 0);
  const isLastStep = computed(() => currentStepIndex.value === steps.value.length - 1);
  const completedCount = computed(() => completedStepIds.value.length);
  const totalSteps = computed(() => steps.value.length);
  const progressPercent = computed(() => {
    if (steps.value.length === 0) return 0;
    return Math.round((completedStepIds.value.length / steps.value.length) * 100);
  });

  // Initialize progress on creation
  loadProgress();

  return {
    steps,
    currentStepIndex,
    currentStep,
    completedStepIds,
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
    loadProgress,
  };
}
