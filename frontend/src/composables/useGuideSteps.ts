import { ref, computed } from 'vue';
import apiClient from '@/api/client';

export interface BuildStep {
  _id: string;
  cabinet_guide_id: string;
  title: string;
  description: string;
  step_order: number;
  estimated_time?: number;
  warning_notes?: string;
  checklist_items?: Array<{ text: string; required: boolean }>;
}

export function useGuideSteps(guideId: string) {
  const steps = ref<BuildStep[]>([]);
  const currentStepIndex = ref(0);
  const completedStepIds = ref<string[]>([]);
  const stepTimers = ref<Record<string, number>>({}); // stepId -> start timestamp

  // Load progress from server (falls back to localStorage)
  async function loadProgress() {
    try {
      const res = await apiClient.get(`/progress/${guideId}`);
      completedStepIds.value = res.data.map((p: any) => p.step_id);
    } catch {
      // Fallback to localStorage
      const storageKey = `guide-progress-${guideId}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            completedStepIds.value = parsed;
          }
        }
      } catch {
        completedStepIds.value = [];
      }
    }
  }

  // Start timer for a step
  function startTimer(stepId: string) {
    if (!stepTimers.value[stepId]) {
      stepTimers.value[stepId] = Date.now();
    }
  }

  // Get elapsed time in seconds
  function getElapsedTime(stepId: string): number {
    const start = stepTimers.value[stepId];
    if (!start) return 0;
    return Math.round((Date.now() - start) / 1000);
  }

  // Mark a step as complete (persists to server)
  async function markComplete(stepId: string) {
    if (!completedStepIds.value.includes(stepId)) {
      completedStepIds.value = [...completedStepIds.value, stepId];

      const timeSpent = getElapsedTime(stepId);

      try {
        await apiClient.post(`/progress/${guideId}/steps/${stepId}/complete`, {
          timeSpent: timeSpent > 0 ? timeSpent : undefined,
        });
      } catch {
        // Also store locally as fallback
        const storageKey = `guide-progress-${guideId}`;
        localStorage.setItem(storageKey, JSON.stringify(completedStepIds.value));
      }

      // Clear timer
      delete stepTimers.value[stepId];
    }
  }

  // Unmark a step
  async function unmarkComplete(stepId: string) {
    completedStepIds.value = completedStepIds.value.filter((id) => id !== stepId);

    try {
      await apiClient.delete(`/progress/${guideId}/steps/${stepId}/complete`);
    } catch {
      const storageKey = `guide-progress-${guideId}`;
      localStorage.setItem(storageKey, JSON.stringify(completedStepIds.value));
    }
  }

  function isStepCompleted(stepId: string): boolean {
    return completedStepIds.value.includes(stepId);
  }

  function nextStep() {
    if (currentStepIndex.value < steps.value.length - 1) {
      currentStepIndex.value++;
      // Start timer for next step
      const nextStepObj = steps.value[currentStepIndex.value];
      if (nextStepObj) startTimer(nextStepObj._id);
    }
  }

  function prevStep() {
    if (currentStepIndex.value > 0) {
      currentStepIndex.value--;
    }
  }

  function goToStep(index: number) {
    if (index >= 0 && index < steps.value.length) {
      currentStepIndex.value = index;
      const step = steps.value[index];
      if (step) startTimer(step._id);
    }
  }

  function goToStepById(stepId: string) {
    const index = steps.value.findIndex((s) => s._id === stepId);
    if (index !== -1) {
      currentStepIndex.value = index;
      startTimer(stepId);
    }
  }

  const currentStep = computed(() => steps.value[currentStepIndex.value] || null);
  const isFirstStep = computed(() => currentStepIndex.value === 0);
  const isLastStep = computed(() => currentStepIndex.value === steps.value.length - 1);
  const completedCount = computed(() => completedStepIds.value.length);
  const totalSteps = computed(() => steps.value.length);
  const progressPercent = computed(() => {
    if (steps.value.length === 0) return 0;
    return Math.round((completedStepIds.value.length / steps.value.length) * 100);
  });

  // Initialize
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
    startTimer,
    getElapsedTime,
    stepTimers,
  };
}
