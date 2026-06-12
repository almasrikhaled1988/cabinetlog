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
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30',
  published: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border border-green-200 dark:border-green-500/30',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-600/20 dark:text-gray-400 border border-gray-200 dark:border-gray-600/30',
};

function getStatusColor(status: string): string {
  return statusColors[status] || statusColors.archived;
}
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:border-se-green/30 transition-all duration-200 cursor-pointer overflow-hidden group"
    role="article"
    :aria-label="`Guide: ${props.guide.title}`"
    @click="emit('click', props.guide)"
  >
    <!-- Thumbnail -->
    <div class="h-40 bg-gradient-to-br from-se-green-50 to-green-50 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center overflow-hidden relative">
      <img
        v-if="props.guide.thumbnail_image"
        :src="props.guide.thumbnail_image"
        :alt="`Thumbnail for ${props.guide.title}`"
        class="w-full h-full object-cover"
      />
      <div v-else class="text-center">
        <svg class="w-14 h-14 text-se-green/20 dark:text-se-green/10 group-hover:text-se-green/40 transition-colors mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <!-- Status badge overlay -->
      <div class="absolute top-3 right-3">
        <span
          :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full', getStatusColor(props.guide.status)]"
        >
          {{ props.guide.status }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-se-green transition-colors">{{ props.guide.title }}</h3>

      <div class="space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <p v-if="props.guide.cabinet_type">
          <span class="font-medium text-gray-700 dark:text-gray-300">Type:</span> {{ props.guide.cabinet_type }}
        </p>
        <p v-if="props.guide.drive_model">
          <span class="font-medium text-gray-700 dark:text-gray-300">Drive:</span> {{ props.guide.drive_model }}
        </p>
      </div>

      <!-- Tags -->
      <div v-if="props.guide.tags && props.guide.tags.length > 0" class="mt-3 flex flex-wrap gap-1.5">
        <span
          v-for="tag in props.guide.tags.slice(0, 3)"
          :key="typeof tag === 'string' ? tag : tag._id"
          class="text-[10px] bg-se-green-50 dark:bg-se-green/10 text-se-green px-2 py-0.5 rounded-full font-medium border border-se-green/20"
        >
          {{ typeof tag === 'string' ? tag : tag.name }}
        </span>
        <span v-if="props.guide.tags.length > 3" class="text-[10px] text-gray-400 dark:text-gray-500 px-1">
          +{{ props.guide.tags.length - 3 }}
        </span>
      </div>
    </div>
  </div>
</template>
