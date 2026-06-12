<script setup lang="ts">
import { ref, watch } from 'vue';

interface ChecklistItem {
  text: string;
  required: boolean;
}

const props = defineProps<{
  modelValue: ChecklistItem[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: ChecklistItem[]): void;
}>();

const items = ref<ChecklistItem[]>([...props.modelValue]);

watch(
  () => props.modelValue,
  (val) => {
    items.value = [...val];
  }
);

function addItem() {
  items.value.push({ text: '', required: false });
  emit('update:modelValue', items.value);
}

function removeItem(index: number) {
  items.value.splice(index, 1);
  emit('update:modelValue', items.value);
}

function updateItem() {
  emit('update:modelValue', items.value);
}
</script>

<template>
  <div>
    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Checklist Items</label>
    <div class="space-y-2">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center gap-2"
      >
        <input
          v-model="item.text"
          @input="updateItem"
          placeholder="Checklist item..."
          class="flex-1 px-2 py-1.5 text-sm border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
        />
        <label class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          <input
            type="checkbox"
            v-model="item.required"
            @change="updateItem"
            class="rounded"
          />
          Required
        </label>
        <button
          @click="removeItem(index)"
          class="text-red-400 hover:text-red-600 text-sm"
          type="button"
        >
          ×
        </button>
      </div>
    </div>
    <button
      @click="addItem"
      type="button"
      class="mt-2 text-xs text-se-green hover:text-se-green-dark"
    >
      + Add checklist item
    </button>
  </div>
</template>
