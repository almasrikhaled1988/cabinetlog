<script setup lang="ts">
import { ref, watch } from 'vue';
import draggable from 'vuedraggable';
import apiClient from '@/api/client';

interface BuildStep {
  _id: string;
  title: string;
  step_order: number;
  estimated_time?: number;
  warning_notes?: string;
}

const props = defineProps<{
  guideId: string;
  steps: BuildStep[];
}>();

const emit = defineEmits<{
  (e: 'reordered'): void;
  (e: 'edit', stepId: string): void;
  (e: 'delete', stepId: string): void;
}>();

const localSteps = ref<BuildStep[]>([...props.steps]);
const saving = ref(false);

watch(
  () => props.steps,
  (val) => {
    localSteps.value = [...val];
  }
);

async function onDragEnd() {
  saving.value = true;
  // Build new order array
  const stepOrder = localSteps.value.map((s, i) => ({
    stepId: s._id,
    step_order: i + 1,
  }));

  try {
    await apiClient.put(`/guides/${props.guideId}/steps/reorder`, { steps: stepOrder });
    emit('reordered');
  } catch {
    // Revert
    localSteps.value = [...props.steps];
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div v-if="saving" class="text-xs text-blue-600 mb-2">Saving order...</div>
    <draggable
      v-model="localSteps"
      item-key="_id"
      handle=".drag-handle"
      ghost-class="opacity-50"
      @end="onDragEnd"
      class="space-y-2"
    >
      <template #item="{ element, index }">
        <div class="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg group">
          <!-- Drag handle -->
          <div class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </div>

          <!-- Step number -->
          <span class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold">
            {{ index + 1 }}
          </span>

          <!-- Step info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ element.title }}</p>
            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span v-if="element.estimated_time">{{ element.estimated_time }} min</span>
              <span v-if="element.warning_notes" class="text-amber-600">⚠ Warning</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="emit('edit', element._id)"
              class="p-1 text-gray-400 hover:text-blue-600"
              title="Edit step"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              @click="emit('delete', element._id)"
              class="p-1 text-gray-400 hover:text-red-600"
              title="Delete step"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </template>
    </draggable>
  </div>
</template>
