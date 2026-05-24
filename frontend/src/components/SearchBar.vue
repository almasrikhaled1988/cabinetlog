<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    debounceMs?: number;
  }>(),
  {
    modelValue: '',
    placeholder: 'Search guides...',
    debounceMs: 300,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  search: [value: string];
}>();

const inputValue = ref(props.modelValue);

watch(
  () => props.modelValue,
  (newVal) => {
    inputValue.value = newVal;
  }
);

const debouncedEmit = useDebounceFn((value: string) => {
  emit('update:modelValue', value);
  emit('search', value);
}, props.debounceMs);

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  inputValue.value = target.value;
  debouncedEmit(target.value);
}

function onClear() {
  inputValue.value = '';
  emit('update:modelValue', '');
  emit('search', '');
}
</script>

<template>
  <div class="relative">
    <label for="guide-search" class="sr-only">Search guides</label>
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <input
      id="guide-search"
      type="text"
      :value="inputValue"
      :placeholder="props.placeholder"
      class="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      @input="onInput"
    />
    <button
      v-if="inputValue"
      type="button"
      class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
      aria-label="Clear search"
      @click="onClear"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
