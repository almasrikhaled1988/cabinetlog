<script setup lang="ts">
import { ref } from 'vue';

interface Annotation {
  id: string;
  type: 'arrow' | 'circle' | 'text';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text?: string;
  color: string;
}

const props = defineProps<{
  imageUrl: string;
  annotations?: Annotation[];
  editable?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:annotations', val: Annotation[]): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const localAnnotations = ref<Annotation[]>(props.annotations || []);
const activeTool = ref<'arrow' | 'circle' | 'text' | null>(null);
const isDrawing = ref(false);
const startPos = ref({ x: 0, y: 0 });
const currentColor = ref('#ef4444');

function getRelativePos(e: MouseEvent) {
  const rect = canvasRef.value!.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  };
}

function handleMouseDown(e: MouseEvent) {
  if (!props.editable || !activeTool.value) return;
  isDrawing.value = true;
  startPos.value = getRelativePos(e);
}

function handleMouseUp(e: MouseEvent) {
  if (!isDrawing.value || !activeTool.value) return;
  isDrawing.value = false;

  const endPos = getRelativePos(e);
  const id = Date.now().toString();

  if (activeTool.value === 'text') {
    const text = prompt('Enter label text:');
    if (text) {
      localAnnotations.value.push({
        id,
        type: 'text',
        x: startPos.value.x,
        y: startPos.value.y,
        text,
        color: currentColor.value,
      });
    }
  } else {
    localAnnotations.value.push({
      id,
      type: activeTool.value,
      x: startPos.value.x,
      y: startPos.value.y,
      x2: endPos.x,
      y2: endPos.y,
      color: currentColor.value,
    });
  }

  emit('update:annotations', localAnnotations.value);
}

function removeAnnotation(id: string) {
  localAnnotations.value = localAnnotations.value.filter((a) => a.id !== id);
  emit('update:annotations', localAnnotations.value);
}

function clearAll() {
  localAnnotations.value = [];
  emit('update:annotations', []);
}
</script>

<template>
  <div>
    <!-- Toolbar -->
    <div v-if="editable" class="flex items-center gap-2 mb-2 p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
      <button
        v-for="tool in (['arrow', 'circle', 'text'] as const)"
        :key="tool"
        @click="activeTool = activeTool === tool ? null : tool"
        :class="activeTool === tool ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'"
        class="px-2 py-1 text-xs rounded border dark:border-gray-600"
      >
        {{ tool === 'arrow' ? '→' : tool === 'circle' ? '○' : 'T' }}
        {{ tool }}
      </button>
      <input v-model="currentColor" type="color" class="w-6 h-6 rounded cursor-pointer" />
      <button
        @click="clearAll"
        class="ml-auto text-xs text-red-600 hover:text-red-800"
      >
        Clear All
      </button>
    </div>

    <!-- Image with annotations -->
    <div
      ref="containerRef"
      class="relative overflow-hidden rounded-lg"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
    >
      <img :src="imageUrl" class="w-full h-auto" :class="{ 'cursor-crosshair': activeTool }" />

      <!-- SVG overlay for annotations -->
      <svg
        ref="canvasRef"
        class="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <template v-for="a in localAnnotations" :key="a.id">
          <!-- Arrow -->
          <line
            v-if="a.type === 'arrow'"
            :x1="a.x"
            :y1="a.y"
            :x2="a.x2"
            :y2="a.y2"
            :stroke="a.color"
            stroke-width="0.5"
            marker-end="url(#arrowhead)"
          />
          <!-- Circle -->
          <ellipse
            v-if="a.type === 'circle'"
            :cx="(a.x + (a.x2 || a.x)) / 2"
            :cy="(a.y + (a.y2 || a.y)) / 2"
            :rx="Math.abs((a.x2 || a.x) - a.x) / 2"
            :ry="Math.abs((a.y2 || a.y) - a.y) / 2"
            :stroke="a.color"
            stroke-width="0.4"
            fill="none"
          />
          <!-- Text -->
          <text
            v-if="a.type === 'text'"
            :x="a.x"
            :y="a.y"
            :fill="a.color"
            font-size="3"
            font-weight="bold"
          >
            {{ a.text }}
          </text>
        </template>
        <!-- Arrow marker definition -->
        <defs>
          <marker id="arrowhead" markerWidth="4" markerHeight="3" refX="4" refY="1.5" orient="auto">
            <polygon points="0 0, 4 1.5, 0 3" fill="currentColor" />
          </marker>
        </defs>
      </svg>

      <!-- Delete buttons (editable mode) -->
      <div v-if="editable" class="absolute top-1 right-1 flex flex-col gap-1">
        <button
          v-for="a in localAnnotations"
          :key="'del-' + a.id"
          @click.stop="removeAnnotation(a.id)"
          class="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-70 hover:opacity-100 pointer-events-auto"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>
