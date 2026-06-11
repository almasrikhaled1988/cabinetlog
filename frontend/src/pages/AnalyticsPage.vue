<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '@/api/client';

interface Overview {
  guides: { total: number; published: number; draft: number; archived: number };
  steps: { total: number };
  users: { total: number; workers: number; admins: number };
  comments: { open: number };
}

interface ActiveGuide {
  title: string;
  cabinet_type: string;
  total_completions: number;
  unique_worker_count: number;
}

interface WorkerActivity {
  name: string;
  email: string;
  total_steps_completed: number;
  guides_count: number;
  last_activity: string;
}

interface ProblematicStep {
  step_title: string;
  step_order: number;
  guide_title: string;
  issue_count: number;
}

const overview = ref<Overview | null>(null);
const activeGuides = ref<ActiveGuide[]>([]);
const workerActivity = ref<WorkerActivity[]>([]);
const problematicSteps = ref<ProblematicStep[]>([]);
const loading = ref(true);

async function fetchAll() {
  loading.value = true;
  try {
    const [overviewRes, guidesRes, workersRes, stepsRes] = await Promise.all([
      apiClient.get('/analytics/overview'),
      apiClient.get('/analytics/active-guides?limit=5'),
      apiClient.get('/analytics/worker-activity?limit=10'),
      apiClient.get('/analytics/problematic-steps?limit=5'),
    ]);
    overview.value = overviewRes.data;
    activeGuides.value = guidesRes.data;
    workerActivity.value = workersRes.data;
    problematicSteps.value = stepsRes.data;
  } catch {
    // Silently handle
  } finally {
    loading.value = false;
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(fetchAll);
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Analytics Dashboard</h1>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <template v-else-if="overview">
      <!-- Overview Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ overview.guides.total }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Total Guides</p>
        </div>
        <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
          <p class="text-2xl font-bold text-green-600">{{ overview.guides.published }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Published</p>
        </div>
        <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ overview.users.workers }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Workers</p>
        </div>
        <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
          <p class="text-2xl font-bold text-amber-600">{{ overview.comments.open }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Open Issues</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Most Active Guides -->
        <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Most Active Guides</h2>
          <div v-if="activeGuides.length === 0" class="text-sm text-gray-500 dark:text-gray-400">No activity data yet.</div>
          <div v-else class="space-y-2">
            <div v-for="g in activeGuides" :key="g.title" class="flex justify-between items-center text-sm">
              <span class="text-gray-900 dark:text-white truncate">{{ g.title }}</span>
              <span class="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap ml-2">
                {{ g.total_completions }} completions · {{ g.unique_worker_count }} workers
              </span>
            </div>
          </div>
        </div>

        <!-- Problematic Steps -->
        <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Steps with Most Issues</h2>
          <div v-if="problematicSteps.length === 0" class="text-sm text-gray-500 dark:text-gray-400">No issues reported.</div>
          <div v-else class="space-y-2">
            <div v-for="s in problematicSteps" :key="s.step_title" class="flex justify-between items-center text-sm">
              <div class="truncate">
                <span class="text-gray-900 dark:text-white">Step {{ s.step_order }}: {{ s.step_title }}</span>
                <span class="text-gray-400 dark:text-gray-500 text-xs block">{{ s.guide_title }}</span>
              </div>
              <span class="text-red-600 text-xs font-medium whitespace-nowrap ml-2">{{ s.issue_count }} issues</span>
            </div>
          </div>
        </div>

        <!-- Worker Activity -->
        <div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 lg:col-span-2">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Worker Activity</h2>
          <div v-if="workerActivity.length === 0" class="text-sm text-gray-500 dark:text-gray-400">No worker activity yet.</div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th class="pb-2">Worker</th>
                  <th class="pb-2">Steps Completed</th>
                  <th class="pb-2">Guides</th>
                  <th class="pb-2">Last Active</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr v-for="w in workerActivity" :key="w.email">
                  <td class="py-2 text-gray-900 dark:text-white">{{ w.name }}</td>
                  <td class="py-2 text-gray-600 dark:text-gray-300">{{ w.total_steps_completed }}</td>
                  <td class="py-2 text-gray-600 dark:text-gray-300">{{ w.guides_count }}</td>
                  <td class="py-2 text-gray-400 dark:text-gray-500">{{ formatDate(w.last_activity) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
