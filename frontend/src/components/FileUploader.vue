<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import apiClient from '@/api/client';

export interface MediaItem {
  _id: string;
  build_step_id: string;
  file_type: 'image' | 'pdf';
  file_path: string;
  original_name: string;
  file_size: number;
  caption?: string;
  sort_order: number;
  created_at: string;
}

export interface FileUploaderProps {
  buildStepId: string;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  previewUrl: string | null;
  caption: string;
  error: string | null;
  status: 'uploading' | 'success' | 'error';
}

const props = defineProps<FileUploaderProps>();

const emit = defineEmits<{
  (e: 'uploaded', media: MediaItem): void;
  (e: 'deleted', mediaId: string): void;
}>();

const mediaItems = ref<MediaItem[]>([]);
const uploadingFiles = ref<UploadingFile[]>([]);
const isDragOver = ref(false);
const loadingMedia = ref(false);
const deleteConfirmId = ref<string | null>(null);

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

const hasMedia = computed(() => mediaItems.value.length > 0);

function validateFile(file: File): string | null {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isPdf = ALLOWED_PDF_TYPES.includes(file.type);

  if (!isImage && !isPdf) {
    return `Unsupported file type: ${file.type || 'unknown'}. Only JPEG, PNG, and PDF files are allowed.`;
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return `Image file "${file.name}" exceeds the maximum size of 10 MB.`;
  }

  if (isPdf && file.size > MAX_PDF_SIZE) {
    return `PDF file "${file.name}" exceeds the maximum size of 25 MB.`;
  }

  return null;
}

function generateId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createPreviewUrl(file: File): string | null {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return URL.createObjectURL(file);
  }
  return null;
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave() {
  isDragOver.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    processFiles(Array.from(files));
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    processFiles(Array.from(input.files));
    input.value = '';
  }
}

function processFiles(files: File[]) {
  for (const file of files) {
    const error = validateFile(file);
    if (error) {
      const uploadEntry: UploadingFile = {
        id: generateId(),
        file,
        progress: 0,
        previewUrl: null,
        caption: '',
        error,
        status: 'error',
      };
      uploadingFiles.value.push(uploadEntry);
      continue;
    }

    const uploadEntry: UploadingFile = {
      id: generateId(),
      file,
      progress: 0,
      previewUrl: createPreviewUrl(file),
      caption: '',
      error: null,
      status: 'uploading',
    };
    uploadingFiles.value.push(uploadEntry);
    // Access the reactive proxy from the array for proper reactivity tracking
    const reactiveEntry = uploadingFiles.value[uploadingFiles.value.length - 1];
    uploadFile(reactiveEntry);
  }
}

async function uploadFile(entry: UploadingFile) {
  const formData = new FormData();
  formData.append('file', entry.file);
  formData.append('buildStepId', props.buildStepId);

  const isImage = ALLOWED_IMAGE_TYPES.includes(entry.file.type);
  const endpoint = isImage ? '/upload/image' : '/upload/pdf';

  try {
    const response = await apiClient.post<MediaItem>(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          entry.progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        }
      },
    });

    entry.status = 'success';
    entry.progress = 100;

    const media = response.data;
    mediaItems.value.push(media);
    emit('uploaded', media);

    // Remove from uploading list after a short delay
    setTimeout(() => {
      removeUploadEntry(entry.id);
    }, 2000);
  } catch (err: unknown) {
    entry.status = 'error';
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      entry.error = axiosErr.response?.data?.error?.message || 'Upload failed';
    } else {
      entry.error = 'Network error. Please try again.';
    }
  }
}

function removeUploadEntry(id: string) {
  const index = uploadingFiles.value.findIndex((u) => u.id === id);
  if (index !== -1) {
    const entry = uploadingFiles.value[index];
    if (entry.previewUrl) {
      URL.revokeObjectURL(entry.previewUrl);
    }
    uploadingFiles.value.splice(index, 1);
  }
}

function confirmDelete(mediaId: string) {
  deleteConfirmId.value = mediaId;
}

function cancelDelete() {
  deleteConfirmId.value = null;
}

async function deleteMedia(mediaId: string) {
  try {
    await apiClient.delete(`/upload/${mediaId}`);
    mediaItems.value = mediaItems.value.filter((m) => m._id !== mediaId);
    emit('deleted', mediaId);
  } catch {
    // Silently handle — could add error toast in future
  } finally {
    deleteConfirmId.value = null;
  }
}

