<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/auth';

interface Comment {
  _id: string;
  category: 'error' | 'improvement' | 'question';
  status: 'open' | 'in_progress' | 'resolved';
  text: string;
  reply?: string;
  user_id: { name: string; email: string };
  replied_by?: { name: string };
  replied_at?: string;
  created_at: string;
}

const props = defineProps<{ stepId: string; guideId: string }>();
const authStore = useAuthStore();

const comments = ref<Comment[]>([]);
const showForm = ref(false);
const loading = ref(false);
const saving = ref(false);
const replyingTo = ref<string | null>(null);
const replyText = ref('');

const newComment = ref({
  category: 'question' as Comment['category'],
  text: '',
});

const categoryColors = {
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  improvement: 'bg-se-green-50 text-se-green dark:bg-blue-900/30 dark:text-blue-400',
  question: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const statusColors = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-se-green-50 text-se-green',
  resolved: 'bg-green-100 text-green-700',
};

async function fetchComments() {
  loading.value = true;
  try {
    const res = await apiClient.get(`/comments/step/${props.stepId}`);
    comments.value = res.data;
  } catch {
    // silent
  } finally {
    loading.value = false;
  }
}

async function submitComment() {
  saving.value = true;
  try {
    await apiClient.post('/comments', {
      stepId: props.stepId,
      guideId: props.guideId,
      category: newComment.value.category,
      text: newComment.value.text,
    });
    newComment.value = { category: 'question', text: '' };
    showForm.value = false;
    await fetchComments();
  } catch {
    // silent
  } finally {
    saving.value = false;
  }
}

async function submitReply(commentId: string) {
  try {
    await apiClient.post(`/comments/${commentId}/reply`, { text: replyText.value });
    replyingTo.value = null;
    replyText.value = '';
    await fetchComments();
  } catch {
    // silent
  }
}

async function updateStatus(commentId: string, status: string) {
  try {
    await apiClient.put(`/comments/${commentId}/status`, { status });
    await fetchComments();
  } catch {
    // silent
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

onMounted(fetchComments);
</script>

<template>
  <div class="mt-4">
    <div class="flex items-center justify-between mb-2">
      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
        Feedback ({{ comments.length }})
      </h4>
      <button
        @click="showForm = !showForm"
        class="text-xs text-se-green hover:text-se-green-dark"
      >
        {{ showForm ? 'Cancel' : '+ Add' }}
      </button>
    </div>

    <!-- Add form -->
    <form v-if="showForm" @submit.prevent="submitComment" class="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
      <select v-model="newComment.category" class="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white">
        <option value="question">Question</option>
        <option value="error">Report Error</option>
        <option value="improvement">Suggest Improvement</option>
      </select>
      <textarea
        v-model="newComment.text"
        placeholder="Your feedback..."
        required
        rows="3"
        class="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white resize-none"
      ></textarea>
      <button type="submit" :disabled="saving" class="px-3 py-1.5 bg-se-green text-white text-xs rounded hover:bg-se-green-dark disabled:opacity-50">
        {{ saving ? 'Submitting...' : 'Submit' }}
      </button>
    </form>

    <!-- Comments list -->
    <div v-if="comments.length > 0" class="space-y-2">
      <div
        v-for="c in comments"
        :key="c._id"
        class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700"
      >
        <div class="flex items-center gap-2 mb-1">
          <span :class="categoryColors[c.category]" class="text-xs px-1.5 py-0.5 rounded font-medium">
            {{ c.category }}
          </span>
          <span :class="statusColors[c.status]" class="text-xs px-1.5 py-0.5 rounded font-medium">
            {{ c.status.replace('_', ' ') }}
          </span>
          <span class="text-xs text-gray-400 dark:text-gray-500 ml-auto">
            {{ c.user_id?.name }} · {{ formatDate(c.created_at) }}
          </span>
        </div>
        <p class="text-sm text-gray-700 dark:text-gray-300">{{ c.text }}</p>

        <!-- Reply -->
        <div v-if="c.reply" class="mt-2 pl-3 border-l-2 border-blue-200 dark:border-blue-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ c.reply }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">— {{ c.replied_by?.name }}</p>
        </div>

        <!-- Admin actions -->
        <div v-if="authStore.isAdmin && c.status !== 'resolved'" class="mt-2 flex gap-2">
          <button
            v-if="replyingTo !== c._id"
            @click="replyingTo = c._id"
            class="text-xs text-se-green hover:text-se-green-dark"
          >
            Reply
          </button>
          <button
            v-if="c.status === 'open'"
            @click="updateStatus(c._id, 'in_progress')"
            class="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900"
          >
            Mark In Progress
          </button>
          <button
            @click="updateStatus(c._id, 'resolved')"
            class="text-xs text-green-600 hover:text-green-800"
          >
            Resolve
          </button>
        </div>

        <!-- Reply form -->
        <div v-if="replyingTo === c._id" class="mt-2 flex gap-2">
          <input
            v-model="replyText"
            placeholder="Your reply..."
            class="flex-1 px-2 py-1 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
          />
          <button
            @click="submitReply(c._id)"
            class="px-2 py-1 bg-se-green text-white text-xs rounded hover:bg-se-green-dark"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
