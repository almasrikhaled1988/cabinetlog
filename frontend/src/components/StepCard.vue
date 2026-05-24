<script setup lang="ts">
export interface StepCardProps {
  stepId: string;
  stepOrder: number;
  title: string;
  description: string;
  estimatedTime?: number;
  warningNotes?: string;
  mediaCount?: number;
}

defineProps<StepCardProps>();
</script>

<template>
  <div
    class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
  >
    <div class="flex items-start gap-3">
      <!-- Step number badge -->
      <div
        class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold"
      >
        {{ stepOrder }}
      </div>

      <!-- Step content -->
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-medium text-gray-900 truncate">
          {{ title }}
        </h3>
        <p
          v-if="description"
          class="mt-1 text-sm text-gray-600 line-clamp-2"
        >
          {{ description }}
        </p>

        <!-- Meta info row -->
        <div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
          <span v-if="estimatedTime" class="flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ estimatedTime }} min
          </span>
          <span v-if="mediaCount && mediaCount > 0" class="flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {{ mediaCount }} {{ mediaCount === 1 ? 'file' : 'files' }}
          </span>
        </div>

        <!-- Warning notes -->
        <div
          v-if="warningNotes"
          class="mt-2 flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800"
        >
          <svg class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span class="line-clamp-2">{{ warningNotes }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
