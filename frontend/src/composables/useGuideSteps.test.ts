import { describe, it, expect, beforeEach } from 'vitest';
import { useGuideSteps } from './useGuideSteps';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const mockSteps = [
  {
    _id: 'step-1',
    cabinet_guide_id: 'guide-1',
    title: 'Mount DIN Rails',
    description: 'Install DIN rails',
    step_order: 1,
  },
  {
    _id: 'step-2',
    cabinet_guide_id: 'guide-1',
    title: 'Install Breakers',
    description: 'Mount circuit breakers',
    step_order: 2,
    warning_notes: 'Ensure power is off',
  },
  {
    _id: 'step-3',
    cabinet_guide_id: 'guide-1',
    title: 'Wire Connections',
    description: 'Connect wiring',
    step_order: 3,
    estimated_time: 30,
  },
];

describe('useGuideSteps', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('initializes with empty steps and index 0', () => {
    const { steps, currentStepIndex, totalSteps } = useGuideSteps('guide-1');
    expect(steps.value).toEqual([]);
    expect(currentStepIndex.value).toBe(0);
    expect(totalSteps.value).toBe(0);
  });

  it('uses guide-specific localStorage key', () => {
    const { steps, markComplete } = useGuideSteps('guide-abc');
    steps.value = mockSteps;
    markComplete('step-1');
    expect(localStorageMock.getItem('guide-progress-guide-abc')).toBe(
      JSON.stringify(['step-1'])
    );
  });

  describe('navigation', () => {
    it('navigates to next step', () => {
      const { steps, currentStepIndex, nextStep } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      expect(currentStepIndex.value).toBe(0);
      nextStep();
      expect(currentStepIndex.value).toBe(1);
      nextStep();
      expect(currentStepIndex.value).toBe(2);
    });

    it('does not go past last step', () => {
      const { steps, currentStepIndex, nextStep } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      currentStepIndex.value = 2;
      nextStep();
      expect(currentStepIndex.value).toBe(2);
    });

    it('navigates to previous step', () => {
      const { steps, currentStepIndex, prevStep } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      currentStepIndex.value = 2;
      prevStep();
      expect(currentStepIndex.value).toBe(1);
      prevStep();
      expect(currentStepIndex.value).toBe(0);
    });

    it('does not go before first step', () => {
      const { steps, currentStepIndex, prevStep } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      expect(currentStepIndex.value).toBe(0);
      prevStep();
      expect(currentStepIndex.value).toBe(0);
    });

    it('isFirstStep and isLastStep computed correctly', () => {
      const { steps, currentStepIndex, isFirstStep, isLastStep } = useGuideSteps('guide-1');
      steps.value = mockSteps;

      expect(isFirstStep.value).toBe(true);
      expect(isLastStep.value).toBe(false);

      currentStepIndex.value = 2;
      expect(isFirstStep.value).toBe(false);
      expect(isLastStep.value).toBe(true);
    });

    it('goToStep jumps to specific index', () => {
      const { steps, currentStepIndex, goToStep } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      goToStep(2);
      expect(currentStepIndex.value).toBe(2);
    });

    it('goToStep ignores invalid index', () => {
      const { steps, currentStepIndex, goToStep } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      goToStep(5);
      expect(currentStepIndex.value).toBe(0);
      goToStep(-1);
      expect(currentStepIndex.value).toBe(0);
    });

    it('goToStepById navigates by step ID', () => {
      const { steps, currentStepIndex, goToStepById } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      goToStepById('step-3');
      expect(currentStepIndex.value).toBe(2);
    });

    it('allows free navigation without requiring sequential completion', () => {
      const { steps, currentStepIndex, goToStep } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      // Jump directly to step 3 without completing step 1 or 2
      goToStep(2);
      expect(currentStepIndex.value).toBe(2);
      // Jump back to step 1
      goToStep(0);
      expect(currentStepIndex.value).toBe(0);
    });
  });

  describe('progress tracking', () => {
    it('marks a step as complete', () => {
      const { steps, markComplete, isStepCompleted, completedCount } =
        useGuideSteps('guide-1');
      steps.value = mockSteps;

      expect(isStepCompleted('step-1')).toBe(false);
      markComplete('step-1');
      expect(isStepCompleted('step-1')).toBe(true);
      expect(completedCount.value).toBe(1);
    });

    it('does not duplicate completed step IDs', () => {
      const { steps, markComplete, completedCount } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      markComplete('step-1');
      markComplete('step-1');
      expect(completedCount.value).toBe(1);
    });

    it('unmarks a completed step', () => {
      const { steps, markComplete, unmarkComplete, isStepCompleted } =
        useGuideSteps('guide-1');
      steps.value = mockSteps;
      markComplete('step-1');
      expect(isStepCompleted('step-1')).toBe(true);
      unmarkComplete('step-1');
      expect(isStepCompleted('step-1')).toBe(false);
    });

    it('persists progress to localStorage', () => {
      const { steps, markComplete } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      markComplete('step-1');
      markComplete('step-2');

      const stored = JSON.parse(
        localStorageMock.getItem('guide-progress-guide-1') || '[]'
      );
      expect(stored).toEqual(['step-1', 'step-2']);
    });

    it('restores progress from localStorage on init', () => {
      localStorageMock.setItem(
        'guide-progress-guide-1',
        JSON.stringify(['step-1', 'step-3'])
      );

      const { isStepCompleted, completedCount } = useGuideSteps('guide-1');
      expect(isStepCompleted('step-1')).toBe(true);
      expect(isStepCompleted('step-3')).toBe(true);
      expect(isStepCompleted('step-2')).toBe(false);
      expect(completedCount.value).toBe(2);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorageMock.setItem('guide-progress-guide-1', 'not-valid-json{{{');

      const { completedCount } = useGuideSteps('guide-1');
      expect(completedCount.value).toBe(0);
    });

    it('handles non-array localStorage value gracefully', () => {
      localStorageMock.setItem('guide-progress-guide-1', JSON.stringify({ foo: 'bar' }));

      const { completedCount } = useGuideSteps('guide-1');
      expect(completedCount.value).toBe(0);
    });

    it('handles missing localStorage gracefully', () => {
      const { completedCount } = useGuideSteps('guide-nonexistent');
      expect(completedCount.value).toBe(0);
    });

    it('calculates progress percent correctly', () => {
      const { steps, markComplete, progressPercent } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      expect(progressPercent.value).toBe(0);

      markComplete('step-1');
      expect(progressPercent.value).toBe(33);

      markComplete('step-2');
      expect(progressPercent.value).toBe(67);

      markComplete('step-3');
      expect(progressPercent.value).toBe(100);
    });
  });

  describe('currentStep computed', () => {
    it('returns the step at current index', () => {
      const { steps, currentStep, currentStepIndex } = useGuideSteps('guide-1');
      steps.value = mockSteps;
      expect(currentStep.value?._id).toBe('step-1');

      currentStepIndex.value = 1;
      expect(currentStep.value?._id).toBe('step-2');
    });

    it('returns null when steps are empty', () => {
      const { currentStep } = useGuideSteps('guide-1');
      expect(currentStep.value).toBeNull();
    });
  });

  describe('independent guide progress', () => {
    it('stores progress independently per guide', () => {
      const guide1 = useGuideSteps('guide-1');
      const guide2 = useGuideSteps('guide-2');

      guide1.steps.value = mockSteps;
      guide2.steps.value = mockSteps;

      guide1.markComplete('step-1');
      guide2.markComplete('step-2');

      expect(guide1.isStepCompleted('step-1')).toBe(true);
      expect(guide1.isStepCompleted('step-2')).toBe(false);

      expect(guide2.isStepCompleted('step-1')).toBe(false);
      expect(guide2.isStepCompleted('step-2')).toBe(true);
    });
  });
});
