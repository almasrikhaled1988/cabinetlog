<script setup lang="ts">
export interface Guide {
  _id: string;
  title: string;
  slug: string;
  cabinet_type: string;
  drive_model: string;
  description: string;
  thumbnail_image?: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  tags: { _id: string; name: string }[] | string[];
  created_by: { _id: string; name: string } | string;
  created_at: string;
  updated_at: string;
}

const props = defineProps<{
  guide: Guide;
}>();

const emit = defineEmits<{
  click: [guide: Guide];
}>();

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

function getStatusColor(status: string): string {
  return statusColors[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-gray-900/30 transition-shadow cursor-pointer overflow-hidden"
    role="article"
    :aria-label="`Guide: ${props.guide.title}`"
    @click="emit('click', props.guide)"
  >
    <!-- Thumbnail -->
    <div class="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
      <img
        v-if="props.guide.thumbnail_image"
        :src="props.guide.thumbnail_image"
        :alt="`Thumbnail for ${props.guide.title}`"
        class="w-full h-full object-cover"
      />
      <div v-else class="text-gray-400 dark:text-gray-500 text-center">
        <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p class="text-xs mt-1">No thumbnail</p>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4">
      <div class="flex items-start justify-between gap-2 mb-2">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{{ props.guide.title }}</h3>
        <span
          :class="['text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', getStatusColor(props.guide.status)]"
        >
          {{ props.guide.status }}
        </span>
      </div>

      <div class="space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <p v-if="props.guide.cabinet_type">
          <span class="font-medium text-gray-700 dark:text-gray-300">Type:</span> {{ props.guide.cabinet_type }}
        </p>
        <p v-if="props.guide.drive_model">
          <span class="font-medium text-gray-700 dark:text-gray-300">Drive:</span> {{ props.guide.drive_model }}
        </p>
      </div>

      <!-- Tags -->
      <div v-if="props.guide.tags && props.guide.tags.length > 0" class="mt-2 flex flex-wrap gap-1">
        <span
          v-for="tag in props.guide.tags.slice(0, 3)"
          :key="typeof tag === 'string' ? tag : tag._id"
          class="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded"
        >
          {{ typeof tag === 'string' ? tag : tag.name }}
        </span>
        <span v-if="props.guide.tags.length > 3" class="text-xs text-gray-400 dark:text-gray-500">
          +{{ props.guide.tags.length - 3 }}
        </span>
      </div>
    </div>
  </div>
</template>
