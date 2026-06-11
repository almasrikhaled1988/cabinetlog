<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '@/api/client';

interface Version {
  _id: string;
  version: number;
  changelog?: string;
  published_by: { name: string };
  created_at: string;
}

const props = defineProps<{ guideId: string }>();

const versions = ref<Version[]>([]);
const loading = ref(false);
const expanded = ref<string | null>(null);
const versionDetail = ref<any>(null);

async function fetchVersions() {
  loading.value = true;
  try {
    const res = await apiClient.get(`/guides/${props.guideId}/versions`);
    versions.value = res.data;
  } catch {
    // silent
  } finally {
    loading.value = false;
  }
}

async function loadVersionDetail(guideId: string, version: number) {
  const key = `${guideId}-${version}`;
  if (expanded.value === key) {
    expanded.value = null;
    versionDetail.value = null;
    return;
  }

  try {
    const res = await apiClient.get(`/guides/${guideId}/versions/${version}`);
    versionDetail.value = res.data;
    expanded.value = key;
  } catch {
    // silent
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(fetchVersions);
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Version History</h3>

    <div v-if="loading" class="text-center py-3">
      <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
    </div>

    <div v-else-if="versions.length === 0" class="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
      No versions published yet.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="v in versions"
        :key="v._id"
        class="border dark:border-gray-700 rounded-lg overflow-hidden"
      >
        <button
          @click="loadVersionDetail(props.guideId, v.version)"
          class="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900 dark:text-white">v{{ v.version }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(v.created_at) }}</span>
          </div>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ v.published_by?.name }}</span>
        </button>

        <!-- Expanded detail -->
        <div
          v-if="expanded === `${props.guideId}-${v.version}` && versionDetail"
          class="px-3 pb-3 border-t dark:border-gray-700"
        >
          <div v-if="v.changelog" class="mt-2 text-xs text-gray-600 dark:text-gray-400 italic">
            "{{ v.changelog }}"
          </div>
          <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <p><strong>Steps:</strong> {{ versionDetail.snapshot?.steps?.length || 0 }}</p>
            <p><strong>Tags:</strong> {{ versionDetail.snapshot?.tags?.join(', ') || 'None' }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