async function fetchMedia() {
  loadingMedia.value = true;
  try {
    const response = await apiClient.get<MediaItem[]>(`/upload/step/${props.buildStepId}`);
    mediaItems.value = response.data;
  } catch {
    // If endpoint doesn't exist yet, start with empty
    mediaItems.value = [];
  } finally {
    loadingMedia.value = false;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMediaUrl(filePath: string): string {
  // If it's a full URL (Cloudinary), use directly; otherwise prefix with /uploads/
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  return `/uploads/${filePath}`;
}

onMounted(() => {
  fetchMedia();
});
</script>

<template>
  <div class="file-uploader">
    <!-- Drop zone -->
    <div
      class="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer"
      :class="{
        'border-blue-400 bg-blue-50': isDragOver,
        'border-gray-300 hover:border-gray-400': !isDragOver,
      }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="($refs.fileInput as HTMLInputElement)?.click()"
    >
      <svg
        class="mx-auto h-10 w-10 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p class="mt-2 text-sm text-gray-600">
        <span class="font-medium text-blue-600">Click to upload</span> or drag and drop
      </p>
      <p class="mt-1 text-xs text-gray-500">
        JPEG, PNG (max 10 MB) or PDF (max 25 MB)
      </p>
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        @change="handleFileSelect"
      />
    </div>

    <!-- Upload progress list -->
    <div v-if="uploadingFiles.length > 0" class="mt-4 space-y-3">
      <div
        v-for="upload in uploadingFiles"
        :key="upload.id"
        class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
      >
        <!-- Preview thumbnail -->
        <div class="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-gray-200 flex items-center justify-center">
          <img
            v-if="upload.previewUrl"
            :src="upload.previewUrl"
            :alt="upload.file.name"
            class="w-full h-full object-cover"
          />
          <svg
            v-else
            class="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        <!-- File info and progress -->
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-700 truncate">{{ upload.file.name }}</p>
          <div v-if="upload.status === 'uploading'" class="mt-1">
            <div class="w-full bg-gray-200 rounded-full h-1.5">
              <div
                class="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                :style="{ width: `${upload.progress}%` }"
              />
            </div>
            <p class="mt-0.5 text-xs text-gray-500">{{ upload.progress }}%</p>
          </div>
          <p v-if="upload.status === 'error'" class="mt-0.5 text-xs text-red-600">
            {{ upload.error }}
          </p>
          <p v-if="upload.status === 'success'" class="mt-0.5 text-xs text-green-600">
            Upload complete
          </p>
        </div>

        <!-- Remove button for errors -->
        <button
          v-if="upload.status === 'error'"
          class="flex-shrink-0 text-gray-400 hover:text-gray-600"
          @click="removeUploadEntry(upload.id)"
          aria-label="Dismiss"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Media gallery -->
    <div v-if="loadingMedia" class="mt-4 text-center text-sm text-gray-500">
      Loading media...
    </div>

    <div v-else-if="hasMedia" class="mt-4">
      <h4 class="text-sm font-medium text-gray-700 mb-2">
        Uploaded files ({{ mediaItems.length }})
      </h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          v-for="media in mediaItems"
          :key="media._id"
          class="relative group border border-gray-200 rounded-lg overflow-hidden"
        >
          <!-- Image preview -->
          <div v-if="media.file_type === 'image'" class="aspect-square bg-gray-100">
            <img
              :src="getMediaUrl(media.file_path)"
              :alt="media.caption || media.original_name"
              class="w-full h-full object-cover"
            />
          </div>

          <!-- PDF placeholder -->
          <div v-else class="aspect-square bg-gray-100 flex flex-col items-center justify-center p-2">
            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span class="mt-1 text-xs text-gray-500 text-center truncate w-full">
              {{ media.original_name }}
            </span>
          </div>

          <!-- Caption overlay -->
          <div v-if="media.caption" class="px-2 py-1 bg-white border-t border-gray-200">
            <p class="text-xs text-gray-600 truncate">{{ media.caption }}</p>
          </div>

          <!-- File size badge -->
          <div class="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
            {{ formatFileSize(media.file_size) }}
          </div>

          <!-- Delete button -->
          <button
            class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            :aria-label="`Delete ${media.original_name}`"
            @click="confirmDelete(media._id)"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Delete confirmation overlay -->
          <div
            v-if="deleteConfirmId === media._id"
            class="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 p-2"
          >
            <p class="text-white text-xs text-center">Delete this file?</p>
            <div class="flex gap-2">
              <button
                class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                @click="deleteMedia(media._id)"
              >
                Delete
              </button>
              <button
                class="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                @click="cancelDelete"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
