<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api/client';

const router = useRouter();

const markdownContent = ref('');
const fileName = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref<{ message: string; guideId: string } | null>(null);

const placeholder = `# Guide-Titel hier

- **Typ:** VSD
- **Antrieb:** ATV630
- **Tags:** Frequenzumrichter, Altivar

Beschreibung der Anleitung...

---

## Schritt 1: Schaltschrank vorbereiten
**Zeit:** 10 min

Beschreibung des Schritts...

> ⚠️ Sicherheitshinweis hier.

- [x] Prüfpunkt (Pflicht)
- [ ] Optionaler Prüfpunkt`;

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  if (!file.name.endsWith('.md')) {
    error.value = 'Please select a .md (Markdown) file.';
    return;
  }

  fileName.value = file.name;
  error.value = null;
  success.value = null;

  const reader = new FileReader();
  reader.onload = (e) => {
    markdownContent.value = e.target?.result as string;
  };
  reader.readAsText(file);
}

async function handleImport() {
  if (!markdownContent.value.trim()) {
    error.value = 'Please paste or upload markdown content.';
    return;
  }

  loading.value = true;
  error.value = null;
  success.value = null;

  try {
    const response = await apiClient.post('/import/markdown', {
      content: markdownContent.value,
    });

    success.value = {
      message: response.data.message,
      guideId: response.data.guide._id,
    };
    markdownContent.value = '';
    fileName.value = '';
  } catch (err: any) {
    if (err.response?.status === 401) {
      error.value = 'Session expired. Please log out and log back in.';
    } else {
      error.value = err.response?.data?.error?.message || 'Import failed. Check your markdown format.';
    }
  } finally {
    loading.value = false;
  }
}

function goToGuide() {
  if (success.value) {
    router.push({ name: 'guide-detail', params: { id: success.value.guideId } });
  }
}

function reset() {
  markdownContent.value = '';
  fileName.value = '';
  error.value = null;
  success.value = null;
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Import Guide</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Import an assembly guide from a Markdown file. Write in any language.
        </p>
      </div>
      <router-link to="/guides" class="btn-secondary dark:btn-secondary-dark text-sm">
        ← Back to Guides
      </router-link>
    </div>

    <!-- Success message -->
    <div v-if="success" class="card dark:card-dark p-6 mb-6 border-se-green/30">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 bg-se-green-50 dark:bg-se-green/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-se-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ success.message }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">The guide was created as a draft. You can edit and publish it from the detail page.</p>
          <div class="flex gap-2 mt-3">
            <button @click="goToGuide" class="btn-primary text-sm">View Guide</button>
            <button @click="reset" class="btn-secondary dark:btn-secondary-dark text-sm">Import Another</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <div v-if="!success" class="space-y-6">
      <!-- File upload -->
      <div class="card dark:card-dark p-6">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Option 1: Upload a .md file</h2>
        <label class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-se-green/50 hover:bg-se-green-50/50 dark:hover:bg-se-green/5 transition-colors">
          <div class="flex flex-col items-center">
            <svg class="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              <span v-if="fileName" class="text-se-green font-medium">{{ fileName }}</span>
              <span v-else>Click to upload or drag & drop a <strong>.md</strong> file</span>
            </p>
          </div>
          <input type="file" accept=".md" class="hidden" @change="handleFileUpload" />
        </label>
      </div>

      <!-- Text area -->
      <div class="card dark:card-dark p-6">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Option 2: Paste markdown content</h2>
        <textarea
          v-model="markdownContent"
          :placeholder="placeholder"
          rows="18"
          class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono bg-gray-50 dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-se-green focus:border-se-green resize-y"
        ></textarea>
        <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Tip: Use <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded"># Title</code> for the guide name,
          <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">## Schritt X: Name</code> for steps,
          <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">> ⚠️ Warning</code> for safety notes.
        </p>
      </div>

      <!-- Import button -->
      <div class="flex items-center gap-3">
        <button
          @click="handleImport"
          :disabled="loading || !markdownContent.trim()"
          class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg v-if="!loading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          {{ loading ? 'Importing...' : 'Import Guide' }}
        </button>
        <span class="text-xs text-gray-400 dark:text-gray-500">Guide will be created as draft</span>
      </div>

      <!-- Format reference -->
      <details class="card dark:card-dark p-5">
        <summary class="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-se-green transition-colors">
          📖 Markdown Format Reference
        </summary>
        <div class="mt-4 text-sm text-gray-600 dark:text-gray-400 space-y-3">
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200 mb-1">Guide header:</p>
            <pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto border border-gray-200 dark:border-gray-700"># Guide Title

- **Typ:** VSD
- **Antrieb:** ATV630
- **Tags:** Tag1, Tag2, Tag3

Description text here...</pre>
          </div>
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200 mb-1">Steps:</p>
            <pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto border border-gray-200 dark:border-gray-700">## Schritt 1: Step title
**Zeit:** 15 min

Description of what to do...

> ⚠️ Safety warning here.

- [x] Required checklist item (Pflicht)
- [ ] Optional checklist item</pre>
          </div>
          <div>
            <p class="font-medium text-gray-800 dark:text-gray-200 mb-1">Supported metadata keys:</p>
            <ul class="list-disc list-inside text-xs space-y-1">
              <li><strong>Typ/Type:</strong> Cabinet type (VSD, MCC, Control Panel, Custom)</li>
              <li><strong>Antrieb/Drive:</strong> Drive model (ATV630, ATV930, etc.)</li>
              <li><strong>Tags:</strong> Comma-separated tag list</li>
              <li><strong>Zeit/Time:</strong> Estimated time per step in minutes</li>
              <li><strong>> ⚠️</strong> Lines starting with > are warnings</li>
              <li><strong>- [x]</strong> Checked items = required, <strong>- [ ]</strong> = optional</li>
              <li><strong>(Pflicht)</strong> suffix also marks items as required</li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>
